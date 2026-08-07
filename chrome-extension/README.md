# MCE Bot — Chrome 확장

실제 MCE(SFMC) 화면 위에 챗봇을 팝업(모달)으로 띄우는 Chrome 확장.
SFMC는 `frame-ancestors` 정책으로 외부 페이지에서의 iframe 삽입을 차단하므로,
반대로 **MCE 페이지 위에 챗봇을 오버레이**하는 방식. 이미 로그인된 MCE 세션 그대로 사용.

## 구조

```
MCE 페이지 (mc.exacttarget.com)
   └─ content.js  — 우하단 🤖 버튼 + 챗봇 패널 (Shadow DOM, 페이지 스타일과 격리)
        │  chrome.runtime Port
        ▼
   background.js — localhost:3456 web-bridge와 통신 (SSE 중계, 페이지 CSP/CORS 우회)
        │
        ▼
   web-bridge/server.js — claude CLI 실행 (스킬·워커·SFMC MCP)
```

## 설치 (1회)

1. `web-bridge` 서버 실행 확인 — `web-bridge\run-web.cmd`
2. Chrome → 주소창에 `chrome://extensions` 입력
3. 우상단 **개발자 모드** 켜기
4. **압축해제된 확장 프로그램을 로드합니다** 클릭 → 이 폴더(`chrome-extension`) 선택
5. MCE(`mc.exacttarget.com`) 접속 → 우하단 **🤖 버튼** 클릭

## 기능

- 플로팅 버튼(🤖) ↔ 챗봇 패널 토글 — MCE 화면을 가리지 않는 우하단 팝업
- 진행 상황 실시간 표시 — 도구 실행(🔧)·중간 안내(💬), 완료 후 "작업 과정 N단계"로 접이식 축약
- **대화 내역** — 헤더의 시계 아이콘으로 이전 대화 목록 확인, 클릭 시 해당 대화를 열어 맥락 그대로 이어가기(각 대화가 자기 Claude 세션 유지), 개별 삭제 가능 (최근 30개 보관)
- 대화 연속성 — localStorage 보존으로 새로고침·페이지 이동에도 유지
- 마크다운 렌더링(표·코드블록·링크) · 중지(⏹) · 새 대화(+)
- 라이트/다크 모드 자동 대응 (OS 설정 따름)

## 유의 사항

- 이 확장은 **web-bridge 서버가 켜져 있는 PC에서만** 동작 (localhost 통신)
- MCE 페이지를 읽거나 조작하지 않음 — 오버레이 UI만 추가
- 확장 업데이트(파일 수정) 후에는 `chrome://extensions`에서 새로고침(↻) 필요
