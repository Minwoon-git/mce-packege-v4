# MCE 웹 브릿지 (web-bridge)

Chrome 확장(`chrome-extension/`) ↔ 로컬 Claude Code(CLI) 브릿지 **API 서버**. `slack-bridge`의 웹 버전.
이 repo의 스킬(`mce-campaign`·`mce-onboarding`·`mce-base-setup`)·워커·SFMC MCP를 그대로 사용.
(자체 웹 채팅 페이지는 제거됨 — UI는 Chrome 확장이 담당)

## 구조

```
Chrome 확장 (MCE 화면 위 챗봇 팝업)
   │  POST /api/chat  (SSE 스트리밍 응답)
   ▼
server.js (Express, localhost:3456)
   │  claude -p --output-format stream-json --resume <세션>
   ▼
Claude Code CLI (cwd = 프로젝트 루트 → CLAUDE.md·스킬·에이전트·sf-mce-mcp 적용)
```

## 실행

- 사전 조건: 이 PC에 `claude` CLI 설치 + SFMC MCP(`sf-mce-mcp`) 인증 완료 상태
- 최초 1회: `cd web-bridge && npm install`
- 실행: `run-web.cmd` 더블클릭 (크래시 시 5초 후 자동 재시작) 또는 `node server.js`
- 콘솔 창을 닫으면 서버도 종료됨 — 챗봇 사용 중에는 창을 열어 둘 것 (PC 재부팅 후 재실행 필요)
- 포트 변경: 환경변수 `PORT` 지정 (변경 시 `chrome-extension/background.js`·`manifest.json`의 주소도 함께 수정)

## 계정 게이트 (챗봇 버튼 노출 제한)

- `config.example.json`을 `config.json`으로 복사 → `allowedAccounts`에 MCE 상단 헤더에 표시되는 계정명(BU 이름) 기입
- 확장이 시작 시 `GET /api/config`로 이 목록을 받아, **계정명이 상단 헤더 가시 영역에 보이는 MCE에서만** 🤖 버튼을 노출
- 파일이 없거나 목록이 비어 있으면 게이트 없이 모든 MCE 화면에서 노출
- **서버가 꺼져 있으면 확장이 버튼을 아예 숨김**(fail-closed) — 모든 BU에 버튼이 뜬다면 서버 다운 여부부터 확인
- `config.json`은 테넌트별 값이므로 git 추적 제외 (.gitignore 등록됨)
- 수정 후 서버 재시작 필요

## API

- `POST /api/chat` — `{ message, sessionId?, chatId? }` → SSE 스트림
  - 이벤트: `session`(세션 ID) · `tool`(도구 실행) · `text`(중간 안내) · `result`(최종 답변+비용) · `error` · `done`
  - `sessionId`를 주면 `--resume`으로 대화 맥락을 이어간다
- `POST /api/stop` — `{ chatId }` → 실행 중인 요청 프로세스 종료 (Windows에서는 `taskkill /T /F`로 프로세스 트리 전체 종료). 중단된 요청은 `result` 이벤트로 "⏹ 요청을 중단했습니다."를 내려보냄

## 유의 사항

- `--dangerously-skip-permissions`로 실행 — 사람이 "허용"을 누를 수 없는 헤드리스 구조이기 때문 (slack-bridge와 동일). 외부 공개 시 반드시 인증 계층 추가 필요
- 탭을 닫아도 진행 중 작업은 계속됨 — 다시 열면 같은 세션으로 이어짐
- 비용 표시는 Claude Team 구독 한도에서 차감되는 환산 참고치 (별도 청구 아님)

## SFMC Custom App 등록 (선택, 추후)

- MCE 화면 안 탭으로 띄우려면: 챗봇 UI를 HTTPS로 호스팅 → SFMC Setup > Apps > Installed Packages > New > Marketing Cloud App 컴포넌트 추가 → Login/Redirect URL에 앱 URL 등록
- SFMC는 `frame-ancestors`로 외부 페이지에서의 iframe 삽입을 차단하므로, 반대 방향(SFMC 안에 앱을 삽입)만 가능
