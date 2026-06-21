// MCE Slack 브릿지 — Slack 메시지를 받아 로컬 Claude Code(CLI)로 처리하고 결과를 회신한다.
// Socket Mode를 사용하므로 공개 IP·포트개방·터널이 필요 없다. 이 PC가 켜져 있기만 하면 된다.
//
// [Assistant 모드] 전용 어시스턴트 패널에서 대화한다(멘션 불필요·자동 스레드·"처리 중" 상태).
//   - 답변이 어시스턴트 스레드 안에만 쌓이므로 채널이 더러워지지 않는다.
//   - 채널 @멘션 방식도 호환용으로 함께 지원한다.
const path = require('path');
// .env 는 항상 이 파일 옆(slack-bridge/.env)에서 로드 — 실행 위치(cwd)와 무관하게 동작
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { App, Assistant } = require('@slack/bolt');
const { spawn } = require('child_process');
const fs = require('fs');

// 프로젝트 루트 = 이 파일의 상위 폴더 (mce-campaign 스킬·sf-mce-mcp가 연결된 곳)
const PROJECT_ROOT = path.resolve(__dirname, '..');

// 상태 영속화 파일 — 브릿지를 재시작/재연결해도 대화 연속성(--resume)과 인사 여부를 유지한다.
//   (메모리에만 두면 재시작 시 맥락이 날아가 "처음으로 돌아가고", 인사말이 다시 뜬다.)
const STATE_FILE = path.join(__dirname, '.bridge-state.json');

// 대화 스레드 → Claude Code session_id 매핑. 같은 스레드면 --resume 로 맥락을 이어간다.
const sessions = new Map();

// 대화 스레드 → 누적 사용량 { cost, turns }. "사용량" 으로 조회한다.
const usage = new Map();

// 이미 인사한 스레드 키 집합 — 재연결/재시작 때 재전송되는 thread_started 로 인사말이 중복되는 것을 막는다.
const greeted = new Set();

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    for (const [k, v] of Object.entries(s.sessions || {})) sessions.set(k, v);
    for (const [k, v] of Object.entries(s.usage || {})) usage.set(k, v);
    for (const k of s.greeted || []) greeted.add(k);
  } catch {
    /* 최초 실행이면 파일이 없다 — 무시 */
  }
}

function saveState() {
  try {
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({
        sessions: Object.fromEntries(sessions),
        usage: Object.fromEntries(usage),
        greeted: [...greeted],
      }),
      'utf8',
    );
  } catch (e) {
    console.error('상태 저장 실패:', e.message);
  }
}

loadState();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// 헤드리스로 claude 실행. 프롬프트는 stdin으로 넘겨 셸 인용 문제를 피한다.
function runClaude(prompt, resumeId) {
  return new Promise((resolve, reject) => {
    // --dangerously-skip-permissions: 봇은 사람이 "허용"을 못 누르므로 자동 승인이 필요.
    //   (보안상 부담되면 .claude/settings.json 의 allowedTools 화이트리스트로 대체 가능)
    const args = ['-p', '--output-format', 'json', '--dangerously-skip-permissions'];
    if (resumeId) args.push('--resume', resumeId);

    const child = spawn('claude', args, { cwd: PROJECT_ROOT, shell: true });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !stdout) {
        return reject(new Error(stderr || `claude 종료 코드 ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve({
          text: parsed.result ?? '(빈 응답)',
          sessionId: parsed.session_id,
          cost: parsed.total_cost_usd,
        });
      } catch {
        resolve({ text: stdout || stderr || '(출력 없음)', sessionId: undefined });
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// Markdown → Slack mrkdwn 변환.
//  Slack은 ① 마크다운 표(| ... |)를 못 그리고(파이프가 그대로 보임), ② 굵게는 **x**가 아니라 *x* 다.
//  → 표는 "후보별 목록" 형태로 풀고, **굵게**·### 헤딩을 Slack 문법으로 치환한다.
function toSlackMrkdwn(md) {
  const lines = md.split('\n');
  const out = [];
  const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l) => l.includes('-') && /^\s*\|?[\s:|-]+\|?\s*$/.test(l);
  const cells = (l) =>
    l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

  const linkText = (l, journeyName) => {
    const md = l.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/); // [텍스트](url)
    if (md) return `🔗 <${md[2]}|${md[1]}>`;
    const u = l.match(/https?:\/\/\S+/);
    if (!u) return null;
    const lbl = l.split(/[:：]/)[0].replace(/[*`]/g, '').trim(); // "접속 링크 : url" → "접속 링크"
    return `🔗 <${u[0]}|${journeyName || lbl || '바로가기'}>`;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 코드블록(```) 처리: 블록 안의 링크 줄은 밖으로 빼서 클릭 가능하게(저니명을 링크 텍스트로)
    if (line.trim().startsWith('```')) {
      const block = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '```') {
        block.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // 닫는 ``` 건너뜀
      const nameLine = block.find((l) => /journey\s*명|저니\s*명|저니\s*이름|journey\s*name/i.test(l));
      const journeyName = nameLine
        ? nameLine.split(/[:：]/).slice(1).join(':').replace(/\*\*/g, '').trim()
        : '';
      const kept = block.filter((l) => !/https?:\/\//.test(l) && !/\]\(https?:\/\//.test(l));
      const linkLines = block.filter((l) => /https?:\/\//.test(l) || /\]\(https?:\/\//.test(l));
      if (kept.some((l) => l.trim())) {
        out.push('```');
        for (const l of kept) out.push(l);
        out.push('```');
      }
      for (const l of linkLines) {
        const t = linkText(l, journeyName);
        if (t) out.push(t);
      }
      out.push('');
      continue;
    }

    if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const header = cells(line);
      i += 2; // 헤더 + 구분선 건너뜀

      // 2열 표(항목|내용, 예: STEP 4 결과 요약) → 저니 흐름도처럼 코드블록으로 줄맞춤 출력
      if (header.length <= 2) {
        const rows = [];
        while (i < lines.length && isRow(lines[i])) {
          const row = cells(lines[i]);
          const label = (row[0] || '').replace(/\*\*/g, '').trim();
          const val = (row[1] || '').replace(/\*\*/g, '').trim();
          if (label) rows.push([label, val]);
          i++;
        }
        if (rows.length) {
          // URL/링크가 든 행은 코드블록 안에 두면 클릭이 안 되므로 따로 뺀다
          const hasLink = (v) => /https?:\/\//.test(v) || /\]\(https?:\/\//.test(v);
          const plain = rows.filter(([, v]) => !hasLink(v));
          const links = rows.filter(([, v]) => hasLink(v));

          if (plain.length) {
            // 한글 등 전각 문자는 폭 2로 계산해 콜론 위치를 맞춘다
            const w = (s) =>
              [...s].reduce((a, ch) => a + (/[ᄀ-ᇿ⺀-꓏가-힣＀-￯]/.test(ch) ? 2 : 1), 0);
            const maxW = Math.max(...plain.map((r) => w(r[0])));
            out.push('```');
            for (const [label, val] of plain) {
              const pad = ' '.repeat(Math.max(0, maxW - w(label)));
              out.push(val ? `${label}${pad} : ${val}` : label);
            }
            out.push('```');
          }
          // 링크 행은 코드블록 밖에 — 긴 URL 대신 "저니명"을 링크 텍스트로 (<url|텍스트>)
          const nameRow = rows.find(([l]) => /journey\s*명|저니\s*명|저니\s*이름|journey\s*name/i.test(l));
          const journeyName = nameRow ? nameRow[1].replace(/\*\*/g, '').trim() : '';
          for (const [label, val] of links) {
            const md = val.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/); // [텍스트](url)
            let url, text;
            if (md) {
              text = md[1];
              url = md[2];
            } else {
              const u = val.match(/https?:\/\/\S+/);
              url = u ? u[0] : val;
              text = journeyName || label || '바로가기'; // 저니명 우선, 없으면 라벨
            }
            out.push(`🔗 <${url}|${text}>`);
          }
          out.push('');
        }
        continue;
      }

      // 3열 이상(캠페인 후보표 등) → 후보별 목록 + 구분선으로 펼침
      let n = 0;
      while (i < lines.length && isRow(lines[i])) {
        const row = cells(lines[i]);
        n++;
        if (n > 1) out.push('──────────────────────────────'); // 후보 사이 구분선
        const title = (row[0] || `항목 ${n}`).replace(/\*\*/g, '');
        out.push(`*${title}*`);
        for (let c = 1; c < header.length; c++) {
          const v = (row[c] || '').trim();
          if (v) out.push(`   • ${header[c]}: ${v}`);
        }
        i++;
      }
      out.push(''); // 표 종료 후 빈 줄
      continue;
    }
    out.push(line);
    i++;
  }

  let s = out.join('\n');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<$2|$1>'); // [텍스트](url) → Slack 링크
  s = s.replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/__(.+?)__/g, '*$1*'); // **굵게** → *굵게*
  s = s.replace(/^#{1,6}\s*(.+)$/gm, '*$1*'); // ### 헤딩 → *헤딩*
  s = s.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '──────────────────────────────'); // 가로 구분선
  s = s.replace(/\n{3,}/g, '\n\n'); // 과도한 빈 줄 정리
  return s;
}

// Slack 메시지 길이 한도에 맞춰 분할
function chunk(text, size = 3500) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

// 누적 사용량 적립
function addUsage(key, cost) {
  if (typeof cost !== 'number') return;
  const u = usage.get(key) || { cost: 0, turns: 0 };
  u.cost += cost;
  u.turns += 1;
  usage.set(key, u);
}

function usageText(key) {
  const u = usage.get(key);
  return u
    ? `📊 이 대화 누적 사용량\n   • 처리한 요청: ${u.turns}회\n   • 누적 비용: $${u.cost.toFixed(4)}`
    : '📊 이 대화에서 아직 처리한 요청이 없습니다.';
}

// 프롬프트를 처리해 Slack mrkdwn 결과 조각 배열을 돌려준다. (사용량 명령은 별도 처리)
async function handlePrompt(prompt, key) {
  const resumeId = sessions.get(key);
  const { text, sessionId, cost } = await runClaude(prompt, resumeId);
  if (sessionId) sessions.set(key, sessionId);
  addUsage(key, cost);
  saveState(); // 세션 매핑·사용량을 디스크에 보존 → 재시작해도 대화가 이어진다
  return chunk(toSlackMrkdwn(text));
}

// ─────────────────────────────────────────────────────────────
// Assistant 모드 — 전용 어시스턴트 패널 대화
// ─────────────────────────────────────────────────────────────
const assistant = new Assistant({
  threadStarted: async ({ event, say, setSuggestedPrompts }) => {
    // 재연결·재시작 시 Slack이 기존 스레드에 thread_started 를 다시 보내면 인사말이 중복된다.
    // 이미 인사한 스레드면 건너뛴다. (디스크에 보존되어 재시작 후에도 유지)
    const key = event?.assistant_thread?.thread_ts;
    if (key && greeted.has(key)) return;
    if (key) {
      greeted.add(key);
      saveState();
    }
    await say('안녕하세요! MCE 캠페인 어시스턴트입니다. 무엇을 도와드릴까요?');
    await setSuggestedPrompts({
      title: '이런 걸 할 수 있어요',
      prompts: [
        { title: '신규회원 캠페인 추천', message: '신규회원 캠페인 추천해줘' },
        { title: '최근 저니 목록', message: '최근 생성된 저니 3개 목록' },
        { title: '이탈 고객 캠페인 생성', message: '이탈 고객 캠페인 만들어줘' },
      ],
    });
  },

  userMessage: async ({ message, say, setStatus }) => {
    const prompt = (message.text || '').trim();
    if (!prompt) return;
    const key = message.thread_ts || message.ts; // 어시스턴트 스레드 단위

    if (/^사용량\b|^usage\b/i.test(prompt)) {
      await say(usageText(key));
      return;
    }

    let beat;
    try {
      await setStatus('처리 중…'); // 어시스턴트 패널의 "생각 중" 상태 표시
      // 하트비트: 저니 생성처럼 수 분 걸리는 작업 중 상태 표식이 사라지지 않도록 주기적 재설정
      beat = setInterval(() => setStatus('처리 중…').catch(() => {}), 25000);
      const parts = await handlePrompt(prompt, key);
      for (const p of parts) await say(p); // say 는 자동으로 이 스레드에만 게시
    } catch (err) {
      await say(`❌ 오류: ${err.message}`);
    } finally {
      if (beat) clearInterval(beat); // 작업 끝나면 하트비트 정지
    }
  },
});

app.assistant(assistant);

// ─────────────────────────────────────────────────────────────
// 채널 @멘션 모드 (호환용) — 스레드에 답한다
// ─────────────────────────────────────────────────────────────
app.event('app_mention', async ({ event, client }) => {
  const prompt = event.text.replace(/<@[^>]+>/g, '').trim();
  const threadTs = event.thread_ts || event.ts;
  if (!prompt) return;

  if (/^사용량\b|^usage\b/i.test(prompt)) {
    await client.chat.postMessage({ channel: event.channel, thread_ts: threadTs, text: usageText(threadTs) });
    return;
  }

  const thinking = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: threadTs,
    text: '⏳ 처리 중…',
  });

  try {
    const parts = await handlePrompt(prompt, threadTs);
    await client.chat.update({ channel: event.channel, ts: thinking.ts, text: parts[0] });
    for (let i = 1; i < parts.length; i++) {
      await client.chat.postMessage({ channel: event.channel, thread_ts: threadTs, text: parts[i] });
    }
  } catch (err) {
    await client.chat.update({ channel: event.channel, ts: thinking.ts, text: `❌ 오류: ${err.message}` });
  }
});

(async () => {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
    console.error('❌ .env 에 SLACK_BOT_TOKEN, SLACK_APP_TOKEN 을 먼저 채워주세요.');
    process.exit(1);
  }
  await app.start();
  console.log('⚡ MCE Slack 브릿지 실행 중 (Socket Mode · Assistant 모드)');
  console.log('   프로젝트 루트:', PROJECT_ROOT);
  console.log('   좌측 사이드바의 봇(어시스턴트)을 열어 바로 입력하거나, 채널에서 @멘션 하세요.');
})();
