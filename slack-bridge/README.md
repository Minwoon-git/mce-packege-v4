# MCE Slack 브릿지

Slack 메시지를 받아 **이 PC의 Claude Code(CLI)** 로 처리하고 결과를 회신한다.
Socket Mode를 쓰므로 공개 IP·포트개방·터널이 필요 없다. PC가 켜져 있기만 하면 동작한다.

> **두 가지 대화 방식** (`@slack/bolt` v4 기준)
> - **Assistant 모드 (기본)** — 좌측 사이드바의 전용 어시스턴트 패널에서 멘션 없이 바로 대화한다. 자동으로 스레드가 잡히고 "처리 중…" 상태가 표시되며, 답변이 패널 안에만 쌓여 채널이 더러워지지 않는다.
> - **채널 @멘션 모드 (호환용)** — 채널에서 봇을 멘션하면 스레드로 답한다. 기존 방식 그대로 함께 동작한다.

---

## Slack 앱 설정 (토큰 2개 발급)

### 1. 앱 생성
1. https://api.slack.com/apps 접속 → **Create New App** → **From scratch**
2. App Name(예: `MCE봇`) 입력, 사용할 워크스페이스 선택 → **Create App**

### 2. Socket Mode 켜기 → App 토큰(xapp-) 발급
1. 좌측 **Settings → Socket Mode** → 토글 **Enable Socket Mode** 켜기
2. 토큰 이름 입력(예: `socket`) → 자동으로 `connections:write` 권한의 **App-Level Token** 생성
3. `xapp-` 로 시작하는 토큰 **복사** → `.env` 의 `SLACK_APP_TOKEN` 에 붙여넣기

### 3. Assistant(에이전트) 기능 켜기 — Assistant 모드용
1. 좌측 **Features → Agents & AI Apps**(또는 **App Home**의 Assistant 항목) → **활성화(Enable)**
2. 이 기능을 켜야 좌측 사이드바에 어시스턴트 패널이 나타나고 Assistant 모드가 동작한다.
   (이 단계를 건너뛰면 패널이 안 보이고 채널 @멘션 모드만 쓸 수 있다.)

### 4. 봇 권한(Scope) 추가
1. 좌측 **Features → OAuth & Permissions** → **Scopes → Bot Token Scopes**
2. 다음 권한 추가:
   - `app_mentions:read` (멘션 읽기 — 채널 @멘션 모드)
   - `chat:write` (메시지 보내기 — 공통)
   - `assistant:write` (어시스턴트 패널 응답 — Assistant 모드)
   - `im:history` (어시스턴트 스레드 메시지 읽기 — Assistant 모드)

### 5. 이벤트 구독
1. 좌측 **Features → Event Subscriptions** → **Enable Events** 켜기
2. **Subscribe to bot events** → **Add Bot User Event** 로 아래 이벤트 추가 → **Save Changes**
   - `app_mention` (채널 @멘션 모드)
   - `assistant_thread_started` (Assistant 모드 — 패널 대화 시작)
   - `assistant_thread_context_changed` (Assistant 모드 — 컨텍스트 변경)
   - `message.im` (Assistant 모드 — 패널 사용자 메시지)

### 6. 워크스페이스에 설치 → Bot 토큰(xoxb-) 발급
1. 좌측 **Settings → Install App** → **Install to Workspace** → 허용
2. **Bot User OAuth Token** (`xoxb-` 로 시작) **복사** → `.env` 의 `SLACK_BOT_TOKEN` 에 붙여넣기

> ⚠️ 스코프·이벤트를 나중에 추가하면 **반드시 Reinstall** 해야 반영된다. (Install App 페이지에서 재설치)

### 7. 채널에 봇 초대 (채널 @멘션 모드를 쓸 때)
- 사용할 Slack 채널에서: `/invite @MCE봇`
- Assistant 모드만 쓸 거면 채널 초대 없이 좌측 사이드바의 봇(어시스턴트)을 열어 바로 입력하면 된다.

---

## 실행

```powershell
# 1) .env.example 을 .env 로 복사 후 토큰 2개 채우기
Copy-Item slack-bridge\.env.example slack-bridge\.env

# 2) 실행
npm start --prefix slack-bridge
```

콘솔에 `⚡ MCE Slack 브릿지 실행 중 (Socket Mode · Assistant 모드)` 이 뜨면 성공.

> **PowerShell 실행 정책 오류 시** (`npm.ps1 파일을 로드할 수 없습니다 / PSSecurityException`) — `npm` 대신 **node로 직접** 실행하면 정책을 우회한다 (`.env` 는 파일 위치 기준으로 로드되므로 어느 폴더에서 실행해도 된다):
> ```powershell
> node slack-bridge\bridge.js
> ```
> 또는 `npm.cmd start --prefix slack-bridge` / 정책 완화 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

---

## 자동 실행 (PC 켜질 때 — 선택)

로그인할 때마다 봇이 **창 없이 자동 시작**되고 **죽으면 자동 재시작**되게 하려면, 동봉된 런처를 시작프로그램에 등록한다. (관리자 권한 불필요)

- `run-bridge.cmd` — node로 브릿지를 실행하고, 종료되면 5초 후 재시작하는 루프. (저장소에 포함)
- 시작프로그램 폴더(`shell:startup` = `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`)에 **창을 숨겨 `run-bridge.cmd` 를 호출하는 `.vbs`** 를 만들어 둔다. (PC별 경로라 저장소엔 미포함)

`Startup\MCE-Slack-Bridge.vbs` 예시:
```vbs
Set sh = CreateObject("WScript.Shell")
' 0 = 숨김 창, False = 대기 안 함 — 경로는 실제 프로젝트 위치로 교체
sh.Run "cmd /c ""C:\...\mce-package-v3-main\slack-bridge\run-bridge.cmd""", 0, False
```

- **즉시 켜기**(재로그인 없이): `wscript.exe "<위 .vbs 경로>"`
- **자동 실행 해제**: 위 `.vbs` 파일 삭제
- 작업 스케줄러로도 가능하나, 환경에 따라 등록에 관리자 권한이 필요할 수 있어 **시작프로그램 폴더 방식이 더 간단**하다.
- 창이 숨겨져 **로그가 안 보인다.** 문제 진단 시엔 자동 실행을 잠깐 끄고 `node slack-bridge\bridge.js` 로 직접 띄워 로그를 본다.

> `.bat`/`.cmd` 는 반드시 **CRLF 줄바꿈**이어야 `goto`/`:label` 이 정상 동작한다. (LF 로 저장되면 자동 재시작 루프가 깨진다.)

**사용 방법 (택1)**

- **Assistant 모드** — 좌측 사이드바에서 봇(어시스턴트)을 열고 바로 입력. 첫 진입 시 추천 프롬프트가 뜬다.
- **채널 @멘션 모드** — 채널에서 봇을 멘션:
  ```
  @MCE봇 이탈 고객 캠페인 만들어줘
  ```

두 방식 모두 **같은 스레드(또는 같은 어시스턴트 대화)에서 이어 말하면 대화가 유지**된다(`--resume`). 캠페인 선택·승인 등 수동 모드 후속 질문에 그대로 응답할 수 있다.

**누적 사용량 조회**: 대화 중 `사용량`(또는 `usage`) 이라고 입력하면 해당 대화의 처리 횟수·누적 비용을 보여준다.

---

## 봇 메시지 정리 — `cleanup.js`

봇이 채널에 남긴 **자기 메시지를 일괄 삭제**하는 1회용 유틸이다. (사용자 메시지는 `chat:write`로 지울 수 없다.)

```powershell
node slack-bridge\cleanup.js <채널이름 또는 채널ID>
# 예: node slack-bridge\cleanup.js mce-bot
```

- 채널 히스토리를 읽어야 하므로 채널 종류에 맞는 `history` 스코프(`channels:history` / `groups:history` 등)가 필요하다. 스코프가 없으면 `missing_scope` 오류와 함께 필요한 스코프를 안내한다.

---

## 사용 계정 · 사용량 (중요)

봇은 매 요청마다 이 PC의 `claude` CLI(`claude -p`)를 실행한다. 따라서:

- 봇은 **이 PC의 `claude` CLI에 로그인된 계정**으로 동작하며, **토큰·사용량도 그 계정에서 차감**된다. (데스크톱 Claude 앱에 로그인한 계정과 **다를 수 있다.**)
- 봇이 `You've hit your session limit · resets ...` 같은 한도 메시지를 답하면, 그건 봇 오류가 아니라 **CLI 로그인 계정의 사용 한도**에 도달한 것이다. 데스크톱 앱 `/usage`가 여유로워 보여도, **그 계정이 CLI 계정과 다르면 무관**하다.
- 현재 CLI 로그인 계정 확인: `C:\Users\<사용자>\.claude.json` 의 `emailAddress` 필드.

**계정을 바꾸려면 (= 봇이 쓰는 계정 변경):**
1. 터미널에서 `claude` 실행 → `/logout` → `/login` 으로 원하는 계정 로그인
2. **브릿지 재시작** — `npm start --prefix slack-bridge` (이미 떠 있는 브릿지는 교체 전 인증을 계속 쓰므로, 새로 띄워야 새 계정이 반영된다)

> CLI 계정 교체는 **사용량/과금 주체만** 바꾼다. SFMC(MCE) 접근·캠페인 기능은 별도의 MCP 엔드포인트 인증에 묶여 있어 **계정 교체와 무관**하다. (SFMC 연결 오류는 따로 재인증해야 한다.)

---

## 참고
- 봇은 사람이 "허용"을 못 누르므로 `--dangerously-skip-permissions` 로 자동 승인한다.
  보안이 신경 쓰이면 `.claude/settings.json` 의 `allowedTools` 화이트리스트(sfmc 도구만)로 대체 가능.
- **무응답일 때 1순위 점검** — 이 PC에서 `npm start --prefix slack-bridge` 프로세스가 떠 있는지 확인한다. Socket Mode는 이 프로세스가 살아 있을 때만 연결되므로, 꺼져 있으면 멘션·패널 입력 모두 무응답이다.
- 이 PC가 꺼지면 봇도 멈춘다. 상시 운영하려면 PC 절전 해제 또는 서비스 등록 필요.
- 의존성: `@slack/bolt` v4 (Assistant API 사용). 구버전(v3)에서는 Assistant 모드가 동작하지 않는다.
- **대화 연속성·인사말은 디스크에 보존된다** — 세션 매핑(`--resume`)과 "인사한 스레드" 여부를 `slack-bridge/.bridge-state.json`에 저장한다. 덕분에 **브릿지를 재시작/재연결해도** 대화 맥락이 이어지고, 기존 스레드에 인사말이 중복으로 다시 뜨지 않는다. (이 파일은 로컬 전용이라 git 추적 안 함)
- **처리 중 표시 방식이 모드별로 다름** — @멘션 모드는 `⏳ 처리 중…` 메시지를 올렸다 결과로 교체하고, Assistant 패널 모드는 패널 하단의 상태 표시(`setStatus`)로만 보여준다(모래시계 버블 없음).
