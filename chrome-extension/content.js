// MCE 화면 위 챗봇 오버레이 — 우하단 플로팅 버튼 + 팝업 패널.
// Shadow DOM으로 MCE 페이지 스타일과 완전히 격리하고, 서버 통신은 background.js(Port)로 위임한다.
// 대화는 여러 개를 보관한다(대화 내역) — 각 대화가 자기 Claude 세션(--resume)을 유지한다.
(() => {
  if (window.__mceAssistantLoaded) return; // SPA 내비게이션 등으로 중복 주입 방지
  window.__mceAssistantLoaded = true;

  // ── 저장소: 대화 목록 (localStorage, v2 스키마) ─────────────
  const LS_KEY = 'mceExt.store.v2';
  const MAX_CONVS = 30;

  function loadDB() {
    try {
      const d = JSON.parse(localStorage.getItem(LS_KEY));
      if (d && Array.isArray(d.convs)) return d;
    } catch { /* 새로 만든다 */ }
    // v1(단일 대화) 마이그레이션
    const db = { convs: [], activeId: null };
    try {
      const old = JSON.parse(localStorage.getItem('mceExt.history')) || [];
      if (old.length) {
        const c = {
          id: localStorage.getItem('mceExt.chatId') || crypto.randomUUID(),
          sessionId: localStorage.getItem('mceExt.sessionId') || null,
          title: (old.find((m) => m.role === 'user')?.text || '이전 대화').slice(0, 40),
          messages: old,
          updatedAt: Date.now(),
        };
        db.convs.push(c);
        db.activeId = c.id;
      }
    } catch { /* 무시 */ }
    ['mceExt.history', 'mceExt.sessionId', 'mceExt.chatId'].forEach((k) => localStorage.removeItem(k));
    return db;
  }

  const db = loadDB();
  const saveDB = () => {
    if (db.convs.length > MAX_CONVS) db.convs.length = MAX_CONVS;
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  };
  const activeConv = () => db.convs.find((c) => c.id === db.activeId) || null;

  function newConv() {
    const c = { id: crypto.randomUUID(), sessionId: null, title: '', messages: [], updatedAt: Date.now() };
    db.convs.unshift(c);
    db.activeId = c.id;
    saveDB();
    return c;
  }

  function relTime(ts) {
    const m = Math.floor((Date.now() - ts) / 60000);
    if (m < 1) return '방금 전';
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}일 전`;
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  }

  let busy = false;
  let view = 'chat'; // 'chat' | 'history' | 'dash'
  // 진행 중인 턴의 봇 말풍선 DOM — 패널을 닫았다 열어도(showChat 재렌더) 같은 노드를 다시 붙여
  // 스트리밍 업데이트("처리 중…"→결과)가 끊기지 않게 한다
  let liveTurn = null; // { convId, node }

  // ── DOM 구성 ─────────────────────────────────────────────────
  const ICONS = {
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v4.7l3 1.8"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></svg>',
    shrink: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.4-8.4L3.4 3.6l-.01 6.6L13.5 12 3.39 13.8z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.7L20 9.5l-5.4 3.2L15.5 19 12 15.6 8.5 19l.9-6.3L4 9.5l6.1-1.8z"/></svg>',
  };
  // 봇 캐릭터 이미지 — 플로팅 버튼·헤더 아바타·말풍선 미니 아이콘·빈 화면 마크 공용
  const FAB_IMG = chrome.runtime.getURL('fab.png');

  const host = document.createElement('div');
  host.id = 'mce-assistant-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
  <style>
    :host { all: initial; }
    /* 글꼴은 확장에 내장된 Noto Sans KR(가변, fonts/) — @font-face는 Shadow DOM 안에서 동작하지 않아
       manifest의 content_scripts.css(fonts/fonts.css)로 문서에 등록하고 여기서는 이름만 참조한다 */
    * { box-sizing: border-box; margin: 0; font-family: "Noto Sans KR Variable", "Pretendard", "Malgun Gothic", -apple-system, "Segoe UI", sans-serif; }
    [hidden] { display: none !important; } /* authored display 값이 hidden 속성을 무시하지 못하게 전역 고정 */
    :host {
      --grad: linear-gradient(135deg, #0f2f6d 0%, #1d4ed8 55%, #2f7ae5 100%);
      --accent: #1d4ed8;
      --bg: #f7f8fc; --card: #ffffff; --text: #191d2b; --muted: #8a91a5;
      --border: #e9ebf3; --soft: #eaf1fd; --user-text: #fff;
      --shadow-lg: 0 24px 70px rgba(23, 25, 60, .28);
      --shadow-sm: 0 1px 2px rgba(23, 25, 60, .05), 0 4px 14px rgba(23, 25, 60, .05);
    }
    @media (prefers-color-scheme: dark) {
      :host {
        --bg: #12141d; --card: #1c1f2d; --text: #e9ebf5; --muted: #8d93a8;
        --border: #2b2f42; --soft: #1a2947; --accent: #5b9bf8;
        --shadow-lg: 0 24px 70px rgba(0, 0, 0, .6);
        --shadow-sm: 0 1px 2px rgba(0,0,0,.2), 0 4px 14px rgba(0,0,0,.2);
      }
    }

    /* ── 플로팅 버튼 (캐릭터 이미지 fab.png, v1.11.0~) ── */
    .fab {
      position: fixed; right: 26px; bottom: 26px; z-index: 2147483647;
      width: 84px; height: 84px; border: none; cursor: pointer;
      background: none; padding: 0;
      display: grid; place-items: center;
      transition: transform .2s cubic-bezier(.34,1.56,.64,1);
      touch-action: none;
    }
    .fab:hover { transform: scale(1.1) rotate(6deg); }
    .fab[hidden] { display: none; } /* 계정 게이트 숨김 — authored display:grid가 [hidden] 기본 규칙을 덮지 않게 명시 */
    .fab .fimg { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
    .fab .dot {
      position: absolute; right: 6px; top: 4px; width: 13px; height: 13px;
      background: #34d399; border: 2.5px solid #fff; border-radius: 50%;
    }
    .fab.busy .dot { background: #fbbf24; animation: blink 1s infinite; }

    /* ── 패널 ── */
    .panel {
      position: fixed; right: 26px; bottom: 26px; z-index: 2147483647;
      width: 448px; max-width: calc(100vw - 16px);
      height: 700px; max-height: calc(100vh - 16px);
      background: var(--bg); color: var(--text);
      border-radius: 22px; box-shadow: var(--shadow-lg);
      display: flex; flex-direction: column; overflow: hidden;
      font-size: 14px;
      transform-origin: bottom right;
      animation: panelIn .28s cubic-bezier(.21,1.02,.55,1);
      border: 1px solid var(--border);
    }
    @keyframes panelIn { from { opacity: 0; transform: scale(.92) translateY(14px); } to { opacity: 1; transform: none; } }
    .panel[hidden] { display: none; }

    /* ── 크기 조절 핸들 (8방향) ── */
    .rz { position: absolute; z-index: 50; }
    .rz-n  { top: 0; left: 12px; right: 12px; height: 6px; cursor: ns-resize; }
    .rz-s  { bottom: 0; left: 12px; right: 12px; height: 6px; cursor: ns-resize; }
    .rz-e  { right: 0; top: 12px; bottom: 12px; width: 6px; cursor: ew-resize; }
    .rz-w  { left: 0; top: 12px; bottom: 12px; width: 6px; cursor: ew-resize; }
    .rz-ne { top: 0; right: 0; width: 14px; height: 14px; cursor: nesw-resize; }
    .rz-nw { top: 0; left: 0; width: 14px; height: 14px; cursor: nwse-resize; }
    .rz-se { bottom: 0; right: 0; width: 14px; height: 14px; cursor: nwse-resize; }
    .rz-sw { bottom: 0; left: 0; width: 14px; height: 14px; cursor: nesw-resize; }

    /* ── 헤더 ── */
    .head {
      display: flex; align-items: center; gap: 11px;
      padding: 15px 16px; background: var(--grad); color: #fff; flex: none;
      cursor: grab; touch-action: none;
    }
    .head:active { cursor: grabbing; }
    .head .meta { flex: 1; min-width: 0; }
    .head .title { font-weight: 700; font-size: 15px; letter-spacing: -.2px; }
    .head .status { font-size: 11.5px; opacity: .85; margin-top: 1px; display: flex; align-items: center; gap: 5px; }
    .head .status::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #34d399; }
    .head .status.busy::before { background: #fbbf24; animation: blink 1s infinite; }
    @keyframes blink { 50% { opacity: .3; } }
    .hbtn {
      border: none; background: rgba(255,255,255,.14); color: #fff;
      width: 32px; height: 32px; border-radius: 10px; cursor: pointer;
      display: grid; place-items: center; transition: background .15s;
      flex: none;
    }
    .hbtn:hover { background: rgba(255,255,255,.3); }
    .hbtn svg { width: 17px; height: 17px; }

    /* ── 본문 스크롤 영역 ── */
    .body { flex: 1; overflow-y: auto; padding: 16px 14px; scroll-behavior: smooth; }
    .body::-webkit-scrollbar { width: 5px; }
    .body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

    /* ── 빈 화면 ── */
    .empty { text-align: center; padding: 34px 14px 20px; animation: fadeUp .3s ease; }
    .empty .mark {
      width: 76px; height: 76px; margin: 0 auto 14px;
      display: grid; place-items: center;
    }
    .empty .mark img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
    .empty h2 { font-size: 17px; letter-spacing: -.3px; margin-bottom: 5px; }
    .empty p { color: var(--muted); font-size: 12.5px; margin-bottom: 20px; }
    .chips { display: flex; flex-direction: column; gap: 9px; }
    .chip {
      display: flex; align-items: center; gap: 10px; text-align: left;
      border: 1px solid var(--border); background: var(--card); color: var(--text);
      border-radius: 14px; padding: 12px 14px; cursor: pointer; font-size: 13px;
      box-shadow: var(--shadow-sm); transition: transform .15s, border-color .15s;
    }
    .chip:hover { transform: translateY(-1.5px); border-color: var(--accent); }
    .chip .ci {
      width: 30px; height: 30px; border-radius: 9px; flex: none;
      background: var(--soft); color: var(--accent);
      display: grid; place-items: center; font-size: 15px;
    }

    /* ── 메시지 ── */
    .msg { display: flex; gap: 8px; margin: 10px 0; animation: fadeUp .25s ease; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .msg.user { justify-content: flex-end; }
    .msg.bot .mini {
      width: 44px; height: 44px; flex: none; margin-top: 0;
      display: grid; place-items: center;
    }
    .msg.bot .mini img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
    .bubble { max-width: 84%; padding: 10px 14px; border-radius: 16px; line-height: 1.65; word-break: break-word; }
    .msg.user .bubble {
      background: var(--grad); color: var(--user-text);
      border-bottom-right-radius: 5px; white-space: pre-wrap;
      box-shadow: 0 4px 14px rgba(29, 78, 216, .3);
    }
    .msg.bot .bubble {
      background: var(--card); border: 1px solid var(--border);
      border-top-left-radius: 5px; flex: 1; box-shadow: var(--shadow-sm);
    }

    /* ── 진행 과정 ── */
    .progress { font-size: 12px; color: var(--muted); }
    .progress .step {
      display: flex; gap: 7px; padding: 3px 0 3px 2px; align-items: baseline;
      border-left: 2px solid var(--border); padding-left: 10px; margin-left: 4px;
    }
    .progress .step .detail { opacity: .65; font-size: 11px; }
    .typing { display: flex; gap: 4px; padding: 6px 0 2px 14px; align-items: center; }
    .typing .tlabel { font-style: normal; font-size: 12px; color: var(--muted); margin-left: 7px; }
    .typing span {
      width: 6px; height: 6px; border-radius: 50%; background: var(--accent);
      animation: bounce 1.2s infinite;
    }
    .typing span:nth-child(2) { animation-delay: .15s; }
    .typing span:nth-child(3) { animation-delay: .3s; }
    @keyframes bounce { 0%, 60%, 100% { transform: none; opacity: .35; } 30% { transform: translateY(-4px); opacity: 1; } }
    details.pwrap { margin-bottom: 7px; }
    details.pwrap summary {
      cursor: pointer; font-size: 11.5px; color: var(--muted); user-select: none;
      list-style: none; display: inline-flex; align-items: center; gap: 5px;
      background: var(--soft); color: var(--accent); border-radius: 999px; padding: 3px 11px;
    }
    details.pwrap summary::-webkit-details-marker { display: none; }
    details.pwrap[open] summary { margin-bottom: 6px; }

    /* ── 마크다운 ── */
    .answer h1, .answer h2, .answer h3 { margin: 11px 0 5px; font-size: 1.04em; letter-spacing: -.2px; }
    .answer p { margin: 5px 0; }
    .answer ul, .answer ol { margin: 5px 0; padding-left: 20px; }
    .answer pre { background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 9px 11px; overflow-x: auto; font-size: 12px; margin: 7px 0; }
    .answer code { background: var(--soft); border-radius: 5px; padding: 1px 5px; font-size: .88em; }
    .answer pre code { background: none; padding: 0; }
    .answer table { border-collapse: collapse; margin: 8px 0; display: block; overflow-x: auto; max-width: 100%; font-size: 12.5px; }
    /* 말풍선의 break-word가 셀 안에서 글자 단위로 꺾는 것을 막는다 — 셀은 한 줄 유지, 넘치면 표 자체가 가로 스크롤 */
    .answer th, .answer td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; white-space: nowrap; word-break: normal; }
    .answer th { background: var(--soft); }
    .answer a { color: var(--accent); font-weight: 600; text-decoration: none; }
    .answer a:hover { text-decoration: underline; }
    /* 산출물 다운로드 칩 (📎 파일명) */
    .answer a.dl {
      display: inline-flex; align-items: center; gap: 5px;
      background: var(--soft); border: 1px solid var(--border); border-radius: 999px;
      padding: 2px 11px; margin: 1px 0; font-size: 12px;
      max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .answer a.dl:hover { border-color: var(--accent); text-decoration: none; }
    .answer hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
    .answer.error { color: #ef4444; }
    /* SFMC 인증 만료 시 말풍선에 붙는 재인증 안내 (v1.15.1~) */
    .reauth { margin-top: 10px; padding: 10px 12px; border: 1px solid #fca5a5; background: rgba(239,68,68,.07); border-radius: 10px; }
    .reauth .rmsg { font-size: 12px; margin-bottom: 8px; opacity: .85; line-height: 1.5; }
    .reauth .rbtn { border: none; background: #dc2626; color: #fff; padding: 7px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 12.5px; }
    .reauth .rbtn:disabled { opacity: .6; cursor: default; }

    /* ── 대화 내역 ── */
    .hist-title { font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: .4px; margin: 2px 4px 10px; }
    .hitem {
      display: flex; align-items: center; gap: 10px;
      background: var(--card); border: 1px solid var(--border); border-radius: 14px;
      padding: 12px 14px; margin-bottom: 8px; cursor: pointer;
      box-shadow: var(--shadow-sm); transition: transform .15s, border-color .15s;
      animation: fadeUp .25s ease;
    }
    .hitem:hover { transform: translateY(-1.5px); border-color: var(--accent); }
    .hitem.active { border-color: var(--accent); background: var(--soft); }
    .hitem .info { flex: 1; min-width: 0; }
    .hitem .t { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .hitem .s { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
    .hitem .del {
      border: none; background: none; color: var(--muted); cursor: pointer;
      width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center;
      opacity: 0; transition: opacity .15s;
      flex: none;
    }
    .hitem:hover .del { opacity: 1; }
    .hitem .del:hover { color: #ef4444; background: var(--bg); }
    .hitem .del svg { width: 15px; height: 15px; }
    .hist-empty { text-align: center; color: var(--muted); font-size: 13px; padding: 40px 0; }

    /* ── 성과 대시보드 뷰 (패널 내장) ── */
    .dash-meta { font-size: 11px; color: var(--muted); margin: 0 4px 10px; display: flex; justify-content: space-between; gap: 8px; }
    .rangechips { display: flex; gap: 6px; margin: 0 0 10px; }
    .rchip {
      border: 1px solid var(--border); background: var(--card); color: var(--muted);
      border-radius: 999px; padding: 4px 13px; font-size: 12px; font-weight: 600; cursor: pointer;
      transition: border-color .15s;
    }
    .rchip:hover { border-color: var(--accent); }
    .rchip.active { background: var(--soft); color: var(--accent); border-color: var(--accent); }
    .xticks { display: flex; justify-content: space-between; font-size: 10.5px; color: var(--muted); margin-top: 3px; }
    .sparkcard .tip {
      position: absolute; top: 8px; left: 4px; z-index: 5; pointer-events: none;
      background: var(--card); border: 1px solid var(--border); border-radius: 8px;
      box-shadow: var(--shadow-sm); padding: 5px 9px; font-size: 11px; white-space: nowrap;
    }
    .sparkcard .tip b { color: var(--accent); margin-right: 4px; }
    .dash-sec { font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: .4px; margin: 16px 4px 8px; }
    .kpis { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .kpi {
      background: var(--card); border: 1px solid var(--border); border-radius: 14px;
      padding: 11px 13px; box-shadow: var(--shadow-sm);
    }
    .kpi .kl { font-size: 11.5px; color: var(--muted); }
    .kpi .kv { font-size: 19px; font-weight: 800; letter-spacing: -.4px; margin-top: 2px; }
    .kpi .kd { font-size: 11px; margin-top: 3px; font-weight: 600; }
    .kpi .kd.up { color: #10b981; }
    .kpi .kd.down { color: #ef4444; }
    .kpi .kd.flat { color: var(--muted); }
    .sparkcard {
      position: relative;
      background: var(--card); border: 1px solid var(--border); border-radius: 14px;
      padding: 12px 13px 9px; box-shadow: var(--shadow-sm);
    }
    .sparkcard svg { width: 100%; height: 64px; display: block; }
    .legend { display: flex; gap: 14px; font-size: 11px; color: var(--muted); margin-top: 6px; }
    .legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; }
    .dtwrap {
      background: var(--card); border: 1px solid var(--border); border-radius: 14px;
      overflow: hidden; box-shadow: var(--shadow-sm);
    }
    .dtable { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .dtable th, .dtable td { padding: 8px 11px; text-align: right; border-bottom: 1px solid var(--border); white-space: nowrap; }
    .dtable th:first-child, .dtable td:first-child { text-align: left; }
    .dtable td:first-child { max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
    .dtable th { background: var(--soft); color: var(--accent); font-size: 11.5px; font-weight: 700; }
    .dtable tr:last-child td { border-bottom: none; }
    .ins {
      background: var(--card); border: 1px solid var(--border); border-left-width: 4px;
      border-radius: 12px; padding: 10px 12px; margin-bottom: 8px; box-shadow: var(--shadow-sm);
    }
    .ins .it { font-size: 12.5px; font-weight: 700; line-height: 1.45; }
    .ins .ib { font-size: 11.5px; color: var(--muted); margin-top: 3px; line-height: 1.55; }
    .ins .ia {
      margin-top: 8px; border: 1px solid var(--border); background: var(--soft); color: var(--accent);
      border-radius: 999px; padding: 3px 12px; font-size: 11.5px; font-weight: 600; cursor: pointer;
    }
    .ins .ia:hover { border-color: var(--accent); }

    /* ── 파일 첨부 (드래그&드롭) ── */
    .dropzone {
      position: absolute; inset: 0; z-index: 60; pointer-events: none;
      display: grid; place-items: center;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
      border: 2.5px dashed var(--accent); border-radius: 22px;
      font-weight: 700; font-size: 14px; color: var(--accent);
      backdrop-filter: blur(2px);
    }
    .attach { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 2px 8px; }
    .attach .achip {
      display: inline-flex; align-items: center; gap: 6px; max-width: 100%;
      background: var(--soft); color: var(--accent);
      border: 1px solid var(--border); border-radius: 999px;
      padding: 3px 6px 3px 11px; font-size: 12px; font-weight: 600;
    }
    .attach .achip .al { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .attach .achip.err { color: #ef4444; background: transparent; }
    .attach .achip .rm {
      border: none; background: none; color: var(--muted); cursor: pointer;
      width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center;
      font-size: 11px; flex: none;
    }
    .attach .achip .rm:hover { color: #ef4444; }

    /* ── 입력창 ── */
    .foot { padding: 12px 14px 14px; background: var(--bg); flex: none; }
    .composer {
      display: flex; gap: 7px; align-items: flex-end;
      background: var(--card); border: 1.5px solid var(--border); border-radius: 16px;
      padding: 7px 8px; box-shadow: var(--shadow-sm);
      transition: border-color .15s;
    }
    .attachb {
      flex: none; border: none; border-radius: 11px; width: 36px; height: 36px;
      cursor: pointer; display: grid; place-items: center;
      background: var(--soft); color: var(--accent); transition: transform .15s;
    }
    .attachb:hover { transform: scale(1.07); }
    .attachb svg { width: 16px; height: 16px; }
    .composer:focus-within { border-color: var(--accent); }
    textarea {
      flex: 1; border: none; resize: none; background: transparent; color: var(--text);
      font: inherit; line-height: 1.5; max-height: 120px; outline: none; padding: 5px 0;
    }
    textarea::placeholder { color: var(--muted); }
    .send, .stopb {
      flex: none; border: none; border-radius: 11px; width: 36px; height: 36px;
      cursor: pointer; display: grid; place-items: center; transition: transform .15s, opacity .15s;
    }
    .send { background: var(--grad); color: #fff; }
    .send:hover:not(:disabled) { transform: scale(1.07); }
    .send:disabled { opacity: .35; cursor: default; box-shadow: none; }
    .send svg, .stopb svg { width: 16px; height: 16px; }
    .stopb { background: #ef4444; color: #fff; }
  </style>

  <button class="fab" title="MCE Bot"><img class="fimg" draggable="false" alt="MCE Bot" src="${FAB_IMG}"><span class="dot"></span></button>

  <div class="panel" hidden>
    <div class="head">
      <div class="meta">
        <div class="title">MCE Bot</div>
        <div class="status">대기 중</div>
      </div>
      <button class="hbtn dash" type="button" title="성과 대시보드">${ICONS.chart}</button>
      <button class="hbtn hist" type="button" title="대화 내역">${ICONS.history}</button>
      <button class="hbtn new" type="button" title="새 대화">${ICONS.plus}</button>
      <button class="hbtn max" type="button" title="최대화/복원">${ICONS.expand}</button>
      <button class="hbtn close" type="button" title="닫기">${ICONS.close}</button>
    </div>
    <div class="dropzone" hidden>📎 여기에 놓으면 파일이 첨부됩니다</div>
    <div class="body"></div>
    <div class="foot">
      <div class="attach" style="display:none"></div>
      <form class="composer">
        <button class="attachb" type="button" title="파일 첨부">${ICONS.plus}</button>
        <input class="fpick" type="file" multiple hidden accept=".xlsx,.xlsm,.csv,.txt,.sql,.md,.json">
        <textarea rows="1" placeholder="메시지 입력…"></textarea>
        <button class="send" type="submit" title="전송">${ICONS.send}</button>
        <button class="stopb" type="button" title="중지" hidden>${ICONS.stop}</button>
      </form>
    </div>
  </div>`;
  document.documentElement.appendChild(host);

  const $ = (s) => shadow.querySelector(s);
  const fab = $('.fab');
  const panel = $('.panel');
  const bodyEl = $('.body');
  const statusEl = $('.status');
  const titleEl = $('.title');
  const maxBtn = $('.max');
  const footEl = $('.foot');
  const inputEl = $('textarea');
  const sendBtn = $('.send');
  const stopBtn = $('.stopb');
  const dropEl = $('.dropzone');
  const attachEl = $('.attach');

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── 산출물 다운로드 링크 ────────────────────────────────────
  // 답변에 나오는 산출물 경로(정의서 xlsx·분석 리포트 등)를 web-bridge의 /api/file 다운로드 링크로 바꾼다.
  // 서버가 campaign_definitions·reports 폴더만 허용하므로 그 경로 패턴만 링크화한다.
  const FILE_BASE = 'http://localhost:3456/api/file?path=';
  // 하위 폴더 그룹은 lazy(*?) — greedy면 한 줄에 경로가 2개 있을 때 사이 텍스트까지 삼켜 하나로 매칭된다
  const FILE_RE = /(?:[A-Za-z]:[\\/])?(?:[^\\/\n:*?"<>|]+[\\/])*((?:campaign_definitions|reports)[\\/](?:[^\\/\n:*?"<>|]+[\\/])*?[^\\/\n:*?"<>|]+?\.(?:xlsx|xlsm|csv|pptx|pdf|png|md|html))/gi;
  const toDownloadHref = (tail) => FILE_BASE + encodeURIComponent(tail.replace(/\\/g, '/'));

  // 봇이 마크다운 링크로 쓴 로컬 경로([정의서](C:\...\campaign_definitions\..))를 다운로드 링크로 전환
  function fileLink(a) {
    let href = a.getAttribute('href') || '';
    try { href = decodeURIComponent(href); } catch { /* 원문 그대로 검사 */ }
    FILE_RE.lastIndex = 0;
    const m = FILE_RE.exec(href);
    if (!m) return false;
    a.classList.add('dl');
    a.href = toDownloadHref(m[1]);
    a.title = `다운로드: ${m[1].replace(/\\/g, '/')}`;
    return true;
  }

  // 본문 텍스트에 그대로 적힌 경로를 "📎 파일명" 다운로드 칩으로 치환
  function linkifyFiles(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n; (n = walker.nextNode()); ) if (!n.parentElement?.closest('a')) nodes.push(n);
    for (const n of nodes) {
      const text = n.nodeValue;
      FILE_RE.lastIndex = 0;
      let m, last = 0, frag = null;
      while ((m = FILE_RE.exec(text))) {
        frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const a = document.createElement('a');
        a.className = 'dl';
        a.href = toDownloadHref(m[1]);
        a.title = `다운로드: ${m[1].replace(/\\/g, '/')}`;
        a.textContent = `📎 ${m[1].split(/[\\/]/).pop()}`;
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (!frag) continue;
      frag.appendChild(document.createTextNode(text.slice(last)));
      n.replaceWith(frag);
    }
  }

  function renderMd(el, md) {
    el.innerHTML = marked.parse(md);
    el.querySelectorAll('a').forEach((a) => {
      if (fileLink(a)) return; // 다운로드 링크는 새 탭 불필요 (Content-Disposition으로 바로 저장)
      a.target = '_blank';
      a.rel = 'noopener';
    });
    linkifyFiles(el);
  }
  const scrollBottom = () => (bodyEl.scrollTop = bodyEl.scrollHeight);

  function setBusy(v, label) {
    busy = v;
    sendBtn.disabled = v;
    stopBtn.hidden = !v;
    statusEl.textContent = v ? (label || '처리 중…') : '대기 중';
    statusEl.classList.toggle('busy', v);
    fab.classList.toggle('busy', v); // 플로팅 버튼 상태 점도 처리 중(노랑 깜빡임)으로 동기화
  }

  // ── 메시지 렌더링 ───────────────────────────────────────────
  function userNode(text) {
    const div = document.createElement('div');
    div.className = 'msg user';
    div.innerHTML = '<div class="bubble"></div>';
    div.firstElementChild.textContent = text;
    return div;
  }

  function botNode() {
    const div = document.createElement('div');
    div.className = 'msg bot';
    div.innerHTML = `<div class="mini"><img draggable="false" alt="" src="${FAB_IMG}"></div><div class="bubble"></div>`;
    const bubble = div.querySelector('.bubble');
    const answer = document.createElement('div');
    answer.className = 'answer';
    bubble.appendChild(answer);
    return { node: div, bubble, answer };
  }

  function emptyStateHTML() {
    return `
    <div class="empty">
      <div class="mark"><img draggable="false" alt="" src="${FAB_IMG}"></div>
      <h2>무엇을 도와드릴까요?</h2>
      <p>MCE에서 필요한 작업을 요청해주세요</p>
      <div class="chips">
        <button class="chip" data-msg="생성 가능한 캠페인 추천해줘"><span class="ci">✨</span>생성 가능한 캠페인 추천</button>
        <button class="chip" data-msg="최근 생성된 저니 목록 조회해줘"><span class="ci">🧭</span>최근 저니 목록 조회</button>
        <button class="chip" data-msg="MCE 초기 세팅 점검해줘 (발송 준비 상태 확인)"><span class="ci">🛠️</span>MCE 세팅 점검</button>
      </div>
    </div>`;
  }

  function showChat() {
    view = 'chat';
    titleEl.textContent = 'MCE Bot';
    footEl.style.display = '';
    bodyEl.innerHTML = '';
    const conv = activeConv();
    if (!conv || !conv.messages.length) {
      bodyEl.innerHTML = emptyStateHTML();
      bodyEl.querySelectorAll('.chip').forEach((c) =>
        c.addEventListener('click', () => sendMessage(c.dataset.msg)),
      );
      return;
    }
    for (const m of conv.messages) {
      if (m.role === 'user') bodyEl.appendChild(userNode(m.text));
      else {
        const { node, answer } = botNode();
        renderMd(answer, m.text);
        bodyEl.appendChild(node);
      }
    }
    // 처리 중인 턴이 이 대화 것이면 진행 중 말풍선(처리 중…)을 다시 붙인다
    if (busy && liveTurn && liveTurn.convId === conv.id) bodyEl.appendChild(liveTurn.node);
    scrollBottom();
  }

  // ── 대화 내역 화면 ──────────────────────────────────────────
  function showHistory() {
    view = 'history';
    titleEl.textContent = '대화 내역';
    footEl.style.display = 'none';
    bodyEl.innerHTML = '<div class="hist-title">최근 대화</div>';
    const convs = db.convs.filter((c) => c.messages.length);
    if (!convs.length) {
      bodyEl.innerHTML += '<div class="hist-empty">아직 대화 내역이 없습니다</div>';
      return;
    }
    for (const c of convs) {
      const item = document.createElement('div');
      item.className = 'hitem' + (c.id === db.activeId ? ' active' : '');
      item.innerHTML = `
        <div class="info">
          <div class="t"></div>
          <div class="s">${relTime(c.updatedAt)} · 메시지 ${c.messages.length}개</div>
        </div>
        <button class="del" title="삭제">${ICONS.trash}</button>`;
      item.querySelector('.t').textContent = c.title || '(제목 없음)';
      item.addEventListener('click', () => {
        if (busy) return;
        db.activeId = c.id;
        saveDB();
        showChat();
      });
      item.querySelector('.del').addEventListener('click', (e) => {
        e.stopPropagation();
        if (busy) return;
        db.convs = db.convs.filter((x) => x.id !== c.id);
        if (db.activeId === c.id) db.activeId = db.convs[0]?.id || null;
        saveDB();
        showHistory();
      });
      bodyEl.appendChild(item);
    }
  }

  // ── 성과 대시보드 뷰 (패널 내장) ────────────────────────────
  // 📊 버튼 → web-bridge의 /api/dashboard-data(SENDLOG 집계 JSON)를 background 경유로 받아
  // KPI 카드 + 추이 스파크라인 + 저니 TOP + 인사이트를 패널 안에 즉시 렌더한다. Claude 호출 없음(무비용).
  const fmtN = (n) => Number(n || 0).toLocaleString('ko-KR');
  const rate = (a, b) => (b ? (a / b) * 100 : 0);
  let dashData = null; // 마지막 조회 데이터 — 기간 전환 시 재조회 없이 재렌더
  let dashRange = 14; // 기간 필터 (7 | 14 | 30일)

  function kpiCard(label, value, delta, unit, invert) {
    // delta: 이전 동일 기간 대비 변화(null이면 비교 기간 부족). invert=true면 감소가 좋은 지표(바운스)
    let cls = 'flat', txt = '비교 기간 없음';
    if (delta !== null) {
      const d = Math.round(delta * 10) / 10;
      if (Math.abs(d) >= 0.1) {
        cls = (invert ? d < 0 : d > 0) ? 'up' : 'down';
        txt = `${d > 0 ? '▲' : '▼'} ${Math.abs(d)}${unit} vs 이전 ${dashRange}일`;
      } else {
        txt = '변화 없음';
      }
    }
    const div = document.createElement('div');
    div.className = 'kpi';
    div.innerHTML = `<div class="kl"></div><div class="kv"></div><div class="kd ${cls}"></div>`;
    div.querySelector('.kl').textContent = label;
    div.querySelector('.kv').textContent = value;
    div.querySelector('.kd').textContent = txt;
    return div;
  }

  function trendCard(daily) {
    // 선택 기간의 발송·오픈 추이 — 라이브러리 없이 SVG polyline + hover 시 일자별 수치 툴팁
    const rows = daily.slice(-dashRange);
    const max = Math.max(1, ...rows.map((r) => r.sent));
    const W = 300, H = 64, PAD = 4;
    const xAt = (i) => PAD + (i / Math.max(1, rows.length - 1)) * (W - PAD * 2);
    const yAt = (v) => H - PAD - ((v || 0) / max) * (H - PAD * 2);
    const pts = (key) => rows.map((r, i) => `${xAt(i).toFixed(1)},${yAt(r[key]).toFixed(1)}`).join(' ');
    const fmtD = (iso) => {
      const d = new Date(iso + 'T00:00:00');
      return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const card = document.createElement('div');
    card.className = 'sparkcard';
    card.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <line class="guide" x1="0" x2="0" y1="0" y2="${H}" stroke="var(--muted)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" visibility="hidden"/>
        <polyline points="${pts('sent')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        <polyline points="${pts('open')}" fill="none" stroke="#34d399" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="xticks"><span></span><span></span><span></span></div>
      <div class="legend">
        <span><i style="background:var(--accent)"></i>발송</span>
        <span><i style="background:#34d399"></i>오픈</span>
        <span style="margin-left:auto">최근 ${rows.length}일</span>
      </div>
      <div class="tip" hidden></div>`;
    const ticks = card.querySelectorAll('.xticks span');
    ticks[0].textContent = fmtD(rows[0].date);
    ticks[1].textContent = rows.length > 2 ? fmtD(rows[Math.floor((rows.length - 1) / 2)].date) : '';
    ticks[2].textContent = fmtD(rows[rows.length - 1].date);

    // hover 툴팁 — 마우스 x좌표를 가장 가까운 날짜 인덱스로 환산해 세로 가이드선 + 수치 표시
    const svg = card.querySelector('svg');
    const guide = card.querySelector('.guide');
    const tip = card.querySelector('.tip');
    svg.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const idx = Math.min(rows.length - 1, Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * (rows.length - 1))));
      const r = rows[idx];
      guide.setAttribute('x1', xAt(idx));
      guide.setAttribute('x2', xAt(idx));
      guide.setAttribute('visibility', 'visible');
      tip.hidden = false;
      tip.innerHTML = '<b></b><span></span>';
      tip.firstElementChild.textContent = fmtD(r.date);
      tip.lastElementChild.textContent = `발송 ${fmtN(r.sent)} · 오픈 ${fmtN(r.open)} · 클릭 ${fmtN(r.click)} · 바운스 ${fmtN(r.bounce)}`;
      const cardRect = card.getBoundingClientRect();
      const x = Math.max(4, Math.min(e.clientX - cardRect.left + 12, cardRect.width - tip.offsetWidth - 6));
      tip.style.left = `${x}px`;
    });
    svg.addEventListener('mouseleave', () => {
      guide.setAttribute('visibility', 'hidden');
      tip.hidden = true;
    });
    return card;
  }

  function showDash() {
    view = 'dash';
    titleEl.textContent = '성과 대시보드';
    footEl.style.display = 'none';
    bodyEl.innerHTML = '<div class="hist-empty">불러오는 중…</div>';
    chrome.runtime.sendMessage({ type: 'getDash' }, (data) => {
      if (view !== 'dash') return; // 기다리는 사이 다른 화면으로 이동함
      if (chrome.runtime.lastError || !data || !Array.isArray(data.daily) || !data.daily.length) {
        bodyEl.innerHTML =
          '<div class="hist-empty">대시보드 데이터를 불러오지 못했습니다.<br>web-bridge 서버 상태를 확인해 주세요.</div>';
        return;
      }
      renderDash(data);
    });
  }

  function renderDash(data) {
    dashData = data;
    bodyEl.innerHTML = '';
    const daily = data.daily; // 날짜 오름차순
    const cur = daily.slice(-dashRange);
    const prev = daily.slice(-dashRange * 2, -dashRange);
    const hasPrev = prev.length === dashRange; // 이전 동일 기간이 온전히 있어야 비교 표시
    const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);
    const cs = sum(cur, 'sent'), co = sum(cur, 'open'), cc = sum(cur, 'click'), cb = sum(cur, 'bounce');
    const ps = sum(prev, 'sent'), po = sum(prev, 'open'), pc = sum(prev, 'click'), pb = sum(prev, 'bounce');

    const meta = document.createElement('div');
    meta.className = 'dash-meta';
    const srcLabel = data.source === 'sample' ? '⚠ 샘플 데이터' : 'SENDLOG_History DE';
    meta.innerHTML = '<span></span><span></span>';
    meta.firstElementChild.textContent = `데이터 소스: ${srcLabel}`;
    meta.lastElementChild.textContent = data.generatedAt ? `갱신 ${relTime(new Date(data.generatedAt).getTime())}` : '';
    bodyEl.appendChild(meta);

    // 기간 필터 — 재조회 없이 같은 데이터로 즉시 재렌더
    const chips = document.createElement('div');
    chips.className = 'rangechips';
    for (const n of [7, 14, 30]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rchip' + (dashRange === n ? ' active' : '');
      b.textContent = `${n}일`;
      b.addEventListener('click', () => {
        if (dashRange === n) return;
        dashRange = n;
        renderDash(dashData);
      });
      chips.appendChild(b);
    }
    bodyEl.appendChild(chips);

    const kpis = document.createElement('div');
    kpis.className = 'kpis';
    kpis.append(
      kpiCard(`발송 (${dashRange}일)`, fmtN(cs), hasPrev && ps ? ((cs - ps) / ps) * 100 : null, '%', false),
      kpiCard('오픈율', `${(Math.round(rate(co, cs) * 10) / 10)}%`, hasPrev && ps ? rate(co, cs) - rate(po, ps) : null, '%p', false),
      kpiCard('클릭율', `${(Math.round(rate(cc, cs) * 10) / 10)}%`, hasPrev && ps ? rate(cc, cs) - rate(pc, ps) : null, '%p', false),
      kpiCard('바운스율', `${(Math.round(rate(cb, cs) * 10) / 10)}%`, hasPrev && ps ? rate(cb, cs) - rate(pb, ps) : null, '%p', true),
    );
    bodyEl.appendChild(kpis);

    const secTrend = document.createElement('div');
    secTrend.className = 'dash-sec';
    secTrend.textContent = '발송·오픈 추이';
    bodyEl.append(secTrend, trendCard(daily));

    const secJ = document.createElement('div');
    secJ.className = 'dash-sec';
    secJ.textContent = '저니별 성과 (전체 기간)';
    bodyEl.appendChild(secJ);
    const wrap = document.createElement('div');
    wrap.className = 'dtwrap';
    const tbl = document.createElement('table');
    tbl.className = 'dtable';
    tbl.innerHTML = '<thead><tr><th>저니</th><th>발송</th><th>오픈율</th><th>클릭율</th></tr></thead><tbody></tbody>';
    const tb = tbl.querySelector('tbody');
    for (const j of (data.journeys || []).slice().sort((a, b) => b.sent - a.sent).slice(0, 6)) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td></td><td></td><td></td><td></td>';
      tr.children[0].textContent = j.name;
      tr.children[0].title = j.name;
      tr.children[1].textContent = fmtN(j.sent);
      tr.children[2].textContent = `${Math.round(rate(j.open, j.sent) * 10) / 10}%`;
      tr.children[3].textContent = `${Math.round(rate(j.click, j.sent) * 10) / 10}%`;
      tb.appendChild(tr);
    }
    wrap.appendChild(tbl);
    bodyEl.appendChild(wrap);

    if (Array.isArray(data.insights) && data.insights.length) {
      const secI = document.createElement('div');
      secI.className = 'dash-sec';
      secI.textContent = '인사이트';
      bodyEl.appendChild(secI);
      const COLORS = { good: '#10b981', warning: '#f59e0b', serious: '#ef4444' };
      for (const ins of data.insights) {
        const card = document.createElement('div');
        card.className = 'ins';
        card.style.borderLeftColor = COLORS[ins.level] || 'var(--accent)';
        card.innerHTML = '<div class="it"></div><div class="ib"></div>';
        card.querySelector('.it').textContent = ins.title || '';
        card.querySelector('.ib').textContent = ins.body || '';
        if (ins.action) {
          const btn = document.createElement('button');
          btn.className = 'ia';
          btn.type = 'button';
          btn.textContent = `🤖 ${ins.action}`;
          btn.addEventListener('click', () => {
            // 인사이트의 추천 액션을 채팅으로 바로 요청 (이때만 Claude 호출)
            showChat();
            sendMessage(ins.action);
          });
          card.appendChild(btn);
        }
        bodyEl.appendChild(card);
      }
    }
    bodyEl.scrollTop = 0;
  }

  // ── 진행 과정 표시 ──────────────────────────────────────────
  function progressUI(bubble) {
    const progress = document.createElement('div');
    progress.className = 'progress';
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.innerHTML = '<span></span><span></span><span></span><em class="tlabel">처리 중…</em>';
    bubble.prepend(progress, typing);
    return {
      addStep(icon, text, detail) {
        const step = document.createElement('div');
        step.className = 'step';
        step.innerHTML = `<span>${icon}</span><span>${escapeHtml(text)}</span>` +
          (detail ? ` <span class="detail">${escapeHtml(detail)}</span>` : '');
        progress.appendChild(step);
        scrollBottom();
      },
      finish() {
        typing.remove();
        const steps = progress.querySelectorAll('.step').length;
        if (!steps) { progress.remove(); return; }
        const wrap = document.createElement('details');
        wrap.className = 'pwrap';
        wrap.innerHTML = `<summary>작업 과정 ${steps}단계</summary>`;
        progress.replaceWith(wrap);
        wrap.appendChild(progress);
        bubble.prepend(wrap);
      },
    };
  }

  // ── 파일 첨부 (드래그&드롭) ─────────────────────────────────
  // 패널에 파일을 놓으면 background 경유로 web-bridge(/api/upload)에 저장하고,
  // 저장된 절대 경로를 칩으로 보여준 뒤 전송 시 메시지 앞에 "📎 첨부 파일: <경로>"로 붙인다.
  // (정의서 xlsx/csv는 campaign_definitions\에 저장돼 "정의서 직접 첨부 → 저니 생성" 흐름과 연결됨)
  const UP_EXTS = ['.xlsx', '.xlsm', '.csv', '.txt', '.sql', '.md', '.json'];
  const UP_MAX = 20 * 1024 * 1024;
  let pendingFiles = []; // { name, path|null, err|null }

  function renderAttach() {
    attachEl.innerHTML = '';
    attachEl.style.display = pendingFiles.length ? '' : 'none';
    pendingFiles.forEach((f, i) => {
      const chip = document.createElement('span');
      chip.className = 'achip' + (f.err ? ' err' : '');
      chip.innerHTML = '<span class="al"></span><button class="rm" type="button" title="제거">✕</button>';
      chip.querySelector('.al').textContent =
        f.err ? `⚠️ ${f.name} — ${f.err}` : f.path ? `📎 ${f.name}` : `⏳ ${f.name} 업로드 중…`;
      chip.querySelector('.rm').addEventListener('click', () => {
        pendingFiles.splice(i, 1);
        renderAttach();
      });
      attachEl.appendChild(chip);
    });
  }

  function uploadFiles(list) {
    for (const file of Array.from(list || [])) {
      const ext = (file.name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
      const item = { name: file.name, path: null, err: null };
      pendingFiles.push(item);
      if (!UP_EXTS.includes(ext)) {
        item.err = `지원하지 않는 형식 (허용: ${UP_EXTS.join(' ')})`;
        renderAttach();
        continue;
      }
      if (file.size > UP_MAX) {
        item.err = '20MB 초과';
        renderAttach();
        continue;
      }
      renderAttach();
      const reader = new FileReader();
      reader.onload = () => {
        const dataB64 = String(reader.result).split(',')[1] || '';
        chrome.runtime.sendMessage({ type: 'upload', name: file.name, dataB64 }, (res) => {
          if (res && res.path) {
            item.path = res.path;
            item.name = res.name || file.name;
          } else {
            item.err = (res && res.error) || '업로드 실패 — web-bridge 서버 상태를 확인하세요';
          }
          renderAttach();
        });
      };
      reader.onerror = () => {
        item.err = '파일 읽기 실패';
        renderAttach();
      };
      reader.readAsDataURL(file);
    }
  }

  // 드래그 오버레이 — 파일 드래그일 때만 반응 (텍스트 선택 드래그는 무시)
  const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
  let dragDepth = 0;
  panel.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth++;
    dropEl.hidden = false;
  });
  panel.addEventListener('dragover', (e) => {
    if (hasFiles(e)) e.preventDefault();
  });
  panel.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    if (--dragDepth <= 0) {
      dragDepth = 0;
      dropEl.hidden = true;
    }
  });
  panel.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    dropEl.hidden = true;
    if (view !== 'chat') showChat();
    uploadFiles(e.dataTransfer.files);
  });

  // SFMC 인증 만료 감지 시 말풍선에 붙는 재인증 안내 — 버튼을 누르면 서버가
  // `claude mcp login`을 실행해 이 PC 기본 브라우저에 OAuth 로그인 창을 연다
  function attachReauth(bubble) {
    const box = document.createElement('div');
    box.className = 'reauth';
    box.innerHTML =
      '<div class="rmsg">SFMC 인증이 만료된 것 같습니다. 재인증 후 요청을 다시 보내주세요.</div>' +
      '<button class="rbtn">🔐 SFMC 재인증</button>';
    const btn = box.querySelector('.rbtn');
    const msg = box.querySelector('.rmsg');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = '여는 중…';
      chrome.runtime.sendMessage({ type: 'mcpLogin' }, (res) => {
        if (res && res.started) {
          btn.textContent = res.dup ? '🌐 이미 진행 중' : '🌐 로그인 진행 중';
          msg.textContent =
            '콘솔 창과 함께 브라우저에 SFMC 로그인 창이 열립니다. 로그인·승인을 완료하면 창이 자동으로 닫히고, 그 뒤 요청을 다시 보내주세요.';
        } else {
          btn.disabled = false;
          btn.textContent = '🔐 SFMC 재인증';
          msg.textContent = '서버에 연결하지 못했습니다. web-bridge 상태를 확인해주세요.';
        }
      });
    });
    bubble.appendChild(box);
  }

  // ── 전송 ────────────────────────────────────────────────────
  function sendMessage(text) {
    const ready = pendingFiles.filter((f) => f.path);
    if (busy || (!text.trim() && !ready.length)) return false;
    if (pendingFiles.some((f) => !f.path && !f.err)) return false; // 업로드 완료 대기 (입력은 보존)
    if (ready.length) {
      const lines = ready.map((f) => `📎 첨부 파일: ${f.path}`).join('\n');
      text = text.trim() ? `${lines}\n\n${text}` : lines;
      pendingFiles = [];
      renderAttach();
    }
    let conv = activeConv();
    if (!conv) conv = newConv();
    setBusy(true);

    if (view !== 'chat') showChat();
    bodyEl.querySelector('.empty')?.remove();

    conv.messages.push({ role: 'user', text });
    if (!conv.title) conv.title = text.slice(0, 40);
    conv.updatedAt = Date.now();
    saveDB();
    bodyEl.appendChild(userNode(text));

    const { node, bubble, answer } = botNode();
    bodyEl.appendChild(node);
    liveTurn = { convId: conv.id, node };
    scrollBottom();
    const prog = progressUI(bubble);

    let resultText = null;
    let errored = false;
    let authErr = false; // 서버가 SFMC 인증 만료를 감지한 경우 (result 이벤트의 authError)
    const startedAt = Date.now(); // 결과 회수 시 이 요청의 결과인지(이전 턴 잔여물이 아닌지) 판별용

    const finishTurn = () => {
      liveTurn = null;
      prog.finish();
      if (!errored) {
        const md = resultText ?? '(응답이 중단되었습니다)';
        renderMd(answer, md);
        conv.messages.push({ role: 'bot', text: md });
        conv.updatedAt = Date.now();
        saveDB();
        if (authErr) attachReauth(bubble);
      }
      setBusy(false);
      scrollBottom();
    };

    const port = chrome.runtime.connect({ name: 'mce-chat' });
    port.onMessage.addListener((ev) => {
      if (ev.type === 'ping') return;
      if (ev.type === 'session') {
        conv.sessionId = ev.sessionId;
        saveDB();
      } else if (ev.type === 'tool' || ev.type === 'text') {
        // 진행 과정은 화면에 노출하지 않는다 — 결과만 표시 (typing 점 애니메이션이 처리 중 표시를 대신함)
      } else if (ev.type === 'result') {
        resultText = ev.text;
        authErr = !!ev.authError;
        if (ev.sessionId) { conv.sessionId = ev.sessionId; saveDB(); }
      } else if (ev.type === 'error') {
        errored = true;
        answer.classList.add('error');
        answer.textContent = `❌ 오류: ${ev.message}`;
      } else if (ev.type === 'done') {
        port.disconnect();
        finishTurn();
      }
    });
    // 포트가 결과 없이 끊긴 경우(서비스 워커 강제 종료 등) — 작업은 서버에서 계속 돌고 있으므로
    // 오류로 끝내지 않고 서버의 /api/result를 폴링해 결과를 회수한다
    const recoverResult = () => {
      let misses = 0; // 서버 무응답 연속 횟수
      const iv = setInterval(() => {
        chrome.runtime.sendMessage({ type: 'getResult', chatId: conv.id }, (res) => {
          if (chrome.runtime.lastError || !res) {
            if (++misses >= 4) fail('❌ 연결이 끊겼습니다. web-bridge 서버 상태를 확인해 주세요.');
            return;
          }
          misses = 0;
          if (res.result && res.result.ts >= startedAt) {
            clearInterval(iv);
            resultText = res.result.text;
            authErr = !!res.result.authError;
            if (res.result.sessionId) { conv.sessionId = res.result.sessionId; saveDB(); }
            finishTurn();
          } else if (!res.running) {
            // 이 요청의 결과가 저장돼 있지 않은데 실행 중도 아님 → 회수 불가 (서버 재시작 등)
            fail('❌ 연결이 끊겼습니다. 같은 대화에서 "방금 요청 결과 알려줘"로 이어서 확인해 보세요.');
          }
        });
      }, 4000);
      const fail = (text) => {
        clearInterval(iv);
        errored = true;
        answer.classList.add('error');
        answer.textContent = text;
        finishTurn();
      };
    };

    // 서비스 워커가 강제 재시작되는 등 포트가 끊겨도 UI가 잠기지 않게 한다
    port.onDisconnect.addListener(() => {
      if (!busy) return;
      if (errored || resultText !== null) { finishTurn(); return; }
      recoverResult();
    });

    port.postMessage({ type: 'send', payload: { message: text, sessionId: conv.sessionId, chatId: conv.id } });
    return true;
  }

  // ── 이벤트 바인딩 ───────────────────────────────────────────
  fab.addEventListener('click', () => {
    if (dragMoved) return; // 드래그로 이동한 경우 클릭으로 취급하지 않는다
    panel.hidden = false;
    fab.style.display = 'none';
    syncPanelPos(); // 버튼 위치에서 파생해 패널만 화면 안으로 보정 (버튼 위치는 유지)
    showChat();
    inputEl.focus();
  });
  $('.close').addEventListener('click', () => {
    panel.hidden = true;
    fab.style.display = '';
    applyPos(); // 버튼을 원래 기준 위치로 복원
  });
  $('.hist').addEventListener('click', () => (view === 'history' ? showChat() : showHistory()));
  // 성과 대시보드 — 패널 안 대시보드 뷰로 전환 (다시 누르면 채팅으로 복귀)
  $('.dash').addEventListener('click', () => (view === 'dash' ? showChat() : showDash()));
  // 최대화 ↔ 기본 크기 복원 토글.
  // 기본 크기(448×700)가 아니면(드래그로 늘렸든 최대화든) 복원 아이콘을 보여주고, 누르면 기본 크기로 되돌린다.
  const DEFAULT_SIZE = { w: 448, h: 700 };
  const isDefaultSize = () => Math.abs(size.w - DEFAULT_SIZE.w) < 4 && Math.abs(size.h - DEFAULT_SIZE.h) < 4;
  // 기본 크기에서 벗어나는 순간의 위치 스냅샷 — 복원 시 크기와 함께 이 자리로 되돌린다.
  // (커진 상태에서 사용자가 패널을 직접 옮기면 스냅샷을 버리고 그 위치를 존중한다)
  let savedPos = null;
  const updateMaxBtn = () => {
    maxBtn.innerHTML = isDefaultSize() ? ICONS.expand : ICONS.shrink;
    maxBtn.title = isDefaultSize() ? '최대화' : '기본 크기로 복원';
  };
  maxBtn.addEventListener('click', () => {
    if (isDefaultSize()) {
      savedPos = { ...panelPos };
      size.w = innerWidth - 16;
      size.h = innerHeight - 16;
      panelPos = { right: 8, bottom: 8 };
    } else {
      size.w = DEFAULT_SIZE.w;
      size.h = DEFAULT_SIZE.h;
      if (savedPos) panelPos = { ...savedPos };
      savedPos = null;
    }
    applySize();
    applyPos();
    localStorage.setItem(SIZE_KEY, JSON.stringify(size));
    updateMaxBtn();
  });
  $('.new').addEventListener('click', () => {
    if (busy) return;
    const conv = activeConv();
    if (conv && !conv.messages.length) { showChat(); return; } // 이미 빈 대화면 재사용
    newConv();
    showChat();
    inputEl.focus();
  });
  $('.composer').addEventListener('submit', (e) => {
    e.preventDefault();
    // 전송이 실제로 이뤄진 경우에만 입력을 비운다 (업로드 대기 중 엔터 등으로 입력이 사라지지 않게)
    if (sendMessage(inputEl.value)) {
      inputEl.value = '';
      inputEl.style.height = 'auto';
    }
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      $('.composer').requestSubmit();
    }
    e.stopPropagation(); // MCE 페이지의 전역 단축키와 충돌 방지
  });
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });
  // 첨부(+) 버튼 — 파일 선택 대화상자로도 첨부 가능 (드래그&드롭과 동일한 업로드 흐름)
  const fpick = $('.fpick');
  $('.attachb').addEventListener('click', () => fpick.click());
  fpick.addEventListener('change', () => {
    uploadFiles(fpick.files);
    fpick.value = ''; // 같은 파일 재선택도 change가 발생하게 초기화
  });
  stopBtn.addEventListener('click', () => {
    const conv = activeConv();
    if (!conv) return;
    const port = chrome.runtime.connect({ name: 'mce-chat' });
    port.postMessage({ type: 'stop', chatId: conv.id });
    setTimeout(() => port.disconnect(), 500);
  });

  // ── 드래그 이동 (버튼·패널 헤더를 잡고 이동) ──
  // "탭 기준" 위치 보존: 같은 탭에서는 페이지 이동·새로고침에도 유지되고,
  // 새 탭/새 창으로 MCE를 열면 기본 위치(우측 아래)에서 시작한다.
  // 주의: sessionStorage는 링크로 연 새 탭에 복제되므로, 저장 시 탭 ID를 함께 기록하고
  // 로드 시 실제 탭 ID(background에 조회)와 일치할 때만 복원한다.
  // pos = 버튼(🤖)의 기준 위치. panelPos = 패널 표시 위치(열 때마다 pos에서 파생).
  // 패널이 화면에 맞게 자동 보정돼도 pos는 건드리지 않아, 닫으면 버튼이 원래 자리로 돌아온다.
  localStorage.removeItem('mceExt.pos'); // 이전 버전(영구 저장)의 잔여 데이터 정리
  const pos = { right: 26, bottom: 26 };
  let panelPos = { ...pos };
  let myTabId = null;
  const savePos = () => sessionStorage.setItem('mceExt.pos', JSON.stringify({ ...pos, tabId: myTabId }));

  chrome.runtime.sendMessage({ type: 'whoami' }, (res) => {
    myTabId = res?.tabId ?? null;
    try {
      const p = JSON.parse(sessionStorage.getItem('mceExt.pos'));
      if (p && p.tabId === myTabId && Number.isFinite(p.right) && Number.isFinite(p.bottom)) {
        pos.right = p.right;
        pos.bottom = p.bottom;
        applyPos(); // 같은 탭 → 저장된 위치 복원
      } else if (p) {
        sessionStorage.removeItem('mceExt.pos'); // 다른 탭에서 복제된 값 → 기본 위치 시작
      }
    } catch { /* 기본 위치 사용 */ }
  });

  function clampFor(el, p) {
    // transform(등장 애니메이션) 영향을 받지 않는 offsetWidth/Height 기준으로 화면 안에 머물게 보정
    p.right = Math.min(Math.max(p.right, 8), Math.max(8, innerWidth - el.offsetWidth - 8));
    p.bottom = Math.min(Math.max(p.bottom, 8), Math.max(8, innerHeight - el.offsetHeight - 8));
  }

  function applyPos() {
    if (panel.hidden) {
      clampFor(fab, pos);
      fab.style.right = pos.right + 'px';
      fab.style.bottom = pos.bottom + 'px';
    } else {
      clampFor(panel, panelPos);
      panel.style.right = panelPos.right + 'px';
      panel.style.bottom = panelPos.bottom + 'px';
    }
  }

  // ── 패널 크기 조절 (8방향 핸들, 크기는 localStorage에 영구 보존) ──
  const SIZE_KEY = 'mceExt.size';
  const size = (() => {
    try {
      const s = JSON.parse(localStorage.getItem(SIZE_KEY));
      if (s && Number.isFinite(s.w) && Number.isFinite(s.h)) return s;
    } catch { /* 기본 크기 사용 */ }
    return { w: 448, h: 700 };
  })();
  const clampW = (w) => Math.min(Math.max(w, 340), innerWidth - 16);
  const clampH = (h) => Math.min(Math.max(h, 420), innerHeight - 16);

  function applySize() {
    size.w = clampW(size.w);
    size.h = clampH(size.h);
    panel.style.width = size.w + 'px';
    panel.style.height = size.h + 'px';
  }
  applySize();
  applyPos();
  window.addEventListener('resize', () => { applySize(); applyPos(); });

  for (const d of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
    const h = document.createElement('div');
    h.className = `rz rz-${d}`;
    panel.appendChild(h);
    h.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      h.setPointerCapture(e.pointerId);
      if (!savedPos) savedPos = { ...panelPos }; // 크기 조절 시작 위치 스냅샷 (복원용)
      const sx = e.clientX, sy = e.clientY;
      const sw = size.w, sh = size.h;
      const sr = panelPos.right, sb = panelPos.bottom;
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        // 패널은 right/bottom 기준 고정이라, 왼쪽/위쪽 핸들은 크기만 바꾸면 되고
        // 오른쪽/아래쪽 핸들은 반대편이 안 움직이게 right/bottom도 함께 보정한다
        if (d.includes('w')) size.w = clampW(sw - dx);
        if (d.includes('e')) { const w = clampW(sw + dx); panelPos.right = sr - (w - sw); size.w = w; }
        if (d.includes('n')) size.h = clampH(sh - dy);
        if (d.includes('s')) { const hh = clampH(sh + dy); panelPos.bottom = sb - (hh - sh); size.h = hh; }
        applySize();
        applyPos();
      };
      const up = (ev) => {
        try { h.releasePointerCapture(ev.pointerId); } catch { /* 이미 해제됨 */ }
        h.removeEventListener('pointermove', move);
        h.removeEventListener('pointerup', up);
        h.removeEventListener('pointercancel', up);
        localStorage.setItem(SIZE_KEY, JSON.stringify(size));
        updateMaxBtn(); // 드래그로 기본 크기에서 벗어나면 복원 아이콘으로 전환
      };
      h.addEventListener('pointermove', move);
      h.addEventListener('pointerup', up);
      h.addEventListener('pointercancel', up);
    });
  }
  updateMaxBtn(); // 저장된 크기로 시작할 때도 아이콘 상태를 맞춘다

  // 패널을 열 때: 버튼 위치에서 파생해 패널만 보정 (fab 클릭 핸들러에서 호출)
  function syncPanelPos() {
    panelPos = { ...pos };
    applyPos();
  }

  let dragMoved = false;
  function makeDraggable(el, handle, getPos, onDrop) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (el === panel && e.target.closest('.hbtn')) return; // 헤더의 버튼들은 드래그 대상에서 제외
      const sx = e.clientX, sy = e.clientY;
      const p = getPos();
      const sr = p.right, sb = p.bottom;
      dragMoved = false;
      // 포인터 캡처: 빠르게 끌어 커서가 iframe·페이지 위로 벗어나도 이벤트가 끊기지 않는다
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => {
        const dx = ev.clientX - sx, dy = ev.clientY - sy;
        if (!dragMoved && Math.abs(dx) + Math.abs(dy) < 5) return; // 클릭과 드래그 구분 임계값
        dragMoved = true;
        p.right = sr - dx;
        p.bottom = sb - dy;
        applyPos();
      };
      const up = (ev) => {
        try { handle.releasePointerCapture(ev.pointerId); } catch { /* 이미 해제됨 */ }
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        if (dragMoved) onDrop();
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
      e.preventDefault();
    });
  }
  makeDraggable(fab, fab, () => pos, savePos);
  // 패널을 직접 드래그했을 때만 버튼 기준 위치도 따라간다 (자동 보정과 구분)
  makeDraggable(panel, $('.head'), () => panelPos, () => {
    pos.right = panelPos.right;
    pos.bottom = panelPos.bottom;
    savePos();
    savedPos = null; // 사용자가 직접 옮겼으면 복원 시에도 이 위치를 유지한다
  });

  // ── 계정 게이트 + 전역 ON/OFF: 두 조건을 모두 만족할 때만 UI 노출 ──
  // 서버(web-bridge/config.json)의 allowedAccounts에 적힌 계정명이 페이지에 보일 때만 버튼을 띄운다.
  // 게이트 미설정(빈 배열)이거나 서버에 못 붙으면 기존대로 항상 노출한다(어차피 요청 시 오류로 드러남).
  fab.hidden = true;
  const VER = chrome.runtime.getManifest().version;
  // 툴바 확장 아이콘 클릭으로 끈 상태(chrome.storage.local.botDisabled) — 게이트와 별개 축
  let gateOk = false;
  let botOff = false;
  const applyVisibility = () => {
    fab.hidden = !(gateOk && !botOff);
    if (botOff && !panel.hidden) {
      // OFF 전환 시 열려 있던 패널도 닫는다 (대화 내용은 저장돼 있어 다시 켜면 그대로)
      panel.hidden = true;
      fab.style.display = '';
      applyPos();
    }
  };
  chrome.storage.local.get('botDisabled', (v) => {
    botOff = !!(v && v.botDisabled);
    applyVisibility();
  });
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area === 'local' && ch.botDisabled) {
      botOff = !!ch.botDisabled.newValue;
      applyVisibility();
    }
  });
  chrome.runtime.sendMessage({ type: 'getConfig' }, (cfg) => {
    if (!cfg) {
      // 서버 미응답 → 버튼 미노출 (서버가 꺼져 있으면 봇도 동작 불가한데, fail-open이면 모든 BU에 떠서 혼란)
      console.log(`[MCE Bot v${VER}] web-bridge 응답 없음 → 버튼 미노출 (run-web.cmd 실행 후 페이지 새로고침)`);
      return;
    }
    const allowed = (cfg.allowedAccounts || []).filter((a) => typeof a === 'string' && a.trim());
    if (!allowed.length) {
      // 게이트 미설정(allowedAccounts 비어 있음) → 항상 표시
      console.log(`[MCE Bot v${VER}] 게이트 미설정 → 버튼 표시`, cfg);
      gateOk = true;
      applyVisibility();
      return;
    }
    console.log(`[MCE Bot v${VER}] 계정 게이트 검사 시작:`, allowed);
    // BU 전환 드롭다운의 "모든 BU 이름"이 화면엔 안 보여도 DOM에 렌더링돼 있어 텍스트 포함 검사는 오탐한다.
    // → 상단 헤더 영역(뷰포트 상단 150px) 안, 실제로 보이는 좌표에 렌더링된 텍스트 노드만 인정한다.
    //   현재 로그인된 BU 이름은 항상 상단 바에 표시되고, 숨은 드롭다운 항목은 화면 밖/0크기라 통과 못 한다.
    const matches = () => {
      if (!document.body) return false;
      for (const name of allowed) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) =>
            n.nodeValue && n.nodeValue.includes(name) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
        });
        for (let n; (n = walker.nextNode()); ) {
          const el = n.parentElement;
          if (!el) continue;
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          const visibleInHeader =
            r.width > 2 && r.height > 2 &&
            r.bottom > 0 && r.top < 150 &&
            r.left >= -5 && r.right <= innerWidth + 5 &&
            s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0;
          if (visibleInHeader) {
            // 오탐 디버깅용 — 어떤 요소가 게이트를 통과시켰는지 남긴다
            console.log(`[MCE Bot v${VER}] 게이트 매칭 요소:`, el.tagName, el.className, r.toJSON?.() || r);
            return true;
          }
        }
      }
      return false;
    };
    let tries = 0;
    const timer = setInterval(() => {
      if (matches()) {
        console.log(`[MCE Bot v${VER}] 헤더에서 연결 BU 확인 → 버튼 표시`);
        gateOk = true;
        applyVisibility();
        clearInterval(timer);
      } else if (++tries >= 40) {
        console.log(`[MCE Bot v${VER}] 20초 내 연결 BU 미확인 → 버튼 미노출`);
        clearInterval(timer);
      }
    }, 500);
  });
})();
