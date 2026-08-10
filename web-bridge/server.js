// MCE 웹 브릿지 — 브라우저 채팅 UI의 메시지를 로컬 Claude Code(CLI)로 처리하고 결과를 스트리밍한다.
// slack-bridge와 동일한 실행 패턴(claude -p, --resume 세션 연속)을 쓰되,
// 웹에서는 stream-json + SSE로 진행 상황(도구 실행·중간 텍스트)을 실시간으로 내려보낸다.
const fs = require('fs');
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

// 산출물 다운로드 — 캠페인 워크플로가 만든 파일(정의서 xlsx·분석 리포트 등)을 확장 말풍선에서 바로 내려받는다.
// 확장(content.js)이 답변 속 산출물 경로를 이 엔드포인트 링크(📎 칩)로 바꿔 준다.
// 안전장치: 프로젝트 루트 안 + 허용 폴더 + 허용 확장자만 서빙 (경로 조작·임의 파일 노출 방지)
const FILE_DIRS = new Set(['campaign_definitions', 'reports']);
const FILE_EXTS = new Set(['.xlsx', '.xlsm', '.csv', '.pptx', '.pdf', '.png', '.md', '.html']);
app.get('/api/file', (req, res) => {
  const q = String(req.query.path || '');
  const abs = path.isAbsolute(q) ? path.resolve(q) : path.resolve(PROJECT_ROOT, q);
  const rel = path.relative(PROJECT_ROOT, abs);
  const inside = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
  if (!inside || !FILE_DIRS.has(rel.split(path.sep)[0]) || !FILE_EXTS.has(path.extname(abs).toLowerCase())) {
    return res.status(403).json({ error: '허용되지 않은 경로입니다.' });
  }
  res.download(abs, (err) => {
    if (err && !res.headersSent) res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
  });
});

// 파일 첨부(드래그&드롭) 업로드 — 확장 패널에 놓은 파일을 저장하고 절대 경로를 돌려준다.
// 정의서(xlsx/xlsm/csv)는 campaign_definitions\에 저장돼 "정의서 직접 첨부 → STEP 3" 흐름과 그대로 연결되고,
// 그 외 허용 확장자(스키마 DDL 등)는 uploads\에 저장된다. 실행 파일 등은 거부.
const UPLOAD_DEF_EXTS = new Set(['.xlsx', '.xlsm', '.csv']);
const UPLOAD_ETC_EXTS = new Set(['.txt', '.sql', '.md', '.json']);
app.post('/api/upload', express.raw({ type: () => true, limit: '25mb' }), (req, res) => {
  const name = path.basename(String(req.query.name || '')).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  const ext = path.extname(name).toLowerCase();
  if (!name || (!UPLOAD_DEF_EXTS.has(ext) && !UPLOAD_ETC_EXTS.has(ext))) {
    return res.status(403).json({ error: `허용되지 않은 파일 형식입니다 (${ext || '확장자 없음'})` });
  }
  if (!req.body || !req.body.length) return res.status(400).json({ error: '파일 내용이 비어 있습니다.' });
  const dir = path.join(PROJECT_ROOT, UPLOAD_DEF_EXTS.has(ext) ? 'campaign_definitions' : 'uploads');
  fs.mkdirSync(dir, { recursive: true });
  let dest = path.join(dir, name);
  if (fs.existsSync(dest)) {
    // 동명 파일 덮어쓰기 방지 — 타임스탬프를 붙여 새 파일로 저장
    const t = new Date();
    const stamp = [t.getFullYear(), t.getMonth() + 1, t.getDate()].map((n) => String(n).padStart(2, '0')).join('') +
      '_' + [t.getHours(), t.getMinutes(), t.getSeconds()].map((n) => String(n).padStart(2, '0')).join('');
    dest = path.join(dir, `${path.basename(name, ext)}_${stamp}${ext}`);
  }
  fs.writeFileSync(dest, req.body);
  res.json({ path: dest, name: path.basename(dest) });
});

// chatId → 실행 중인 claude 프로세스. 같은 대화에 동시 요청이 겹치는 것을 막고, 중지 버튼에 쓴다.
const running = new Map();

// chatId → 마지막 결과. 스트림 도중 연결이 끊긴 클라이언트(확장 서비스 워커 종료 등)가
// /api/result 폴링으로 결과를 회수할 때 쓴다. 작업 자체는 연결과 무관하게 끝까지 돈다.
const lastResult = new Map();
function rememberResult(chatId, data) {
  if (!chatId) return;
  lastResult.set(chatId, { ...data, ts: Date.now() });
  for (const [k, v] of lastResult) if (Date.now() - v.ts > 3600e3) lastResult.delete(k); // 1시간 경과분 정리
}

// SSE 이벤트 한 건 전송
function send(res, obj) {
  if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(obj)}\n\n`);
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
  // 챗봇 정책: 저장소 코드/설정/문서를 고쳐달라는 직접 요청은 거부하게 한다.
  // (캠페인 워크플로가 만드는 산출물 — 정의서 xlsx·리포트·저니 이력 등 — 은 예외로 정상 동작)
  // shell:true 스폰은 인자를 자동 인용하지 않으므로 직접 큰따옴표로 감싼다(그래서 영문·ASCII로 작성).
  const BOT_POLICY =
    'This session runs inside the MCE chatbot used by campaign operators, not the developer CLI. ' +
    'If the user directly asks you to modify, create, or delete source code, configuration, skills, agents, ' +
    'or any other repository files, refuse and tell them to do it in Claude Code on this PC instead. ' +
    'This restriction does NOT apply to files produced by the normal campaign workflows, such as campaign ' +
    'definition xlsx files, analysis reports, journey history logs, and agent memory - those keep working as usual.';
  args.push('--append-system-prompt', `"${BOT_POLICY}"`);
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
        const payload = {
          type: 'result',
          text: ev.result ?? '(빈 응답)',
          cost: ev.total_cost_usd,
          sessionId: ev.session_id,
        };
        rememberResult(chatId, payload); // 연결이 끊긴 클라이언트의 폴링 회수용
        send(res, payload);
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
      const payload = { type: 'result', text: '⏹ 요청을 중단했습니다.' }; // 사용자 중단은 오류가 아닌 안내로
      rememberResult(chatId, payload);
      finish(payload);
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

// 연결이 끊긴 클라이언트의 결과 회수 (확장이 폴링) — ts로 어느 요청의 결과인지 판별한다
app.get('/api/result', (req, res) => {
  const chatId = String(req.query.chatId || '');
  res.json({ result: lastResult.get(chatId) || null, running: running.has(chatId) });
});

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
