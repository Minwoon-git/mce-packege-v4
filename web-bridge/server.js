// MCE 웹 브릿지 — 브라우저 채팅 UI의 메시지를 로컬 Claude Code(CLI)로 처리하고 결과를 스트리밍한다.
// slack-bridge와 동일한 실행 패턴(claude -p, --resume 세션 연속)을 쓰되,
// 웹에서는 stream-json + SSE로 진행 상황(도구 실행·중간 텍스트)을 실시간으로 내려보낸다.
const path = require('path');
const express = require('express');
const { spawn } = require('child_process');

// 프로젝트 루트 = 이 파일의 상위 폴더 (mce-campaign 스킬·sf-mce-mcp가 연결된 곳)
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3456;

const app = express();
app.use(express.json({ limit: '1mb' }));
// 웹 UI는 제거됨 — 이 서버는 Chrome 확장(chrome-extension/)이 쓰는 API 전용이다
app.get('/', (_req, res) => res.type('text/plain').send('MCE 웹 브릿지 (API 전용) — UI는 Chrome 확장을 사용하세요.'));

// 계정 게이트 설정 — config.json의 allowedAccounts(계정명 배열)가 있으면,
// 확장이 그 계정명이 화면에 보이는 MCE에서만 챗봇 버튼을 노출한다. 없으면 게이트 없이 항상 노출.
let CONFIG = {};
try { CONFIG = require('./config.json'); } catch { /* 파일 없으면 게이트 미적용 */ }
app.get('/api/config', (_req, res) =>
  res.json({ allowedAccounts: Array.isArray(CONFIG.allowedAccounts) ? CONFIG.allowedAccounts : [] }),
);

// chatId → 실행 중인 claude 프로세스. 같은 대화에 동시 요청이 겹치는 것을 막고, 중지 버튼에 쓴다.
const running = new Map();

// SSE 이벤트 한 건 전송
function send(res, obj) {
  if (!res.writableEnded) res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// 도구 이름을 표시용으로 정리 (mcp__sf-mce-mcp__sfmc_get_journeys → SFMC · sfmc_get_journeys)
function toolLabel(name) {
  if (name.startsWith('mcp__sf-mce-mcp__')) return `SFMC · ${name.slice('mcp__sf-mce-mcp__'.length)}`;
  return name.replace(/^mcp__([^_]+(?:_[^_]+)*)__/, '$1 · ');
}

// 도구 입력에서 사람이 읽을 만한 한 줄 힌트를 뽑는다
function toolDetail(input) {
  if (!input || typeof input !== 'object') return '';
  const v =
    input.description || input.file_path || input.pattern || input.name || input.query ||
    (typeof input.prompt === 'string' ? input.prompt : '');
  return String(v).replace(/\s+/g, ' ').slice(0, 100);
}

app.post('/api/chat', (req, res) => {
  const { message, sessionId, chatId } = req.body || {};
  const prompt = (message || '').trim();
  if (!prompt) return res.status(400).json({ error: '메시지가 비어 있습니다.' });
  if (chatId && running.has(chatId)) {
    return res.status(409).json({ error: '이 대화에서 이미 처리 중인 요청이 있습니다.' });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // --dangerously-skip-permissions: 웹 봇은 사람이 "허용"을 못 누르므로 자동 승인이 필요 (slack-bridge와 동일)
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'];
  if (sessionId) args.push('--resume', sessionId);

  const child = spawn('claude', args, { cwd: PROJECT_ROOT, shell: true });
  if (chatId) running.set(chatId, child);

  // 프록시·브라우저가 유휴 연결을 끊지 않도록 주기적으로 핑을 보낸다
  const ping = setInterval(() => {
    if (!res.writableEnded) res.write(': ping\n\n');
  }, 15000);

  let gotResult = false;
  let stderr = '';
  let buf = '';

  const handleEvent = (ev) => {
    if (ev.type === 'system' && ev.subtype === 'init') {
      send(res, { type: 'session', sessionId: ev.session_id });
      return;
    }
    if (ev.type === 'assistant' && ev.message && Array.isArray(ev.message.content)) {
      for (const block of ev.message.content) {
        if (block.type === 'text' && block.text && block.text.trim()) {
          send(res, { type: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          send(res, { type: 'tool', name: toolLabel(block.name || ''), detail: toolDetail(block.input) });
        }
      }
      return;
    }
    if (ev.type === 'result') {
      gotResult = true;
      if (ev.is_error && !ev.result) {
        send(res, { type: 'error', message: ev.error || ev.subtype || '알 수 없는 오류' });
      } else {
        send(res, {
          type: 'result',
          text: ev.result ?? '(빈 응답)',
          cost: ev.total_cost_usd,
          sessionId: ev.session_id,
        });
      }
    }
  };

  child.stdout.on('data', (d) => {
    buf += d.toString();
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        handleEvent(JSON.parse(line));
      } catch {
        /* JSON이 아닌 로그 줄은 무시 */
      }
    }
  });
  child.stderr.on('data', (d) => (stderr += d.toString()));

  const finish = (extra) => {
    clearInterval(ping);
    if (chatId) running.delete(chatId);
    if (extra) send(res, extra);
    send(res, { type: 'done' });
    if (!res.writableEnded) res.end();
  };

  child.on('error', (err) => finish({ type: 'error', message: `claude 실행 실패: ${err.message}` }));
  child.on('close', (code) => {
    if (child.stoppedByUser && !gotResult) {
      finish({ type: 'result', text: '⏹ 요청을 중단했습니다.' }); // 사용자 중단은 오류가 아닌 안내로
    } else if (!gotResult && code !== 0) {
      finish({ type: 'error', message: stderr.trim() || `claude 종료 코드 ${code}` });
    } else {
      finish();
    }
  });

  // 탭이 닫혀도 작업은 계속 진행 — 세션이 저장되므로 다시 열면 --resume으로 이어진다
  req.on('close', () => clearInterval(ping));

  child.stdin.write(prompt);
  child.stdin.end();
});

// 실행 중인 요청 중지 (UI의 ⏹ 버튼)
// Windows에서 shell:true 스폰은 cmd가 부모라 child.kill()로는 실제 claude 프로세스가 살아남는다
// → taskkill /T 로 프로세스 트리 전체를 종료한다
function killTree(child) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F']);
  } else {
    child.kill();
  }
}

app.post('/api/stop', (req, res) => {
  const { chatId } = req.body || {};
  const child = chatId && running.get(chatId);
  if (child) {
    child.stoppedByUser = true;
    killTree(child);
    running.delete(chatId);
    return res.json({ stopped: true });
  }
  res.json({ stopped: false });
});

app.listen(PORT, () => {
  console.log(`⚡ MCE 웹 브릿지 실행 중 → http://localhost:${PORT}`);
  console.log('   프로젝트 루트:', PROJECT_ROOT);
});
