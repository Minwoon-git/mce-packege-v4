# sf-mce-mcp

Salesforce Marketing Cloud Engagement (MCE) MCP 서버입니다. Claude Code에서 SFMC의 주요 기능을 자연어로 조작할 수 있도록 도구(Tool)를 제공합니다.

---

## 개요

| 항목 | 내용 |
|------|------|
| **서버명** | `sf-mce-mcp` |
| **연동 플랫폼** | Salesforce Marketing Cloud Engagement |
| **주요 기능** | Journey Builder, Data Extension, Email/SMS 발송, Automation Studio, Content Builder |
| **캠페인 자동화** | **오케스트레이터 + 하위 워커** — 상위 에이전트([CLAUDE.md](CLAUDE.md))가 총괄하고 STEP 1~3을 워커(topic/planning/journey)에 위임 |

---

## 서버 아키텍처

`sf-mce-mcp`는 로컬에서 실행되는 서버가 아닌 **Salesforce가 호스팅하는 원격 MCP 서버**입니다.

```
https://mai-mce-mcp-cdp1.sfdc-yfeipo.svc.sfdcfc.net/t/<테넌트ID>/c/<세션토큰>/api/mcp
```

- 별도의 서버 설치, 빌드, 실행이 필요 없습니다
- SFMC 계정(테넌트)마다 고유한 엔드포인트가 자동 할당됩니다
- 모든 SFMC API 호출은 Salesforce 인프라 내에서 처리됩니다

---

## 다른 PC에서 가져와 사용하기 (빠른 시작)

이 저장소를 새 PC로 옮길 때는 아래 3단계면 됩니다. (경로 수정·치환 작업은 필요 없습니다.)

```bash
# 1) 저장소 가져오기 — clone 위치/폴더명은 자유
git clone <레포 URL>
cd <클론한 폴더>

# 2) 의존성 설치 — node_modules 는 깃에 없으므로 반드시 실행
npm install

# 3) 원격 MCP 서버 연결 (토큰은 PC/계정마다 다름 → 직접 등록)
claude mcp add --transport http sf-mce-mcp "<발급받은 엔드포인트 URL>"
```

- **사전 요구사항**: 새 PC에 **Node.js**와 **Claude Code CLI**가 설치돼 있어야 합니다. (xlsx 파싱에 Python을 쓰는 경우 Python도 권장)
- **경로 자동 적용**: `CLAUDE.md`의 절대경로 예시(`C:\Users\...\mce-packege-v2-main`)는 **작성 당시 PC 기준 예시**일 뿐입니다. Claude Code가 실행 시 **현재 작업 디렉토리(cwd)를 프로젝트 루트로 삼아 모든 경로를 자동 적용**하므로, clone 위치가 달라도 그대로 동작합니다. (별도 설치/치환 스크립트 불필요)
- **로컬 권한 파일**: `.claude/settings.local.json`은 PC마다 다른 **로컬 전용 권한 파일**이라 깃 추적에서 제외돼 있습니다. 새 PC에서는 자동 생성되며, 도구 사용을 승인하면서 권한이 다시 누적됩니다. (공유 권한은 추적되는 `.claude/settings.json`에 있음)

> 발급받을 엔드포인트 URL을 모른다면 아래 **설치 및 연결** 1단계(Installed Package)부터 진행해 테넌트별 URL을 발급받으세요.

### ⚠️ `.mcp.json`은 깃에 없습니다 — clone 후 직접 만들어야 동작합니다

MCP 엔드포인트 URL에는 **테넌트·세션 토큰**이 들어 있어 PC/계정마다 다릅니다. 그래서 `.mcp.json`은 `.gitignore`로 **추적 제외**돼 있고, **clone하면 이 파일이 없습니다.** 둘 중 한 방법으로 연결하세요. (둘 다 같은 효과 — 하나만 하면 됩니다.)

**방법 A — CLI로 등록 (간편):**

```bash
claude mcp add --transport http sf-mce-mcp "<발급받은 엔드포인트 URL>"
```

**방법 B — `.mcp.json` 파일 직접 생성 (프로젝트에 고정·팀 공유에 유리):**
프로젝트 루트(이 README와 같은 위치)에 `.mcp.json` 파일을 만들고 아래 내용을 붙여넣습니다. `url`만 발급받은 본인 엔드포인트로 바꿉니다.

```json
{
  "mcpServers": {
    "sf-mce-mcp": {
      "type": "http",
      "url": "https://mai-mce-mcp-cdp1.sfdc-yfeipo.svc.sfdcfc.net/t/<테넌트ID>/c/<세션토큰>/api/mcp"
    }
  }
}
```

> - 엔드포인트 URL을 아직 모르면 아래 **설치 및 연결 1단계**(Installed Package)부터 진행해 발급받으세요.
> - **1 연결 = 1 BU 고정**입니다. 다른 BU(사업부)를 쓰려면 그 BU용 엔드포인트로 `url`을 교체하면 됩니다. (알림톡 커스텀 액티비티도 MCP가 연결된 그 BU에 설치돼 있어야 동작 — 본문 "커스텀 액티비티" 절 참고)
> - 등록 후 Claude Code에서 `/mcp` 로 `Connected to sf-mce-mcp` 를 확인하세요.

---

## 설치 및 연결

### 1단계: Marketing Cloud Installed Package 설정

Marketing Cloud에서 API 연동용 패키지를 생성합니다.

1. Marketing Cloud 로그인 후 **Administration** 이동
2. **Installed Packages** 클릭
3. **New** 버튼으로 새 패키지 생성
4. 패키지 이름 입력 후 **Add Component** 클릭
5. Component 유형: **API Integration** 선택
6. Integration 유형: **Server-to-Server** 선택
7. 아래 권한(Scope) 설정 후 저장:

| 카테고리 | 권한 |
|----------|------|
| Email | Read, Write, Send |
| Journeys | Read, Write, Execute |
| List and Subscribers | Read, Write |
| Data Extensions | Read, Write |
| Contacts | Read, Write |
| Automation | Read, Write, Execute |
| SMS | Read, Write, Send |
| Push | Read, Write, Send |

8. 저장 후 생성된 **Client ID**, **Client Secret**, **MID(Account ID)** 확인
9. 인증 URL(`https://xxxxxxxxx.auth.marketingcloudapis.com`)에서 **28자리 Subdomain** 확인

> 위에서 확보한 **Client ID / Client Secret / MID / Subdomain**은 Salesforce가 호스팅하는 원격 MCP 서버를 발급받을 때 사용됩니다.
> 이 값들로 테넌트별 MCP 엔드포인트 URL(아래 2단계의 `https://...sfdcfc.net/t/<테넌트ID>/c/<세션토큰>/api/mcp`)이 생성되며, 인증은 이 URL에 포함된 세션 토큰으로 처리됩니다.
> (로컬에 Client ID/Secret를 직접 입력하는 과정은 없으며, 발급받은 URL을 2단계에서 등록합니다.)

---

### 2단계: Claude Code에 MCP 서버 연결

1단계에서 발급받은 **원격 MCP 엔드포인트 URL**을 HTTP transport로 등록합니다.

```bash
claude mcp add --transport http sf-mce-mcp "https://mai-mce-mcp-cdp1.sfdc-yfeipo.svc.sfdcfc.net/t/<테넌트ID>/c/<세션토큰>/api/mcp"
```

> ⚠️ 이 서버는 **원격 HTTP MCP 서버**이므로 `--transport http`와 URL을 반드시 지정해야 합니다.
> `claude mcp add sf-mce-mcp`처럼 이름만 주면 로컬(stdio) 서버로 처리되어 연결되지 않습니다.

연결 확인:

```
/mcp
```

성공 시 `Authentication successful. Connected to sf-mce-mcp.` 메시지가 표시됩니다.

---

## 통합 캠페인 에이전트 (오케스트레이터 + 하위 워커 흐름)

사용자가 만들고 싶은 캠페인을 **간략한 한 문장**(예: "신규 회원을 위한 캠페인 생성")으로 입력하면,
**상위 에이전트(오케스트레이터)**([CLAUDE.md](CLAUDE.md))가 총괄하여 STEP 1~4를 진행해 MCE 캠페인을 완성합니다.
사용자는 상위 에이전트하고만 대화하고, 상위가 각 STEP을 담당 **하위 워커**(`mce-topic-agent`/`mce-planning-agent`/`mce-journey-agent`)에게 `Agent` 도구로 위임합니다.
사용자와의 모드 선택·승인은 상위가 하위 호출 사이에서 처리합니다. (Codex 실행 시에는 서브에이전트 도구가 없어 메인 루프가 동일 절차를 직접 수행 — [AGENTS.md](AGENTS.md) 참고)

```
사용자 입력 → 상위 에이전트(오케스트레이터)
  → [STEP 1] 주제 선정   : mce-topic-agent   — 연결 DE 분석 → 후보 추천 → (상위가) 사용자 선택
  → [STEP 2] 모드 선택 + 기획 : mce-planning-agent — 수동/자동 선택 → Plan 설계 + xlsx 정의서 생성
  → [STEP 3] Journey 생성 : mce-journey-agent  — 정의서 기반 SFMC Journey 생성 (기본 Draft)
  → [STEP 4] 결과 보고     : 상위가 종합 보고
```

**STEP 1 입력 2갈래** — 사용자가 입력한 문장에 의도 키워드가 있는지로 갈립니다.

| 갈래 | 입력 예 | 출력 |
|------|---------|------|
| **리스트업 (의도 없음)** | "생성 가능한 캠페인 리스트 업", "어떤 캠페인 만들 수 있어?" | 진입 DE 목록만 간단히 번호로 제시 |
| **의도 포함** | "신규회원 캠페인 만들어줘", "장바구니 캠페인" | 해당 DE의 상세 후보 표(복잡도 단순→복합, 2~5개) |

> 리스트업으로 DE 목록을 먼저 본 뒤 특정 캠페인을 지목하면 자동으로 의도 갈래(상세 후보 표)로 전환됩니다.

> 사용자가 정의서(xlsx/CSV/Google Sheets)를 **직접 첨부**한 경우 STEP 1·2를 건너뛰고 STEP 3으로 바로 이동합니다.

**실행 모드 (STEP 2부터 적용)**
- **수동(Manual)**: Plan 구성을 사용자와 대화로 합의한 뒤 정의서/Journey 생성, 생성 전 승인.
- **자동(Auto)**: 대화 없이 Plan 기획 → 정의서 → Journey 생성까지 일괄 진행.

**동작 원칙**
- **결과만 전달**: 진행 과정·중간 작업 설명을 출력하지 않고, 단계 전환 질문·최종 결과·오류만 사용자에게 노출합니다. **자동 모드에서도 동일**하며, STEP 1~4를 무발화로 일괄 실행한 뒤 마지막 실행 결과만 보여줍니다.
- **오류 자기 학습**: 캠페인 생성 중 오류가 발생해 수정/우회하면, 그 원인·해결책을 CLAUDE.md의 `오류 학습 / 알려진 이슈` 표에 즉시 추가하여 다음 캠페인 생성 시 같은 오류를 반복하지 않습니다.

**공통 기능:**
- 연결된 DE/필드 분석 기반 캠페인 추천
- CSV/XLSX/Google Sheets 정의서 파싱 및 MCE 컴포넌트 자동 생성
- Journey Builder 다단계 플로우(Decision/Engagement Split, Wait, Email) 구성
- Event Definition + Automation 스케줄(Recurring/On Activation) 설정
- 한국어 정의서 완전 지원

---

## 초기 세팅 점검 에이전트 (온보딩)

"세팅 점검해줘", "발송 준비됐어?", "남은 세팅 뭐야" 같은 요청에 대해, **`mce-onboarding` 스킬**을 로드하고 **`mce-onboarding-agent` 워커**에 위임하여, 이 계정으로 MCE를 **운영(발송)할 수 있는 상태인지**를 진단합니다.

- **읽기 전용 진단 + 가이드**입니다. 계정 설정을 자동으로 변경하지 않습니다.
- IP 워밍·도메인 인증·물리 주소처럼 API로 점검 불가한 항목은 `❌ 확인 필요`로 **표시만** 하고, 권장 일정은 **텍스트 플랜으로만** 제시합니다(리마인더 등록 안 함).

**점검 카테고리 (A / C / D):**

| 카테고리 | 점검 내용 | 방식 |
|---|---|---|
| **A. 접속/연동 기반** | API 연동(Installed Package), Business Unit, 사용자/권한, 기능 프로비저닝(Email/Journey/Automation/Contact Builder) | 🟢 API 확인 · 🟡 응답 추론 · 🔵 Setup 수동 |
| **C. 발송 인증/평판** | 도메인 인증(SAP/SPF·DKIM·DMARC), 전용 IP·IP 워밍, Reply Mail Management, CAN-SPAM 물리 주소, 트래킹 도메인 | 🔵 Setup 수동(표시만) |
| **D. 발송 구성** | Sender Profile, Send Classification(Marketing/Operational), Delivery Profile, 구독/프로필 센터 | 🟢 API 확인 |

> 데이터/대상(진입 DE·데이터 적재·구독 리스트)은 온보딩 점검 범위 밖이며, 캠페인 흐름(`mce-topic-agent` STEP 1)이 담당합니다. 온보딩은 "데이터 모델을 쓸 수 있는가"(카테고리 A 추론)까지만 봅니다.
>
> 점검 항목·판정 기준·IP 워밍 램프 템플릿의 단일 출처(SSOT)는 [`.claude/skills/mce-onboarding/`](.claude/skills/mce-onboarding/) 입니다.

```
세팅 점검해줘                  # A/C/D 점검 → ✅/⚠️/❌ 리포트 + 잔여 태스크
발송 준비됐어?                 # 운영 발송 전 필수 항목(도메인 인증·물리 주소·구독센터) 확인
IP 워밍 일정 알려줘            # 전용 IP 신규 시 4주 램프 텍스트 플랜
```

---

## 사전 준비 — 의존성 설치

정의서(xlsx) 생성 스크립트(`generate_campaign_definition.js`)는 `exceljs` 패키지를 사용합니다.
최초 1회 프로젝트 루트에서 설치합니다.

```bash
npm install
# 또는 개별 설치
npm install exceljs
```

> ⚠️ 미설치 시 정의서 생성 단계에서 `Error: Cannot find module 'exceljs'` 오류가 발생합니다.

---

## 제공 도구 목록

### Data Extension (DE)

| 도구 | 설명 |
|------|------|
| `sfmc_get_data_extensions` | DE 목록 검색 조회 |
| `sfmc_get_data_extension` | 단일 DE 상세 조회 |
| `sfmc_get_data_extension_fields` | DE 필드 목록 조회 |
| `sfmc_get_data_extension_folders` | DE 폴더 목록 조회 |
| `sfmc_get_data_extensions_by_category` | 카테고리별 DE 조회 |
| `sfmc_get_data_extension_link` | DE 링크 조회 |
| `sfmc_create_data_extension` | DE 생성 |
| `sfmc_create_data_extension_field_async` | DE 필드 추가 (비동기) |
| `sfmc_update_data_extension` | DE 수정 |
| `sfmc_update_data_extension_field_async` | DE 필드 수정 (비동기) |
| `sfmc_delete_data_extension` | DE 삭제 |
| `sfmc_clear_data_extension_data` | DE 데이터 전체 초기화 |
| `sfmc_retrieve_data_extension_record` | DE 레코드 조회 |
| `sfmc_upsert_data_extension_record` | DE 레코드 삽입/수정 |
| `sfmc_data_extension_trigger` | DE Entry 트리거 JSON 생성 |

### Journey Builder

| 도구 | 설명 |
|------|------|
| `sfmc_get_journeys` | Journey 목록 조회 |
| `sfmc_get_journey` | 단일 Journey 상세 조회 (ASCII 플로우 시각화 포함) |
| `sfmc_get_journey_versions` | Journey 버전 목록 조회 |
| `sfmc_get_journey_link` | Journey UI 링크 조회 |
| `sfmc_get_journey_publish_status` | Journey 발행 상태 조회 |
| `sfmc_create_journey` | Journey 생성 (기본) |
| `sfmc_create_journey_builder_journey` | Journey 생성 (워크플로우 가이드 포함) |
| `sfmc_update_journey` | Journey 수정 |
| `sfmc_publish_journey` | Journey 발행 |
| `sfmc_pause_journey` | Journey 일시정지 |
| `sfmc_resume_journey` | Journey 재개 |
| `sfmc_stop_journey` | Journey 중지 |
| `sfmc_delete_journey` | Journey 삭제 |
| `sfmc_republish_journey_content` | Journey 콘텐츠 재발행 |
| `sfmc_fire_journey_event` | Journey API 이벤트 발동 |
| `sfmc_insert_contacts_into_journey_async` | Journey 연락처 일괄 삽입 (비동기) |
| `sfmc_insert_contacts_into_journey_status` | 연락처 삽입 상태 확인 |
| `sfmc_exit_contact_from_journey` | Journey에서 연락처 제거 |
| `sfmc_exit_contact_from_journey_status` | 연락처 제거 상태 확인 |

### Journey 액티비티 빌더

| 도구 | 설명 |
|------|------|
| `sfmc_email_activity` | Email 액티비티 JSON 생성 |
| `sfmc_sms_activity` | SMS 액티비티 JSON 생성 |
| `sfmc_wait_activity` | Wait 액티비티 JSON 생성 |
| `sfmc_decision_split_activity` | Decision Split JSON 생성 |
| `sfmc_random_split_activity` | Random Split JSON 생성 |
| `sfmc_engagement_decision_activity` | Engagement Decision Split JSON 생성 (이메일 오픈/클릭 기반) |
| `sfmc_einstein_sto_activity` | Einstein STO(최적 발송 시간) 액티비티 JSON 생성 |
| `sfmc_einstein_engagement_frequency_activity` | Einstein Engagement Frequency Split JSON 생성 |

### Event Definition

| 도구 | 설명 |
|------|------|
| `sfmc_get_event_definitions` | Event Definition 목록 조회 |
| `sfmc_get_event_definition` | 단일 Event Definition 조회 |
| `sfmc_create_event_definition` | Event Definition 생성 (APIEvent / EmailAudience) |
| `sfmc_update_event_definition` | Event Definition 수정 |
| `sfmc_delete_event_definition` | Event Definition 삭제 |
| `sfmc_api_event_trigger` | API Event 트리거 JSON 생성 |

### Email

| 도구 | 설명 |
|------|------|
| `sfmc_create_email` | 이메일 생성 |
| `sfmc_create_email_template` | 이메일 템플릿 생성 |
| `sfmc_create_email_send_definition` | 이메일 발송 정의 생성 |
| `sfmc_send_transactional_email` | 트랜잭셔널 이메일 발송 |
| `sfmc_refresh_transactional_email` | 트랜잭셔널 이메일 갱신 |
| `sfmc_get_transactional_send_status` | 트랜잭셔널 발송 상태 조회 |
| `sfmc_create_triggered_send_definition` | Triggered Send 정의 생성 |
| `sfmc_republish_triggered_send` | Triggered Send 재발행 |
| `sfmc_get_triggered_send_summary` | Triggered Send 요약 조회 |
| `sfmc_get_email_subscription_status` | 이메일 구독 상태 조회 |
| `sfmc_get_send_classifications` | 발송 분류(Send Classification) 조회 |
| `sfmc_get_sender_profiles` | 발신자 프로필 조회 |

### SMS

| 도구 | 설명 |
|------|------|
| `sfmc_create_sms` | SMS 콘텐츠 에셋 생성 |
| `sfmc_create_sms_definition` | SMS 발송 정의 생성 |
| `sfmc_create_sms_send_definition` | SMS Send Definition 생성 |
| `sfmc_get_sms_definition` | SMS 정의 단건 조회 |
| `sfmc_get_sms_definitions` | SMS 정의 목록 조회 |
| `sfmc_send_outbound_sms_message` | 아웃바운드 SMS 즉시 발송 |
| `sfmc_get_sms_subscription_status` | SMS 구독 상태 조회 |
| `sfmc_get_mobileconnect_codes` | MobileConnect 코드 조회 |
| `sfmc_create_mobileconnect_keyword` | MobileConnect 키워드 생성 |

### Content Builder

| 도구 | 설명 |
|------|------|
| `sfmc_get_content_assets` | 콘텐츠 에셋 목록 조회 |
| `sfmc_get_content_builder_asset` | 콘텐츠 에셋 단건 조회 |
| `sfmc_create_content_builder_asset` | 콘텐츠 에셋 생성 |
| `sfmc_update_content_builder_asset` | 콘텐츠 에셋 수정 |
| `sfmc_search_content_builder_assets` | 콘텐츠 에셋 검색 |
| `sfmc_get_content_categories` | 콘텐츠 카테고리 조회 |

### Automation Studio

| 도구 | 설명 |
|------|------|
| `sfmc_get_automations` | Automation 목록 조회 |
| `sfmc_get_automation` | Automation 단건 조회 |
| `sfmc_get_automation_instance` | Automation 실행 인스턴스 조회 |
| `sfmc_get_automation_categories` | Automation 카테고리 조회 |
| `sfmc_create_automation` | Automation 생성 |
| `sfmc_update_automation` | Automation 수정 |
| `sfmc_run_automation` | Automation 즉시 실행 |
| `sfmc_run_automation_activities` | Automation 특정 액티비티 실행 |

### SQL Query (Automation Studio)

| 도구 | 설명 |
|------|------|
| `sfmc_create_sql_query` | SQL Query 액티비티 생성 |
| `sfmc_get_sql_query` | SQL Query 단건 조회 |
| `sfmc_get_sql_queries` | SQL Query 목록 조회 |
| `sfmc_update_sql_query` | SQL Query 수정 |
| `sfmc_run_sql_query` | SQL Query 즉시 실행 |
| `sfmc_validate_sql_query` | SQL Query 유효성 검사 |

### 연락처 및 구독자

| 도구 | 설명 |
|------|------|
| `sfmc_get_contact_key_by_email_address` | 이메일 주소로 Contact Key 조회 |
| `sfmc_retrieve_contact_status` | 연락처 상태 조회 |
| `sfmc_update_contact_attributes` | 연락처 속성 수정 |
| `sfmc_search_attributes` | 연락처 속성 검색 |
| `sfmc_get_list_subscribers` | 구독 목록의 구독자 조회 |
| `sfmc_get_lists` | 구독 목록 조회 |

### Push 알림

| 도구 | 설명 |
|------|------|
| `sfmc_send_push_notification` | 푸시 알림 발송 |
| `sfmc_get_push_opt_in_status_by_subscriber_key` | Subscriber Key로 푸시 수신 동의 상태 조회 |

### 기타 유틸리티

| 도구 | 설명 |
|------|------|
| `sfmc_get_timezones` | 사용 가능한 타임존 목록 조회 |
| `sfmc_describe_object` | SFMC 오브젝트 스키마 조회 (SOAP API) |

---

## 사용 예시

### 통합 캠페인 에이전트 (권장)

캠페인 의도를 **한 문장**으로 입력하면 메인 루프가 STEP 1~4를 직접 수행합니다.
(주제 선정 → 후보 추천 → 모드 선택 → 정의서 생성 → Journey 생성 → 결과 보고)

```
생성 가능한 캠페인 리스트 업           # 의도 없음 → 진입 DE 목록만 제시
신규 회원을 위한 캠페인 생성          # 의도 포함 → 캠페인 상세 후보 표
생일 고객을 위한 캠페인 만들어줘       # 후보 선택 → 모드(수동/자동) → 정의서 + Journey
이탈 고객 캠페인 자동으로 만들어줘     # 자동 모드: STEP 1~4 무발화 일괄 생성
```

정의서(xlsx/CSV/Google Sheets)를 직접 첨부하면 STEP 1·2를 건너뛰고 Journey 생성으로 바로 진입합니다.

```
campaign_definitions/CP_019_생일쿠폰_열람분기Journey_20260610.xlsx 로 저니 생성해줘
CP_019 정의서로 Journey 만들어줘        # 캠페인 ID만으로 폴더 검색 후 생성
방금 만든 정의서로 저니 생성해줘         # 최신 xlsx 자동 선택
```

### 개별 도구 직접 호출

에이전트 흐름을 거치지 않고 `sfmc_*` 도구를 단건으로 활용할 수도 있습니다.

```
# Journey 생성
welcome Journey를 만들어줘.
- 진입 트리거: DE Key = 1sgHo00000001MNIAY_85RHo00000000ZMMAY_I
- 액티비티: 이메일 → Wait 2일 → Engagement Split (오픈 여부)
- 재진입: 불가

# Data Extension 조회
최근 생성된 Data Extension 1개만 찾아줘

# Journey 수정
welcome Journey의 Wait를 1일로 수정해줘

# SQL Query 실행
All_Customer DE에서 오늘 가입한 회원만 조회하는 SQL Query를 실행해줘
```

---

## Journey 생성 워크플로우

`sfmc_create_journey_builder_journey` 도구는 5단계 워크플로우를 따릅니다:

```
Step 1: Journey 이름 설정
Step 2: 진입 방식 + 재진입 설정 (API Event / Data Extension)
Step 3: 채널 + 에셋 결정 (Email / SMS / 기존 사용 여부)
Step 4: 에셋 준비 (Event Definition, 트리거, 액티비티 JSON 생성)
Step 5: Journey 최종 생성
```

### Engagement Split 주의사항

Engagement Split(오픈/클릭 기반)은 **반드시 선행 Email 액티비티가 필요**합니다.

```
올바른 플로우: 이메일 액티비티 → Wait → Engagement Split
잘못된 플로우: Wait → Engagement Split (동작하지 않음)
```

### 재진입(entryMode) 주의사항

`sfmc_create_journey_builder_journey`에 full `body_json`을 넘기면 `entry_mode` 파라미터가 무시되어 `entryMode`가 `NotSet`으로 생성됩니다.

```
권장: body_json 최상위에 "entryMode" 직접 명시
  - No re-entry                 → "OnceAndDone"
  - Re-entry anytime            → "MultipleEntries"
  - Re-entry only after exiting → "SingleEntryAcrossAllVersions"
보정: NotSet으로 생성된 경우 sfmc_update_journey로 entryMode만 교정 PUT
```

---

## 커스텀 액티비티(알림톡/카카오) 콘텐츠 연동 — 요건2 분석 노트 (2026-06-21)

> MCE 패키지 추가 요건 중 **"커스텀 액티비티 세팅 — 저니 배치는 MCP, 액티비티 내부 콘텐츠는 API로 별도 전송하는 양방향 연동"** 에 대한 분석·확정 사항. **상태: 진행 중(원인·해법 확정, 구현 전).**
>
> ⚠️ 아래 비밀값(Client Secret / JWT Signing Secret / CSRF 토큰 / JSESSIONID 등)은 이 문서에 기록하지 않는다. 발급받아 별도 보관한다.

### 현황 요약

- 저니에 REST 커스텀 액티비티를 **배치**하는 것: **됨** (MCP `sfmc_create_journey_builder_journey`의 `body_json`)
- 액티비티 **내부 콘텐츠 채우기**: 원인·해법 확정 → **구현 진행 중**
- "콘텐츠가 안 채워지던" 원인 = `inArguments`에 **콘텐츠 식별자 `seq`(= micrm `tmpl_seq`)가 누락**되어 있었음

### 작업 BU / 연결

- 현재 `sf-mce-mcp` MCP는 BU **`Salesforce_milvus_edu`**(endpoint `mc82m0sycp8ynx4fqynw-63lx470`)에 연결되어 있고, **이 BU에 micrm 알림톡 커스텀 액티비티가 설치돼 있음** → BU 이동·MCP 재등록 없이 **현재 연결 그대로 작업 가능**.
- 다른 BU에서 봇을 쓰려면 그 BU용 MCP 엔드포인트를 따로 등록해야 한다(한 연결 = 한 BU 고정). 이전 BU로 되돌리는 것도 엔드포인트만 바꾸면 되며, 각 BU 데이터는 보존된다.
- ⚠️ 기존 `journey_history.md`·스킬 참조의 일부 값은 **이전 계정 기준(stale)**. 옛 저니 ID·이메일 ID·DE GUID·키는 **현재 BU에서 다시 조회해** 써야 한다.

### 실제 값 (현재 BU 기준)

- 커스텀 액티비티 `applicationExtensionKey` = **`8b27e59c-8fb0-4b83-92b4-550aa7a7a490`** (운영 저니에서 사용 중)
  - ⚠️ 스킬 `reference/journey-build.md` ④의 `ac710353-...`는 **옛 계정 값** → 현재 BU 값으로 교체 필요
- micrm 서비스 엔드포인트: `https://sales.micrm.co.kr/sf/06/` 하위 `execute / save / validate / publish / stop / unpublish / testSave .service`

### `seq`의 정체 — 알림톡 템플릿 식별자

- 저니 REST 액티비티 `inArguments.seq` = micrm 템플릿의 **`tmpl_seq`**
- 즉 "어떤 알림톡 템플릿을 보낼지"를 가리키는 번호. **이 값이 채워져야 액티비티 내용이 완성**된다.

### 템플릿 목록 API (`atTmplLst`)

- `POST https://sales.micrm.co.kr/sf/06/kko/atTmplLst.ajax`
- Content-Type: `application/x-www-form-urlencoded; charset=UTF-8`
- 인증: **micrm 웹세션** (`Cookie: JSESSIONID` + 헤더 `X-Csrf-Token` + `X-Requested-With: XMLHttpRequest`) — **SFMC JWT/API키가 아님**
- 요청 파라미터: `send_key`(발신프로필/카카오 채널 키) · `pageNo`(1부터) · `kep_status`(예: `O`=승인) · `_csrf` · (선택) `ex_tmpl_nm`,`reg_dt`,`reg_dt_range`,`usr_grp_cd`
- 응답: `text/html`. 템플릿마다 다음을 포함 —
  - `<input name="tmpl_seq" value="...">` ← **seq**
  - `<input name="tmpl_cd" value="..." data="템플릿명">` ← 카카오 템플릿코드 + 이름
  - `.cont` 본문(카카오 변수 `[#{변수명}]` 포함), 이미지/버튼, 상태(승인), 수정일/등록일
  - pager + "더보기"(`getMobileListAdd`)로 페이징

### 자동화 연동 방식 — 결정 필요

| 옵션 | 내용 | micrm 의존 |
|---|---|---|
| **옵션1 (카탈로그 동기화)** | 템플릿 목록을 `templates.json`으로 보관 → 스킬이 캠페인 의도↔템플릿명 매칭으로 `seq` 선택 → 저니 액티비티에 채움 | 없음(즉시 가능, 변경 시 갱신 필요) |
| **옵션2 (micrm 머신 API)** | micrm의 API키 기반 server-to-server 템플릿 조회 API로 실시간 조회 → 완전 무인 | micrm 측 발급·문서 필요 |

> ⚠️ SFMC Server-to-Server 키(예 `Micrm_Sales_Test` 패키지의 Client Id/Secret)는 **SFMC 인증용**이라 micrm 템플릿 조회에는 쓸 수 없다(향하는 시스템이 다름).

### micrm에 요청할 정보 (옵션2용)

1. 머신용 인증 수단 (API키/토큰, 인증 방식)
2. 템플릿 목록 조회 server-to-server API (URL·파라미터·JSON 응답)
3. `send_key`(발신프로필/카카오 채널) 목록과 각 의미
4. 발송 `inArguments` 정확한 규격 (`seq` + 변수 바인딩 키 + `§extention_cnt§`/`§data_extension_id§` 토큰 의미)
5. 템플릿 변수 `[#{...}]` ↔ 진입 DE 컬럼 매핑 규칙

---

## Slack 연동 (Slack에서 봇으로 조종)

Slack 메시지로 이 캠페인 에이전트를 직접 조종할 수 있습니다. `slack-bridge/`가 Slack 메시지를 받아 **이 PC의 Claude Code(CLI)** 로 처리하고 결과를 회신합니다. **Socket Mode**를 쓰므로 공개 IP·포트개방·터널이 필요 없고, 이 PC가 켜져 있기만 하면 동작합니다.

### 동작 방식

```
Slack 채널 (@봇 멘션)  ──▶  slack-bridge (Socket Mode)  ──▶  claude -p (프로젝트 루트에서 실행)
        ▲                                                              │
        └───────────────────  결과 회신 (스레드)  ◀────────────────────┘
```

- 봇이 받은 텍스트를 그대로 `claude -p`에 전달 → `CLAUDE.md`·`mce-campaign` 스킬·`sf-mce-mcp` MCP 도구가 **전부 그대로 적용**됩니다.
- 같은 **대화(스레드)** 에서 이어 말하면 `--resume`로 대화가 이어져 캠페인 선택·모드 선택·승인 등 **수동 모드 흐름**도 가능합니다.
- 봇은 사람이 "허용"을 누를 수 없으므로 `--dangerously-skip-permissions`로 도구를 자동 승인합니다. (보안이 필요하면 `.claude/settings.json`의 `allowedTools` 화이트리스트로 대체 가능)

**두 가지 대화 방식** (`@slack/bolt` v4):
- **Assistant 모드 (기본)** — 좌측 사이드바의 전용 어시스턴트 패널에서 멘션 없이 대화합니다. 자동 스레드·"처리 중…" 상태가 표시되고 답변이 패널 안에만 쌓여 채널이 깨끗합니다.
- **채널 @멘션 모드 (호환용)** — 채널에서 봇을 멘션하면 스레드로 답합니다.

### Slack 앱 설정 (토큰 2개 발급)

1. https://api.slack.com/apps → **Create New App** → **From scratch** → 앱 이름·워크스페이스 선택
2. **Settings → Socket Mode** 켜기 → **Basic Information → App-Level Tokens**에서 `connections:write` 스코프로 **`xapp-`** 토큰 발급
3. **Features → Agents & AI Apps**(또는 App Home의 Assistant 항목) **활성화** — Assistant 모드(사이드바 패널)를 쓰려면 필수
4. **Features → OAuth & Permissions → Bot Token Scopes**에 `app_mentions:read`, `chat:write`, `assistant:write`, `im:history` 추가 (스코프를 추가하면 봇 사용자가 생성됨)
5. **Features → Event Subscriptions** → Enable → **Add Bot User Event**에 `app_mention`, `assistant_thread_started`, `assistant_thread_context_changed`, `message.im` 추가 → Save
6. **Settings → Install App → Install to Workspace** → **`xoxb-`** Bot User OAuth Token 발급
7. 스코프·이벤트·표시 이름을 바꿨다면 **Install App에서 Reinstall** 해야 반영됨

### 실행

```powershell
# 1) .env 준비 — 위에서 받은 토큰 2개 입력
Copy-Item slack-bridge\.env.example slack-bridge\.env
#   SLACK_BOT_TOKEN=xoxb-...
#   SLACK_APP_TOKEN=xapp-...

# 2) 의존성 설치 후 실행
npm install --prefix slack-bridge
npm start   --prefix slack-bridge
```

콘솔에 `⚡ MCE Slack 브릿지 실행 중 (Socket Mode · Assistant 모드)`이 뜨면 성공.

- **Assistant 모드**: 좌측 사이드바에서 봇(어시스턴트)을 열어 바로 입력 (첫 진입 시 추천 프롬프트 표시)
- **채널 @멘션 모드**: 채널에 봇을 초대하고 멘션해 사용

```
/invite @봇이름
@봇이름 이탈 고객 캠페인 만들어줘
사용량                            # 대화 중 입력 → 누적 비용·요청 수 조회 (Assistant·멘션 공통)
```

> 봇이 채널에 쌓은 자기 메시지를 정리하려면: `node slack-bridge\cleanup.js <채널이름>` (채널 `history` 스코프 필요)

### 출력·사용량 처리

- **Slack은 마크다운 표를 못 그리므로**, 브릿지가 결과의 표를 **후보별 목록 + 구분선**으로 변환하고 `**굵게**`를 Slack 문법 `*굵게*`로 치환합니다. (`toSlackMrkdwn`)
- 각 응답에 비용은 표시하지 않으며, **`@봇 사용량`** 명령으로 해당 스레드의 누적 비용·요청 수를 조회합니다.
- 봇이 쓰는 비용은 이 PC의 **`claude` CLI에 로그인된 계정의 사용 한도**에서 차감됩니다 (별도 달러 청구 아님). 이 계정은 데스크톱 앱에 로그인한 계정과 **다를 수 있습니다** — `.claude.json`의 `emailAddress`로 확인하세요. 봇이 `session limit` 메시지를 답하면 그 계정의 한도에 도달한 것입니다.
- **계정을 바꾸려면**: 터미널에서 `claude` → `/logout` → `/login`으로 원하는 계정 로그인 후 **브릿지를 재시작**(`npm start --prefix slack-bridge`)해야 새 계정이 반영됩니다. (계정 교체는 사용량 주체만 바꾸며, SFMC 접근·기능과는 무관합니다.) 상세는 [`slack-bridge/README.md`](slack-bridge/README.md)의 "사용 계정 · 사용량" 참고.

> ⚠️ 이 PC가 꺼지면 봇도 멈춥니다. 상시 운영하려면 절전 해제 또는 자동 실행 등록이 필요합니다.
> 설정 상세는 [`slack-bridge/README.md`](slack-bridge/README.md) 참고.

> **PowerShell 실행 정책 오류**(`npm.ps1 ... PSSecurityException`)면 `npm` 대신 `node slack-bridge\bridge.js` 로 실행하세요.
> **로그인 시 자동 실행**을 원하면 `run-bridge.cmd`(자동 재시작 런처)를 시작프로그램에 등록합니다 — 방법은 [`slack-bridge/README.md`](slack-bridge/README.md)의 "자동 실행" 참고.

---

## 관련 파일

```
mce-package-main/
├── README.md                          # 이 파일
├── CLAUDE.md                          # 오케스트레이터 정의 (총괄 + STEP 1~3 하위 워커 위임)
├── generate_campaign_definition.js    # xlsx 정의서 생성 스크립트 (exceljs 의존)
├── package.json                       # 의존성 (exceljs 등)
├── campaign_definitions/              # 생성된 정의서 보관
├── slack-bridge/                      # Slack ↔ Claude Code 브릿지 (Socket Mode)
│   ├── bridge.js                      #   Assistant·멘션 처리·결과 변환·사용량 집계
│   ├── run-bridge.cmd                 #   자동 실행/자동 재시작 런처 (시작프로그램용)
│   ├── cleanup.js                     #   봇 자기 메시지 일괄 삭제 유틸
│   ├── .env.example                   #   SLACK_BOT_TOKEN / SLACK_APP_TOKEN
│   └── README.md                      #   Slack 앱 설정·실행 가이드
└── .claude/
    ├── settings.json                  # MCP 권한 설정
    ├── journey_history.md             # 저니 생성 이력 누적 기록
    ├── agents/                        # 하위 워커 (현재 활성 — 상위가 Agent 도구로 호출)
    │   ├── mce-topic-agent.md         # STEP 1 주제 선정 워커
    │   ├── mce-planning-agent.md      # STEP 2 기획 / 정의서 생성 워커
    │   ├── mce-journey-agent.md       # STEP 3 Journey 생성 워커
    │   └── mce-onboarding-agent.md    # (온보딩) 초기 세팅 점검 워커
    ├── skills/
    │   ├── mce-campaign/              # 캠페인 생성 스킬 (STEP 1~4 + reference/)
    │   └── mce-onboarding/            # 초기 세팅 점검 스킬 (체크리스트 + IP 워밍 템플릿)
    └── _backup_single_agent_20260621/ # 전환 전 단일 에이전트 버전 백업 (롤백용)
```

---

## 참고

- Salesforce Marketing Cloud REST API: `https://<subdomain>.rest.marketingcloudapis.com`
- Salesforce Marketing Cloud SOAP API: `https://<subdomain>.soap.marketingcloudapis.com`
- Journey Builder API Version: `1.0`
