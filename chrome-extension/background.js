// 백그라운드 서비스 워커 — 콘텐츠 스크립트 대신 로컬 web-bridge(localhost:3456)와 통신한다.
// 페이지(CSP/CORS) 제약을 받지 않도록 fetch는 전부 여기서 수행하고, SSE 조각을 Port로 중계한다.
const BRIDGE = 'http://localhost:3456';

// 콘텐츠 스크립트 단발 요청 처리: whoami(탭 ID) / getConfig(계정 게이트 설정)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'whoami') {
    sendResponse({ tabId: sender.tab?.id ?? null });
    return;
  }
  if (msg && msg.type === 'getConfig') {
    fetch(`${BRIDGE}/api/config`)
      .then((r) => r.json())
      .then(sendResponse)
      .catch(() => sendResponse(null));
    return true; // 비동기 응답
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'mce-chat') return;
  let ctrl = null;

  port.onMessage.addListener(async (msg) => {
    if (msg.type === 'send') {
      ctrl = new AbortController();
      try {
        const resp = await fetch(`${BRIDGE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg.payload),
          signal: ctrl.signal,
        });
        if (!resp.ok) {
          const e = await resp.json().catch(() => ({}));
          port.postMessage({ type: 'error', message: e.error || `HTTP ${resp.status}` });
          port.postMessage({ type: 'done' });
          return;
        }
        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const line = chunk.split('\n').find((l) => l.startsWith('data: '));
            if (!line) {
              // 서버의 keep-alive 핑(: ping) — 서비스 워커 유휴 종료를 막기 위해 노옵 메시지로 중계
              port.postMessage({ type: 'ping' });
              continue;
            }
            try {
              port.postMessage(JSON.parse(line.slice(6)));
            } catch {
              /* 손상된 조각 무시 */
            }
          }
        }
        port.postMessage({ type: 'done' });
      } catch (err) {
        if (err.name !== 'AbortError') {
          port.postMessage({
            type: 'error',
            message: `브릿지 연결 실패: ${err.message} — web-bridge 서버(run-web.cmd)가 켜져 있는지 확인하세요.`,
          });
        }
        port.postMessage({ type: 'done' });
      }
    } else if (msg.type === 'stop') {
      fetch(`${BRIDGE}/api/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: msg.chatId }),
      }).catch(() => {});
    }
  });

  port.onDisconnect.addListener(() => ctrl?.abort());
});
