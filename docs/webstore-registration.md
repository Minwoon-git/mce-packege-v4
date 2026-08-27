# 크롬 웹스토어 확장 프로그램 등록·배포 프로세스 조사 리포트

> 조사일: 2026-08-27 / 조사 방법: 공식 문서(developer.chrome.com) 확인 + 웹 검색. 각 항목 출처 명시.
> 대상: MCE Bot 크롬 익스텐션 (MV3, SFMC 페이지 주입, 로컬 web-bridge 통신)

---

## 1. 개발자 계정 등록

- **비용**: 일회성 US$5 등록비 (연 갱신·항목당 비용 없음)
- **절차**: Developer Dashboard(chrome.google.com/webstore/devconsole) 접속 → 개발자 약관·정책 동의 → 등록비 결제
- **개발자 이메일**: 계정 생성 후 변경 불가 — 공식 문서가 "퍼블리싱 전용 신규 이메일" 사용 권장. 삭제된 계정의 이메일 재사용 불가
- **2단계 인증(2SV)**: 확장 게시·업데이트 전 개발자 계정에 2-Step Verification 필수 (공식 정책)
- **조직(회사) 계정**: 결제 프로필에서 개인/조직(Organization) 선택 가능. EU DSA에 따라 **Trader(영리 목적 배포자)는 법적 명칭·연락처·전화번호·(조직의 경우) DUNS 번호 등 신원 검증 필수**, 검증 정보 일부(주소·이메일·전화번호)가 스토어에 공개 표시. B2B 상용 도구는 사실상 Trader 해당 가능성 높음
- **신규 퍼블리셔 제한**: 최초 생성 시 **게시 가능 확장 최대 2개**로 제한, 계정 이력·활동에 따라 상향 요청 가능
- 출처: https://developer.chrome.com/docs/webstore/register / …/program-policies/two-step-verification / …/program-policies/trader-disclosure / …/publish

## 2. 배포 공개 범위 옵션

- **Public**: 스토어에 목록 노출, 전체 사용자 설치 가능
- **Unlisted**: 스토어 목록·검색에 미노출, **URL을 아는 사람은 누구나 설치 가능** (링크 유출 시 통제 불가)
- **Private**: 지정 사용자만 설치 가능. 접근 부여 3가지
  - **Trusted Testers**: 대시보드 계정 설정에 Google 계정 이메일 개별 등록
  - **Google Groups**: 퍼블리셔가 소유/관리하는 Google 그룹 멤버 설치 가능
  - **Domain Publishing**: Google Workspace **자사 조직(도메인) 구성원 전용** — 도메인 외 사용자는 404
- **"특정 고객사에게만 배포" 시 현실적 선택지**
  - Workspace 도메인 제한 배포는 자사 도메인 전용 — **외부 고객사 도메인 지정 불가**
  - 외부 고객사 배포는 ① Private + Trusted Testers/자사 관리 Google 그룹에 고객사 이메일 등록 (고객사 사용자의 Google 계정 로그인 필요), 또는 ② **Unlisted + 고객사 IT의 강제 설치 정책**(`ExtensionInstallForcelist` GPO / Chrome Browser Cloud Management에 확장 ID 등록)
  - **모든 공개 범위(Private 포함)가 동일한 정책 요건·동일한 심사를 거침**
- 출처: https://developer.chrome.com/docs/webstore/cws-dashboard-distribution / https://cloud.google.com/blog/products/chrome-enterprise/publishing-extensions-for-the-enterprise

## 3. 심사(Review)

- **소요 시간**: 대부분 수일 내, 최대 수 주. 3주 초과 시 개발자 지원 문의 권장. 2026년 4월부로 제출 급증에 따른 심사 지연 공지 중
- **심사 강화 트리거**: 신규 개발자·신규 확장·위험 권한·대규모 코드 변경. 광범위 host permission·민감 권한·난독화(금지, minification은 허용)가 연장 요인
- **MV3 요건**: 신규 제출은 MV3만 접수. 2026-08-31 스토어 내 잔존 MV2 전면 삭제 — MCE Bot은 MV3라 무관
- **리젝 사유 상위**: ① 불필요·과도한 권한 요청 ② 스토어 등록정보 불완전 ③ 개인정보처리방침 누락/불일치 ④ 난독화 코드 ⑤ 기능 불량
- **리젝 시**: 위반 내용 이메일 수신 → 수정 후 재제출 (기존 게시본 유지)
- 출처: https://developer.chrome.com/docs/webstore/review-process / …/blog/resuming-the-transition-to-mv3 / …/docs/webstore/troubleshooting

## 4. MCE Bot 해당 정책 리스크 점검

- **host_permissions에 localhost:3456**: 금지 조항 확인 불가(없는 것으로 판단). 모든 권한은 Privacy 탭에서 **개별 정당화 서술 필수** — "로컬 브리지 서버와의 통신용"으로 기재. 로컬 서버 필요 구조상 심사관이 기능 검증을 못 해 문의/리젝 가능성 → **심사 노트에 아키텍처 설명·데모 영상 첨부 권장**
- **SFMC 도메인 content script 주입**: 금지 정책 없음(표준 패턴). 요건은 ① Single Purpose 서술 ② host 패턴 정당화 ③ 사이트 기능 방해·기만 금지. 대상 도메인이 좁아 리스크 낮음
- **원격 코드(Remotely Hosted Code)**: 패키지 외부 코드 로딩·eval 금지. 단 "데이터와 로직의 구분"이 핵심 — **로컬 서버 응답(텍스트)을 내장 로직으로 렌더링하는 MCE Bot 구조는 원격 코드 비해당**. 응답 HTML을 script가 실행되는 형태로 삽입하면 위반 소지 → 정제된 마크업 렌더링 유지. Privacy 탭에 원격 코드 사용 여부 신고 필수
- **개인정보처리방침**: 사용자 데이터(인증 정보·웹사이트 콘텐츠·폼 데이터 등)를 취급하면 **외부 전송 없이 로컬 처리만 해도 공시 대상** — MCE Bot은 SFMC 페이지 콘텐츠·채팅 입력을 다루므로 **개인정보처리방침 URL 필수로 판단**. 데이터 사용 공시(수집 유형 체크 + Limited Use 인증) 미작성 시 게시 불가/정지
- 출처: …/program-policies/mv3-requirements / …/cws-dashboard-privacy / …/program-policies/user-data-faq / …/program-policies/code-readability

## 5. 스토어 등록 준비물 체크리스트

- **스토어 아이콘**: 128×128 PNG (실제 아트워크 96×96 + 사방 16px 투명 패딩 권장)
- **스크린샷**: 최소 1장~최대 5장, 1280×800 권장, 모서리 직각·패딩 없음, 실제 UX 표현
- **소형 프로모 타일**: 440×280 (사실상 필수 — 없으면 노출 순위 하락 명시)
- **마퀴 프로모 타일**: 1400×560 (선택)
- **텍스트**: 상세 설명(공란 시 리젝), Single Purpose 서술, 권한별 정당화, 카테고리, 개인정보처리방침 URL, 데이터 사용 공시
- **배포 설정**: 공개 범위·배포 국가. 심사 통과 후 **30일 내 게시하지 않으면 draft 회귀** (예약 게시 가능)
- 출처: https://developer.chrome.com/docs/webstore/images / …/cws-dashboard-privacy / …/publish

## 6. 업데이트 배포

- **모든 업데이트가 신규 등록과 동일한 심사 재통과** (공식 명시)
- 권한 불변·소규모 변경이면 통상 빠른 경향이나 구체 수치는 공식 확인 불가
- **심사 중에도 기존 게시본은 서비스 유지** (승인 시 교체)
- 부분 롤아웃은 7일 활성 사용자 1만 명 이상만 가능 — 미해당. 신속 심사 제도: 확인 불가(없음으로 판단)
- 출처: https://developer.chrome.com/docs/webstore/update

---

## 결론 — MCE Bot 기준 리스크 요약과 권장 배포 방식

- **정책 리스크 낮음**: MV3·좁은 host 권한·외부 코드 없음·폰트 내장 구조라 주요 리젝 사유 대부분 비해당. 주된 준비 부담은 **개인정보처리방침 URL + 데이터 사용 공시 + 권한별 정당화 서술**
- **권장 배포 방식**: **Unlisted**(링크 배포 + 고객사 IT의 `ExtensionInstallForcelist` 강제 설치 병행)가 B2B에 가장 현실적. Workspace 도메인 제한은 자사 전용이라 사용 불가, Private+Trusted Testers는 고객사 사용자별 Google 계정 등록 부담 큼
- **안전장치**: Unlisted는 링크만 알면 설치 가능하므로 **앱 레벨 접근 제어(계정 로그인 — admin-design.md의 인증 구조) 유지가 필수 안전장치**
- **계정 준비**: $5 등록 + 2단계 인증 + (상용 B2B이면) Trader 신원 검증(회사 정보·DUNS) 일정 반영
- **심사 대비**: 로컬 브리지 없이는 동작 검증 불가 → 심사 노트에 아키텍처 설명·데모 자료 첨부
