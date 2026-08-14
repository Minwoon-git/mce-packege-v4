const pptxgen = require("pptxgenjs");
const p = new pptxgen();
p.defineLayout({ name: "W", width: 13.333, height: 7.5 });
p.layout = "W";

// ---- design tokens (report-guide §7 SSOT / report-template.html) ----
const INK = "1A2238", INK_BG = "141B2E", TEXT = "2B3245", MUTE = "6B7280",
      LINE = "E5E8EE", CARD = "F7F8FB", ACCENT = "0E9F8E", ACCENT_SOFT = "E7F4F1",
      WHITE = "FFFFFF";
const F = "맑은 고딕";
const W = 13.333, H = 7.5, MX = 0.7;
const shadow = () => ({ type: "outer", color: "9AA0AE", blur: 8, offset: 3, angle: 90, opacity: 0.10 });

function dot(s, x, y) { s.addShape(p.ShapeType.ellipse, { x, y, w: 0.14, h: 0.14, fill: { color: ACCENT } }); }
function kicker(s, t) { s.addText(t, { x: MX, y: 0.5, w: 8, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: ACCENT, charSpacing: 2 }); }
function title(s, t) { s.addText(t, { x: MX, y: 0.82, w: W - 2 * MX, h: 0.9, fontFace: F, fontSize: 27, bold: true, color: INK, lineSpacing: 32 }); }
function footnote(s, t) { s.addText(t, { x: MX, y: H - 0.55, w: W - 2 * MX, h: 0.4, fontFace: F, fontSize: 10, color: MUTE, lineSpacing: 13 }); }
function hd(a) { return { fontFace: F, fontSize: 11, bold: true, color: WHITE, fill: { color: INK }, align: a || "left", valign: "middle" }; }
function cell(name, i, a) { return { fontFace: F, fontSize: 11, bold: !!name, color: name ? INK : TEXT, align: a || "left", fill: { color: i % 2 ? "FAFBFC" : WHITE } }; }

// ===== Slide 1 — Masthead (dark) =====
let s = p.addSlide();
s.background = { color: INK_BG };
s.addText("데이터 기반 분석", { x: MX, y: 1.7, w: 10, h: 0.35, fontFace: F, fontSize: 12, bold: true, color: "6FD8C9", charSpacing: 3 });
s.addText("고객 데이터 분석 & 캠페인 추천 리포트", { x: MX, y: 2.15, w: 10.5, h: 1.4, fontFace: F, fontSize: 40, bold: true, color: WHITE, lineSpacing: 46 });
s.addShape(p.ShapeType.line, { x: MX, y: 4.5, w: W - 2 * MX, h: 0, line: { color: "3A425A", width: 1 } });
const meta = [["모수", "100,000명"], ["기준일", "2026.07.23"], ["업종", "일반 이커머스"]];
meta.forEach(([k, v], i) => {
  const x = MX + i * 2.7;
  s.addText(k, { x, y: 4.75, w: 2.5, h: 0.3, fontFace: F, fontSize: 11, color: "8B93A8", charSpacing: 1 });
  s.addText(v, { x, y: 5.05, w: 2.5, h: 0.4, fontFace: F, fontSize: 17, bold: true, color: "EEF0F5" });
});
dot(s, W - MX - 0.14, 1.75);

// ===== Slide 2 — 핵심 요약 =====
s = p.addSlide(); s.background = { color: WHITE };
kicker(s, "01 · 핵심 요약");
title(s, "구매 기반은 견고하나, 매출은 재구매·이탈·휴면에서 새고 있습니다");
s.addText([
  { text: "전체 10만 명 중 ", options: {} },
  { text: "구매자 85,059명(85.1%)", options: { bold: true, color: INK } },
  { text: "으로 활성 기반은 탄탄합니다. 그러나 그 구매자의 ", options: {} },
  { text: "64.7%가 1회성", options: { bold: true, color: INK } },
  { text: "이고, ", options: {} },
  { text: "32.6%는 주문 90일+ 이탈위험", options: { bold: true, color: INK } },
  { text: " 구간입니다. 신규 획득보다 이미 확보한 고객의 다음 구매를 살리는 것이 가장 큰 성장 레버입니다.", options: {} },
], { x: MX, y: 1.85, w: W - 2 * MX, h: 0.9, fontFace: F, fontSize: 14.5, color: TEXT, lineSpacing: 24 });

const figs = [
  ["64.7", "%", "1회성 구매자 · 55,034명", "(구매자 대비 최대 비중)"],
  ["32.6", "%", "이탈위험 · 27,729명", "(주문 90일+ 경과 구매자)"],
  ["85.1", "%", "구매자 · 85,059명", "(활성 구매 기반)"],
];
const fw = (W - 2 * MX - 2 * 0.35) / 3;
figs.forEach(([big, u, l1, l2], i) => {
  const x = MX + i * (fw + 0.35);
  s.addShape(p.ShapeType.roundRect, { x, y: 3.0, w: fw, h: 1.85, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: shadow() });
  dot(s, x + fw - 0.34, 3.22);
  s.addText([{ text: big, options: { fontSize: 46, bold: true, color: INK } }, { text: u, options: { fontSize: 22, bold: true, color: ACCENT } }],
    { x: x + 0.25, y: 3.35, w: fw - 0.5, h: 0.9, fontFace: F });
  s.addText(l1 + "\n" + l2, { x: x + 0.25, y: 4.25, w: fw - 0.5, h: 0.55, fontFace: F, fontSize: 12, color: MUTE, lineSpacing: 15 });
});
s.addText([
  { text: "권장 우선순위: ", options: {} },
  { text: "① 2차 구매 유도 → ② 이탈 방어 → ③ 휴면 재활성", options: { bold: true, color: INK } },
  { text: " 순이며, 근거와 대상 규모는 다음 장에서 상술합니다.", options: {} },
], { x: MX, y: 5.15, w: W - 2 * MX, h: 0.6, fontFace: F, fontSize: 13.5, color: TEXT, lineSpacing: 20 });

// ===== Slide 3 — 진단 (chart + table + note) =====
s = p.addSlide(); s.background = { color: WHITE };
kicker(s, "02 · 고객 데이터 진단");
title(s, "세그먼트별 규모 — 재구매·이탈·휴면이 상위 세 축");
const segs = [
  ["1회성 구매자", 55034], ["휴면", 32255], ["이탈위험", 27729],
  ["미동의", 19893], ["장바구니 이탈", 18149], ["첫구매 미전환", 14941],
];
if (!process.env.SKIPCHART) s.addChart(p.ChartType.bar, [{ name: "인원", labels: segs.map(r => r[0]), values: segs.map(r => r[1]) }], {
  x: MX, y: 1.8, w: 5.9, h: 4.5, barDir: "bar",
  chartColors: [INK], showLegend: false, showTitle: false,
  showValue: true, dataLabelColor: INK, dataLabelFontFace: F, dataLabelFontSize: 10, dataLabelFormatCode: "#,##0",
  catAxisLabelFontFace: F, catAxisLabelFontSize: 10, catAxisLabelColor: TEXT,
  valAxisHidden: true, valGridLine: { style: "none" }, catAxisLineShow: false,
  barGapWidthPct: 45,
});
const rows = [[{ text: "지표", options: hd() }, { text: "인원", options: hd("right") }, { text: "비율", options: hd("right") }]];
const tbl = [
  ["1회성 구매자", "55,034", "64.7%*"], ["이탈위험", "27,729", "32.6%*"],
  ["휴면", "32,255", "32.3%"], ["미동의", "19,893", "19.9%"],
  ["장바구니 이탈", "18,149", "18.1%"], ["첫구매 미전환", "14,941", "14.9%"],
];
tbl.forEach((r, i) => rows.push([
  { text: r[0], options: cell(true, i) }, { text: r[1], options: cell(false, i, "right") }, { text: r[2], options: cell(false, i, "right") },
]));
const totBorder = [{ pt: 2, color: INK }, { pt: 0.5, color: LINE }, { pt: 0.5, color: LINE }, { pt: 0.5, color: LINE }];
rows.push([
  { text: "모수 (전체)", options: { fontFace: F, fontSize: 11, bold: true, color: INK, fill: { color: WHITE }, border: totBorder } },
  { text: "100,000", options: { fontFace: F, fontSize: 11, bold: true, color: INK, align: "right", fill: { color: WHITE }, border: totBorder } },
  { text: "—", options: { fontFace: F, fontSize: 11, bold: true, color: INK, align: "right", fill: { color: WHITE }, border: totBorder } },
]);
s.addTable(rows, { x: 6.85, y: 1.9, w: 5.75, colW: [2.55, 1.7, 1.5], rowH: 0.34, valign: "middle", border: { pt: 0.5, color: LINE } });
s.addShape(p.ShapeType.roundRect, { x: 6.85, y: 4.95, w: 5.75, h: 1.35, rectRadius: 0.08, fill: { color: ACCENT_SOFT }, line: { color: ACCENT_SOFT, width: 0 } });
s.addText([
  { text: "해석. ", options: { bold: true, color: "0B3F39" } },
  { text: "구매 기반(85%)은 견고하나 1회성 65% · 이탈위험 33%가 동시에 높다는 것은, 유입은 되나 두 번째 구매로 넘기는 힘이 약하다는 신호입니다. 신규 획득보다 재구매 전환·이탈 방어의 매출 기여가 큽니다.", options: {} },
], { x: 7.1, y: 5.1, w: 5.25, h: 1.05, fontFace: F, fontSize: 11.5, color: "154A44", lineSpacing: 16, valign: "middle" });
footnote(s, "* 1회성·이탈위험은 구매자(85,059명) 대비, 그 외는 전체(100,000명) 대비 · RECON_Profile 집계 · 기준일 2026-07-23");

// ===== Slide 4 — 기회 우선순위 (주입 데이터: 5개 캠페인, 미동의는 각주 전용) =====
s = p.addSlide(); s.background = { color: WHITE };
kicker(s, "03 · 기회 우선순위");
title(s, "먼저 공략할 곳 — 대상 규모와 기대 임팩트 기준");
const oh = [{ text: "#", options: hd("center") }, { text: "캠페인", options: hd() }, { text: "근거", options: hd() }, { text: "대상", options: hd("right") }, { text: "기대 임팩트", options: hd() }];
const opp = [
  ["1", "2차 구매 유도", "1회성 64.7%", "55,034", "재구매율↑ · LTV↑ (최대 모수)", true],
  ["2", "이탈 고객 재구매 유도", "이탈위험 32.6%", "27,729", "이탈 방어 · 매출 회복", true],
  ["3", "휴면 고객 재활성화", "휴면 32.3%", "32,255", "활성 고객 수↑", true],
  ["4", "장바구니 리마인더", "장바구니 18.1%", "18,149", "전환율↑ · 결제 완주", false],
  ["5", "신규 첫구매 유도", "첫구매 미전환 14.9%", "14,941", "첫구매 전환↑", false],
];
const orows = [oh];
opp.forEach(([r, c, b, d, im, top], i) => {
  const fill = top ? "F1F7F6" : (i % 2 ? "FAFBFC" : WHITE);
  orows.push([
    { text: r, options: { fontFace: F, fontSize: 11.5, bold: true, color: top ? ACCENT : MUTE, align: "center", fill: { color: fill } } },
    { text: c, options: { fontFace: F, fontSize: 12, bold: true, color: INK, fill: { color: fill } } },
    { text: b, options: { fontFace: F, fontSize: 11.5, color: TEXT, fill: { color: fill } } },
    { text: d, options: { fontFace: F, fontSize: 11.5, color: TEXT, align: "right", fill: { color: fill } } },
    { text: im, options: { fontFace: F, fontSize: 11.5, color: TEXT, fill: { color: fill } } },
  ]);
});
s.addTable(orows, { x: MX, y: 1.85, w: W - 2 * MX, colW: [0.7, 3.1, 2.35, 1.6, 4.18], rowH: 0.58, valign: "middle", border: { pt: 0.5, color: LINE } });
s.addText([
  { text: "상위 3개(2차 구매·이탈·휴면)만으로 ", options: {} },
  { text: "연인원 11만 건 이상", options: { bold: true, color: INK } },
  { text: "의 접점이 나오며, 모두 이미 확보한 고객이라 신규 획득 대비 전환 효율이 높습니다. 미동의 ", options: {} },
  { text: "19,893명(19.9%)", options: { bold: true, color: INK } },
  { text: "은 이메일·SMS 모두 미동의로 도달 채널이 없어 캠페인 대상에서 제외되며, 별도 동의 재수집이 필요합니다.", options: {} },
], { x: MX, y: 5.65, w: W - 2 * MX, h: 0.9, fontFace: F, fontSize: 13, color: TEXT, lineSpacing: 20 });

// ===== Slide 5 — 핵심 캠페인 상세 (상위 3개) =====
s = p.addSlide(); s.background = { color: WHITE };
kicker(s, "04 · 핵심 캠페인 상세");
title(s, "상위 3개 캠페인 실행 설계");
const camps = [
  ["01", "2차 구매 유도", "55,034명 · 1회성 구매자", "이메일 · 알림톡 (동의 필터)", "첫 구매 감사 + 두 번째 구매 혜택(교차추천·재구매 쿠폰)", "재구매율↑ · LTV↑"],
  ["02", "이탈 고객 재구매 유도", "27,729명 · 주문 90일+ 경과", "이메일 · 알림톡", "그동안 안녕하셨나요 + 복귀 인센티브·개인화 추천", "이탈 방어 · 매출 회복"],
  ["03", "휴면 고객 재활성화", "32,255명 · 로그인 90일+ 미접속", "이메일 · 알림톡", "오랜만의 재방문 유도 + 한정 리마인드 혜택", "활성 고객 수↑"],
];
const cw = (W - 2 * MX - 2 * 0.35) / 3;
camps.forEach(([no, name, tgt, ch, msg, imp], i) => {
  const x = MX + i * (cw + 0.35);
  s.addShape(p.ShapeType.roundRect, { x, y: 1.85, w: cw, h: 4.4, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 }, shadow: shadow() });
  dot(s, x + 0.3, 2.2);
  s.addText(no, { x: x + 0.5, y: 2.05, w: 1, h: 0.35, fontFace: F, fontSize: 13, bold: true, color: ACCENT });
  s.addText(name, { x: x + 0.3, y: 2.5, w: cw - 0.6, h: 0.6, fontFace: F, fontSize: 16, bold: true, color: INK, lineSpacing: 20 });
  const kv = [["대상", tgt, 0.34], ["채널", ch, 0.34], ["메시지 방향", msg, 0.9]];
  let yy = 3.15;
  kv.forEach(([k, v, th]) => {
    s.addText(k, { x: x + 0.3, y: yy, w: cw - 0.6, h: 0.22, fontFace: F, fontSize: 10, color: MUTE });
    s.addText(v, { x: x + 0.3, y: yy + 0.22, w: cw - 0.6, h: th, fontFace: F, fontSize: 12, color: TEXT, bold: k === "대상", lineSpacing: 16 });
    yy += 0.22 + th + 0.06;
  });
  s.addShape(p.ShapeType.roundRect, { x: x + 0.3, y: 5.68, w: cw - 0.6, h: 0.42, rectRadius: 0.06, fill: { color: ACCENT_SOFT }, line: { color: ACCENT_SOFT, width: 0 } });
  s.addText("기대효과 — " + imp, { x: x + 0.45, y: 5.68, w: cw - 0.9, h: 0.42, fontFace: F, fontSize: 11, bold: true, color: "0B3F39", valign: "middle" });
});

// ===== Slide 6 — 마무리 (dark) =====
s = p.addSlide(); s.background = { color: INK_BG };
dot(s, MX, 1.85);
s.addText("종합 결론", { x: MX, y: 2.15, w: 10, h: 0.4, fontFace: F, fontSize: 12, bold: true, color: "6FD8C9", charSpacing: 2 });
s.addText("성장의 레버는 신규 획득이 아니라\n이미 확보한 고객의 두 번째 구매입니다", { x: MX, y: 2.6, w: 11.5, h: 1.5, fontFace: F, fontSize: 30, bold: true, color: WHITE, lineSpacing: 40 });
s.addText([
  { text: "구매 기반 85%는 탄탄하나 1회성 65% · 이탈위험 33% · 휴면 32%가 겹쳐 있습니다. ", options: {} },
  { text: "2차 구매 유도 → 이탈 방어 → 휴면 재활성", options: { bold: true, color: "6FD8C9" } },
  { text: " 순으로 착수하면 최소 비용으로 매출 회복 효과가 가장 큽니다.", options: {} },
], { x: MX, y: 4.3, w: 11.3, h: 1.1, fontFace: F, fontSize: 15, color: "C7CCDA", lineSpacing: 24 });
s.addShape(p.ShapeType.line, { x: MX, y: 5.9, w: W - 2 * MX, h: 0, line: { color: "3A425A", width: 1 } });
s.addText("방법론. 분석 소스 RECON_Profile(1행=1고객)을 세그먼트별 집계해 산출. 데이터 기준일 2026-07-23 · 휴면·이탈 기준일수 90일.\n* 1회성·이탈위험 비율은 구매자(85,059명) 대비, 그 외 지표는 전체(100,000명) 대비. 미동의 19,893명(19.9%)은 도달 채널이 없어 캠페인 대상에서 제외(동의 재수집 필요).",
  { x: MX, y: 6.05, w: W - 2 * MX, h: 0.8, fontFace: F, fontSize: 10, color: "8B93A8", lineSpacing: 15 });

p.writeFile({ fileName: process.argv[2] }).then(f => console.log("OK " + f));
