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
  let view = 'chat'; // 'chat' | 'history'

  // ── DOM 구성 ─────────────────────────────────────────────────
  const ICONS = {
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v4.7l3 1.8"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4l17.4-8.4L3.4 3.6l-.01 6.6L13.5 12 3.39 13.8z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.7L20 9.5l-5.4 3.2L15.5 19 12 15.6 8.5 19l.9-6.3L4 9.5l6.1-1.8z"/></svg>',
  };

  const host = document.createElement('div');
  host.id = 'mce-assistant-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
  <style>
    :host { all: initial; }
    * { box-sizing: border-box; margin: 0; font-family: "Pretendard", "Malgun Gothic", -apple-system, "Segoe UI", sans-serif; }
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

    /* ── 플로팅 버튼 ── */
    .fab {
      position: fixed; right: 26px; bottom: 26px; z-index: 2147483647;
      width: 58px; height: 58px; border-radius: 50%; border: none; cursor: pointer;
      background: var(--grad); color: #fff; font-size: 26px;
      display: grid; place-items: center;
      transition: transform .2s cubic-bezier(.34,1.56,.64,1);
      touch-action: none;
    }
    .fab:hover { transform: scale(1.1) rotate(6deg); }
    .fab[hidden] { display: none; } /* 계정 게이트 숨김 — authored display:grid가 [hidden] 기본 규칙을 덮지 않게 명시 */
    .fab .dot {
      position: absolute; right: 3px; top: 3px; width: 13px; height: 13px;
      background: #34d399; border: 2.5px solid #fff; border-radius: 50%;
    }

    /* ── 패널 ── */
    .panel {
      position: fixed; right: 26px; bottom: 26px; z-index: 2147483647;
      width: 448px; max-width: calc(100vw - 52px);
      height: 700px; max-height: calc(100vh - 52px);
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

    /* ── 헤더 ── */
    .head {
      display: flex; align-items: center; gap: 11px;
      padding: 15px 16px; background: var(--grad); color: #fff; flex: none;
      cursor: grab; touch-action: none;
    }
    .head:active { cursor: grabbing; }
    .avatar {
      width: 38px; height: 38px; border-radius: 13px; flex: none;
      background: rgba(255,255,255,.2); backdrop-filter: blur(4px);
      display: grid; place-items: center; font-size: 20px;
    }
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
      width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 22px;
      background: var(--grad); display: grid; place-items: center; font-size: 32px;
      box-shadow: 0 10px 26px rgba(29, 78, 216, .35);
    }
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
      width: 27px; height: 27px; border-radius: 9px; flex: none; margin-top: 2px;
      background: var(--grad); display: grid; place-items: center; font-size: 14px;
    }
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
    .typing { display: flex; gap: 4px; padding: 6px 0 2px 14px; }
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
    .answer th, .answer td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
    .answer th { background: var(--soft); }
    .answer a { color: var(--accent); font-weight: 600; text-decoration: none; }
    .answer a:hover { text-decoration: underline; }
    .answer hr { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
    .answer.error { color: #ef4444; }

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

    /* ── 입력창 ── */
    .foot { padding: 12px 14px 14px; background: var(--bg); flex: none; }
    .composer {
      display: flex; gap: 7px; align-items: flex-end;
      background: var(--card); border: 1.5px solid var(--border); border-radius: 16px;
      padding: 7px 8px 7px 14px; box-shadow: var(--shadow-sm);
      transition: border-color .15s;
    }
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
    .send { background: var(--grad); color: #fff; box-shadow: 0 4px 12px rgba(29, 78, 216, .4); }
    .send:hover:not(:disabled) { transform: scale(1.07); }
    .send:disabled { opacity: .35; cursor: default; box-shadow: none; }
    .send svg, .stopb svg { width: 16px; height: 16px; }
    .stopb { background: #ef4444; color: #fff; }
  </style>

  <button class="fab" title="MCE Bot">🤖<span class="dot"></span></button>

  <div class="panel" hidden>
    <div class="head">
      <button class="hbtn back" type="button" hidden>${ICONS.back}</button>
      <div class="avatar">🤖</div>
      <div class="meta">
        <div class="title">MCE Bot</div>
        <div class="status">대기 중</div>
      </div>
      <button class="hbtn hist" type="button" title="대화 내역">${ICONS.history}</button>
      <button class="hbtn new" type="button" title="새 대화">${ICONS.plus}</button>
      <button class="hbtn close" type="button" title="닫기">${ICONS.close}</button>
    </div>
    <div class="body"></div>
    <div class="foot">
      <form class="composer">
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
  const backBtn = $('.back');
  const footEl = $('.foot');
  const inputEl = $('textarea');
  const sendBtn = $('.send');
  const stopBtn = $('.stopb');

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function renderMd(el, md) {
    el.innerHTML = marked.parse(md);
    el.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
  }
  const scrollBottom = () => (bodyEl.scrollTop = bodyEl.scrollHeight);

  function setBusy(v, label) {
    busy = v;
    sendBtn.disabled = v;
    stopBtn.hidden = !v;
    statusEl.textContent = v ? (label || '처리 중…') : '대기 중';
    statusEl.classList.toggle('busy', v);
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
    div.innerHTML = '<div class="mini">🤖</div><div class="bubble"></div>';
    const bubble = div.querySelector('.bubble');
    const answer = document.createElement('div');
    answer.className = 'answer';
    bubble.appendChild(answer);
    return { node: div, bubble, answer };
  }

  function emptyStateHTML() {
    return `
    <div class="empty">
      <div class="mark">🤖</div>
      <h2>무엇을 도와드릴까요?</h2>
      <p>캠페인 생성 · 저니 조회 · 세팅 점검을 한 문장으로 요청하세요</p>
      <div class="chips">
        <button class="chip" data-msg="생성 가능한 캠페인 추천해줘"><span class="ci">✨</span>생성 가능한 캠페인 추천</button>
        <button class="chip" data-msg="최근 생성된 저니 목록 조회해줘"><span class="ci">🧭</span>최근 저니 목록 조회</button>
        <button class="chip" data-msg="MCE 초기 세팅 점검해줘 (발송 준비 상태 확인)"><span class="ci">🛠️</span>MCE 세팅 점검</button>
      </div>
    </div>`;
  }

  function showChat() {
    view = 'chat';
    backBtn.hidden = true;
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
    scrollBottom();
  }

  // ── 대화 내역 화면 ──────────────────────────────────────────
  function showHistory() {
    view = 'history';
    backBtn.hidden = false;
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

  // ── 진행 과정 표시 ──────────────────────────────────────────
  function progressUI(bubble) {
    const progress = document.createElement('div');
    progress.className = 'progress';
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
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

  // ── 전송 ────────────────────────────────────────────────────
  function sendMessage(text) {
    if (busy || !text.trim()) return;
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
    scrollBottom();
    const prog = progressUI(bubble);

    let resultText = null;
    let errored = false;

    const finishTurn = () => {
      prog.finish();
      if (!errored) {
        const md = resultText ?? '(응답이 중단되었습니다)';
        renderMd(answer, md);
        conv.messages.push({ role: 'bot', text: md });
        conv.updatedAt = Date.now();
        saveDB();
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
      } else if (ev.type === 'tool') {
        prog.addStep('🔧', ev.name, ev.detail);
        statusEl.textContent = `실행 중 — ${ev.name}`;
      } else if (ev.type === 'text') {
        prog.addStep('💬', ev.text.replace(/\s+/g, ' ').slice(0, 80));
      } else if (ev.type === 'result') {
        resultText = ev.text;
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
    // 서비스 워커가 강제 재시작되는 등 포트가 끊겨도 UI가 잠기지 않게 한다
    port.onDisconnect.addListener(() => {
      if (!busy) return;
      if (!errored && resultText === null) {
        errored = true;
        answer.classList.add('error');
        answer.textContent = '❌ 연결이 끊겼습니다. 작업은 서버에서 계속될 수 있으니 잠시 후 다시 물어보세요.';
      }
      finishTurn();
    });

    port.postMessage({ type: 'send', payload: { message: text, sessionId: conv.sessionId, chatId: conv.id } });
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
  backBtn.addEventListener('click', showChat);
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
    const text = inputEl.value;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    sendMessage(text);
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
  applyPos();
  window.addEventListener('resize', applyPos);

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
  });

  // ── 계정 게이트: MCP에 연결된 계정의 MCE 화면에서만 UI 노출 ──
  // 서버(web-bridge/config.json)의 allowedAccounts에 적힌 계정명이 페이지에 보일 때만 버튼을 띄운다.
  // 게이트 미설정(빈 배열)이거나 서버에 못 붙으면 기존대로 항상 노출한다(어차피 요청 시 오류로 드러남).
  fab.hidden = true;
  const VER = chrome.runtime.getManifest().version;
  chrome.runtime.sendMessage({ type: 'getConfig' }, (cfg) => {
    const allowed = (cfg?.allowedAccounts || []).filter((a) => typeof a === 'string' && a.trim());
    if (!allowed.length) {
      // 게이트 미설정 또는 서버 응답 없음(cfg=null) → 표시 (서버가 죽었으면 어차피 요청 시 오류로 드러남)
      console.log(`[MCE Bot v${VER}] 게이트 미설정/설정조회실패 → 버튼 표시`, cfg);
      fab.hidden = false;
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
          if (visibleInHeader) return true;
        }
      }
      return false;
    };
    let tries = 0;
    const timer = setInterval(() => {
      if (matches()) {
        console.log(`[MCE Bot v${VER}] 헤더에서 연결 BU 확인 → 버튼 표시`);
        fab.hidden = false;
        clearInterval(timer);
      } else if (++tries >= 40) {
        console.log(`[MCE Bot v${VER}] 20초 내 연결 BU 미확인 → 버튼 미노출`);
        clearInterval(timer);
      }
    }, 500);
  });
})();
