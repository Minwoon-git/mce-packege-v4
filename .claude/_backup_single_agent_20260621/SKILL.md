---
name: mce-campaign
description: >
  MCE(SFMC Marketing Cloud Engagement) 캠페인 자동 생성. 사용자가 만들고 싶은 캠페인을
  한 문장으로 말하면(예: "신규 회원 캠페인 생성", "이탈 고객 캠페인", "장바구니 캠페인",
  "생일 쿠폰", "쿠폰 친구추가") ① 주제 선정 → ② 기획/정의서 → ③ Journey 생성을 수행한다.
  "캠페인 만들어줘", "캠페인 리스트업", "어떤 캠페인 만들 수 있어", "저니 생성",
  정의서(xlsx/CSV/Google Sheets) 첨부 시에도 이 스킬을 사용한다.
---

# MCE 캠페인 자동화 — 단일 통합 에이전트

사용자가 만들고 싶은 MCE 캠페인을 **간략한 한 문장**으로 입력하면,
**메인 루프(이 에이전트)가 처음부터 끝까지 직접** ① 주제 선정 → ② 기획/정의서 → ③ Journey 생성을 수행한다.

> **단일 에이전트 원칙**: 서브에이전트로 위임하지 않는다. 메인 루프가 사용자와 직접 대화하면서 동시에 MCP 도구(`sfmc_*`)를 직접 호출한다.
> 따라서 수동 모드의 단계별 합의·승인과 자동 모드의 일괄 실행이 모두 한 흐름 안에서 가능하다.

## 참조 파일 (필요 시점에 읽는다)

- **진입 DE / 폴더 구조** → [`reference/de-and-folders.md`](reference/de-and-folders.md) — STEP 1에서 캠페인 후보를 읽을 때
- **저니 페이로드 / 액티비티 규칙** → [`reference/journey-build.md`](reference/journey-build.md) — STEP 3에서 Journey 생성할 때
- **이메일 콘텐츠 표준 / 샘플 이메일** → [`reference/email-standard.md`](reference/email-standard.md) — 이메일 에셋을 만들거나 고를 때
- **SFMC 고정값(GUID 등)** → [`reference/fixed-values.md`](reference/fixed-values.md) — 저니 이메일 액티비티 구성 시
- **오류 학습 / 알려진 이슈** → [`reference/error-log.md`](reference/error-log.md) — STEP 3 시작 전 먼저 훑고, 새 오류 발생·해결 시 여기에 한 줄 추가

## 시트 정보 (Google Sheets 정의서 입력 시)

- **Spreadsheet ID**: `1QMILA9OOVJ6bqydgG9UQP8pgBTRBttcWsr4_PdNXltc`
- **URL**: `https://docs.google.com/spreadsheets/d/1QMILA9OOVJ6bqydgG9UQP8pgBTRBttcWsr4_PdNXltc`

> Apps Script는 사용하지 않는다.

## 경로

> ⚠️ **경로 자동 적용 규칙 (다른 PC에서 실행 시 필수)** — 절대경로는 작성 당시 PC 기준 예시다. 사용자명·드라이브·폴더 위치는 PC마다 다르므로 그대로 쓰지 말 것.
> **항상 현재 작업 디렉토리(cwd = 이 저장소가 clone된 위치)를 "프로젝트 루트"로 삼고, 모든 경로를 그 기준으로 도출**한다.
> - 프로젝트 루트 = 현재 cwd (환경 정보의 working directory)
> - 정의서 폴더 = `<프로젝트 루트>\campaign_definitions`
> - 정의서 생성 스크립트 = `<프로젝트 루트>\generate_campaign_definition.js`
>
> 아래에 `C:\Users\MILVUS\Desktop\mce-packege-v2-main` 가 나오는 모든 곳(STEP 2·3의 xlsx 생성/파싱 절대경로 포함)은 **실제 현재 프로젝트 루트로 치환하여 사용**한다. cwd가 예시 경로와 다르면 **무조건 cwd를 우선**한다.

- **프로젝트 루트**: `C:\Users\MILVUS\Desktop\mce-packege-v2-main` *(예시 — 실제로는 현재 cwd 사용)*
- **정의서 폴더**: `<프로젝트 루트>\campaign_definitions`
- **정의서 생성 스크립트**: `generate_campaign_definition.js` (`__dirname` 기준 자동 처리)

---

## 전체 흐름

```
사용자: "신규 회원을 위한 캠페인 생성"
   │
   ▼
[STEP 1] 주제 선정  →  연결된 DE 분석 → 캠페인 후보 목록 추천
   │        → 사용자가 만들 캠페인을 선택   (※ 모드와 무관, 항상 동일)
   │
   ▼
[STEP 2] 실행 모드 선택  ──  수동 / 자동   (※ 기획부터 적용)
   │        Plan 설계 + xlsx 정의서 생성
   │        (수동: 대화로 Plan 합의 후 정의서 생성)
   │        (자동: 기본값으로 일괄 설계 → 그대로 STEP 3까지 진행)
   ▼
[STEP 3] Journey 생성  →  SFMC Journey 생성 (기본 Draft)
   │
   ▼
[STEP 4] 결과 보고
```

> 사용자가 정의서(xlsx/CSV/Google Sheets)를 **직접 첨부**한 경우 STEP 1·2를 건너뛰고 STEP 3(저니 생성)으로 바로 이동한다.

## 조회 요청 (읽기 전용 — 생성 흐름과 분리)

"저니 목록", "최근 저니", "저니 조회", "생성된 저니 보여줘", "automation/DE/이메일 목록" 등 **읽기 전용 조회**는 STEP 1~4 생성 흐름이 아니다. **반드시 SFMC를 실시간으로 조회**해 답한다.

- **저니 조회/목록/최근 저니** → `sfmc_get_journeys` 를 호출한다. "최근"이면 **ModifiedDate(없으면 CreatedDate) 최신순으로 정렬**해 상위 N개만 보여준다.
- **절대 `journey_history.md` 나 `campaign_definitions\` 폴더를 조회 답변의 출처로 쓰지 않는다.** 그 파일들은 "이 봇으로 만든 생성 *이력*을 보여줘"처럼 **명시적으로 로컬 이력을 요청**할 때만 사용한다.
- (정의서 입력 소스 우선순위의 "최신/방금 만든/최근 → 로컬 파일" 규칙은 **STEP 3 정의서 선택에만** 해당한다. 저니 조회에는 적용하지 않는다.)
- 조회 결과에는 가능한 한 Journey 이름·ID·상태·수정일을 함께 표기한다.

> **결과만 전달 (과정 비노출)**: 진행 과정·중간 작업·"이제 ~를 조회합니다" / "~를 생성합니다" / "~를 확인합니다" 같은 설명은 텍스트로 공유하지 않는다.
> 도구 호출이나 내부 처리 과정을 설명하지 말고, **결과물만 텍스트로 전달**한다.
> 사용자에게 노출하는 것은 다음뿐이다: 단계 전환에 필요한 질문(캠페인 선택, 모드 선택, Plan 승인), 최종 결과 보고, 그리고 오류(즉시 알림).
> 그 외 진행 상황 설명은 일절 출력하지 않는다.
>
> ⭐ **자동 모드에서도 동일**: "알아서 골라줘"로 캠페인을 자동 선정하거나 자동 모드로 일괄 진행할 때도, 단계별 진행 설명("Event Definition을 생성합니다", "스케줄을 PATCH합니다" 등)을 출력하지 않는다.
> 자동 모드는 STEP 1~4를 **무발화로 일괄 실행**하고, 맨 마지막 STEP 4 실행 결과(표 + 흐름도)만 한 번에 보여준다. (자동 선정한 캠페인이 무엇인지는 결과 보고에 1줄로 포함한다.)
>
> 🚫 **수동 모드에서도 동일 — 도구 호출 사이에 진행 멘트 금지**: 도구를 연속 실행하는 동안 그 사이에 어떤 설명 문장도 넣지 않는다.
> 다음과 같은 표현은 모두 금지: "~를 분석했습니다", "~를 설정합니다", "~를 구성합니다", "~를 기록합니다", "~했습니다", "반영해 두겠습니다", "검증된 구조를 확보했습니다" 등 진행/전환/완료 보고성 멘트.
> 침묵하며 도구를 실행하고, 사용자에게 출력하는 텍스트는 ① 단계 전환 질문, ② 최종 결과 보고, ③ 오류 — 이 셋뿐이다. 그 외에는 한 줄도 출력하지 않는다.

---

## 클릭형 선택 (수동 모드 — `AskUserQuestion` 사용)

> **STEP 2(실행 모드 선택)부터의 결정 지점은 `AskUserQuestion` 도구로 묻는다.** 사용자가 텍스트로 입력하는 대신 **버튼을 클릭**해 고르게 한다.
> (자동 모드는 질문하지 않으므로 해당 없음. 사용자가 그래도 텍스트로 답하면 그 입력을 그대로 수용한다.)
>
> ⚠️ **STEP 1-5 캠페인 후보 선택은 예외 — 클릭형이 아니라 기존 텍스트(번호/`추천`) 입력 방식을 유지한다.**

적용 지점은 4곳이며, 각 STEP의 해당 위치에 표시돼 있다:

| 지점 | 질문(header) | 클릭 옵션 |
|---|---|---|
| STEP 2 실행 모드 | `실행 모드` | `수동` / `자동` |
| STEP 2 스케줄 모드 | `스케줄` | `Recurring (반복 발송)` / `On Activation (발행 시 1회)` (Recurring 선택 시 주기·시작일·시각은 텍스트로 이어서 확정) |
| STEP 2 수동 진행 방식 | `진행 방식` | `정의서 후 승인` / `바로 저니 생성` |
| STEP 2 Plan 승인 | `Plan 승인` | `승인 (저니 생성)` / `수정할게요` |

규칙:
- 옵션 `description`에는 각 선택의 의미·결과를 한 줄로 적는다(예: 다음에 일어날 일).
- 사용자가 버튼 대신 직접 타이핑("수동", "바로", "수정")해도 동일하게 처리한다.
- "수정할게요"를 고르면 어느 항목을 바꿀지 다시 대화로 합의한 뒤 Plan을 갱신한다.

---

# STEP 1 — 주제 선정 (캠페인 후보 추천)

> **모드 선택과 무관하게 항상 동일하게 동작한다.** 연결된 DE를 읽어 캠페인을 추천하는 단계다.
> 한국어로 소통하고 결과를 한국어로 보고한다.
> 진입 DE 목록·폴더 구조·핵심 필드는 [`reference/de-and-folders.md`](reference/de-and-folders.md)를 참조한다.

## 1-0. 입력 분기 — 사용자 프롬프트로 갈래를 먼저 판정한다

STEP 1에 진입하면, **사용자가 입력한 프롬프트에 특정 의도 키워드가 담겨 있는지** 먼저 판정하여 아래 두 갈래 중 하나로 진행한다.

| 갈래 | 트리거 (사용자 입력 예) | 읽기 범위 | 출력 형태 |
|---|---|---|---|
| **A. 의도 없이 전체 (리스트업)** *(우선 갈래)* | "생성 가능한 캠페인 리스트 업", "어떤 캠페인 만들 수 있어?", "전체 보여줘", "캠페인 목록" 등 **특정 의도 키워드가 없는 포괄적 요청** | `Campaign_Package`(93372) **5개 진입 DE 전체** | **DE 목록만 간단히** 번호로 제시 (캠페인 후보 표·필드 분석 없음, → 1-4-A) |
| **B. 의도 포함** | "신규 회원 캠페인 만들어줘", "이탈 고객 캠페인", "장바구니 캠페인" 등 **신규/이탈/장바구니/생일/쿠폰 등 의도 키워드 포함** | 매칭되는 **하위 폴더 1~2개의 DE만** | 해당 DE의 **상세 후보 표** (복잡도 단순→복합 정렬, → 1-4-B) |

**판정 규칙:**
- 의도 키워드(신규·가입·온보딩·웰컴 / 이탈·휴면·재활성화 / 장바구니·구매 / 생일·기념일 / 쿠폰·친구추가·프로모션 / 등급·멤버십)가 **하나도 없으면 → 갈래 A**.
- 의도 키워드가 **하나라도 있으면 → 갈래 B**.
- 모호하면(예: 의도 같기도, 전체 같기도) **갈래 A(리스트업)를 우선** 적용한다.

**전형적 흐름**: 사용자가 갈래 A로 DE 목록을 먼저 본다 → 그중 하나를 의도로 지목("신규회원 캠페인 만들어줘") → **갈래 B로 전환**되어 그 DE의 상세 후보 표를 제시한다.

이후 1-1 ~ 1-5는 위에서 정해진 갈래(읽기 범위·출력 형태)에 맞춰 수행한다.

## 1-1. 폴더/카테고리로 읽기 범위 좁히기 (먼저 수행)

> 전체 DE를 무차별로 읽지 않는다. **먼저 폴더(카테고리) 구조를 보고 의도와 관련된 폴더로 범위를 좁힌 뒤**, 그 안의 DE만 읽는다.
> 최우선 지정 폴더 `Campaign_Package`(93372)와 하위 5개 폴더·진입 DE 매핑, 일반 폴더 fallback 절차는 [`reference/de-and-folders.md`](reference/de-and-folders.md)에 정리돼 있다. **항상 `Campaign_Package`를 가장 먼저 읽는다.**

사용자 의도를 폴더 매핑 표와 대조하여 매칭되는 하위 폴더의 categoryId로 `sfmc_get_data_extensions_by_category`를 호출해 해당 진입 DE를 우선 읽는다. (의도가 모호하면 `Campaign_Package` 전체를 읽어 5개 DE를 모두 후보로 삼는다.)

## 1-2. 의도 키워드 매칭 (범위 내 1차 필터)

1-1에서 좁힌 DE들 중에서 사용자 의도에 부합하는 후보를 식별한다.
- **이름/설명**에 의도 키워드(신규, 이탈, 장바구니, 생일, 등급, 쿠폰, 친구추가 등)가 포함된 DE를 우선 식별한다.
- 이름만으로 판단이 어려운 DE는 일부 행을 샘플 조회하여 **필드 값**으로 용도를 확인한다. (예: `group_name = WELCOME`)
- 폴더 한정 + 키워드로도 후보가 부족하면 범용 DE(고객 마스터, 구매이력, 마케팅 동의 등)를 보조 후보로 삼는다.

## 1-3. 핵심 DE 필드 분석

후보 DE에 대해 `sfmc_get_data_extension_fields`(필요 시 `sfmc_get_data_extension`)로 필드를 조회한다.
- 분기·세분화에 쓸 수 있는 핵심 필드를 식별한다. (예: `IsKakaoCouponIssued`, `MemberGrade`, `MarketingConsent`, `LastPurchaseDate`, `Birthday`, `IsCouponUsed`, `SendCount` 등)
- 필드 유형(Boolean / Date / Text / Number)을 파악하여 어떤 캠페인·분기에 적합한지 판단한다.

## 1-4. 캠페인 후보 추천

1-0에서 판정한 갈래에 따라 출력 형태가 다르다.

### 1-4-A. 갈래 A (의도 없이 전체 = 리스트업) — DE 목록만 간단히

5개 진입 DE를 **번호 목록으로만** 제시한다. **캠페인 후보 표·필드 분석·복잡도 컬럼은 만들지 않는다** (그건 갈래 B에서 의도가 정해진 뒤 수행). 폴더 카테고리 조회(`sfmc_get_data_extensions_by_category`)로 DE명/Key만 확보하면 충분하며, 필드 조회(1-3)는 생략한다.

출력 형식:

```
생성 가능한 캠페인 진입 DE 목록입니다.

1. 신규회원_웰컴 · WELCOME_ENTRY_DE (New Join)
2. 이탈고객_재활성화 · CHURN_ENTRY_DE (Old Member)
3. 장바구니_이탈 · CART_ABANDON_ENTRY_DE (Cart)
4. 생일_쿠폰 · BIRTHDAY_ENTRY_DE (Birthday)
5. 쿠폰_친구추가 · COUPON_FRIEND_ENTRY_DE (Coupon)

만들고 싶은 캠페인을 말씀해 주세요. (예: "신규회원 캠페인 만들어줘")
```

- DE가 미생성(현재 Grade·Common 등)인 폴더는 목록에서 제외하거나 "(DE 미생성)"으로 표기한다.
- 사용자가 이 목록을 보고 특정 DE를 의도로 지목하면 → **갈래 B(1-4-B)로 전환**하여 그 DE의 상세 후보 표를 제시한다.

### 1-4-B. 갈래 B (의도 포함) — 통합 후보 표

사용자 의도와 분석한 DE/필드를 결합하여 **2~5개의 캠페인 후보**를 단일 표로 제시한다.

**후보 구성·정렬 규칙:**
- **복잡도 오름차순 정렬**: 1번을 가장 단순한 후보(단순 발송)로 두고, 번호가 커질수록 분기·단계가 많아지는 순서로 배치한다.
- **복잡도 컬럼 표시**: 각 후보에 복잡도를 명시한다 — `단순` / `중간` / `복합`.
  - `단순`: Email → Wait & Exit (분기 없음)
  - `중간`: 분기 1회 (Decision Split 또는 Engagement Split 1개)
  - `복합`: 다단계·중첩 분기 (Decision Split → Email → Wait → Engagement Split 등)
- **복합 후보 항상 1개 이상 포함**: DE가 분기 가능한 필드(Boolean/Date/Number/등급 Text 등)를 1개라도 가지면, 후보 목록 **마지막 칸에 반드시 복합 분기 후보를 1개 넣는다.** 간략한 한 문장만 입력해도 복합 분기 옵션을 빠짐없이 추천받게 하기 위함이다.
  - DE 필드가 부족해 복합 분기를 만들 수 없을 때만 생략하고, 그 사실(어떤 필드가 없는지)을 명시한다.

| 번호 | 캠페인명 | 활용 DE | 핵심 필드 | 추천 Journey 유형 | 복잡도 | 한 줄 설명 |
|---|---|---|---|---|---|---|
| 1 | 신규회원 웰컴 이메일 | TEST_MCE_CAMPAIGN_DE | JoinDate, MarketingConsent | Email → Wait & Exit | 단순 | 가입 직후 웰컴 메시지 1회 발송 |
| 2 | 신규회원 온보딩 시리즈 | TEST_MCE_CAMPAIGN_DE | JoinDate | Email → Wait → Engagement Split | 중간 | 가입 후 열람 여부에 따라 후속 안내 차등 발송 |
| 3 | 신규회원 등급별 온보딩 | TEST_MCE_CAMPAIGN_DE | MemberGrade, 열람여부 | Decision Split → Email → Wait → Engagement Split | 복합 | 등급 분기 후 열람 반응까지 반영한 다단계 안내 |

각 후보는 **실제 존재하는 DE와 필드에 근거**해야 한다. 임의로 없는 DE/필드를 지어내지 않는다.
DE에 필요한 분기 필드가 없으면, 그 사실을 명시하고(예: "IsCouponUsed 필드 없음 — 추가 필요") 대안을 제시한다.

## 1-5. 캠페인 선택

후보 표를 사용자에게 보여주고 **어떤 캠페인을 만들지 선택**하게 한다. (복잡도 컬럼이 있어 사용자가 난이도를 보고 고를 수 있다.)
후보 표 아래에 선택 안내를 한 줄 덧붙인다: **"번호를 고르시거나 `추천`이라고 입력하시면 의도에 맞는 후보를 골라드립니다."** (이 단계는 텍스트 입력 방식 — 클릭형 아님)

**자동 선택 트리거 — `추천`:**
- 사용자가 **`추천`** 이라고 입력하면(또는 "알아서 골라줘", "알아서" 등 동의 표현) **복잡도를 강제로 올리지 않고**, 사용자가 원하는 캠페인 의도에 가장 적합한 후보를 오케스트레이터가 선택한다. 무엇을 왜 골랐는지(어떤 의도에 부합해서) 1줄로 알린다.
  - 의도가 단순 1회 발송 성격이면 단순 후보를, 단계적 반응·세분화가 필요한 의도면 그에 맞는 중간/복합 후보를 고른다. 즉 **의도 정합성**이 자동 선택의 유일한 기준이다.
  - ⚠️ `추천`(후보 자동 선택)과 STEP 2의 `자동`(대화 없이 저니까지 일괄 실행 모드)은 별개다. `추천`은 후보만 고르는 것이고, 이후 실행 모드(수동/자동)는 STEP 2에서 별도로 진행한다.

원칙:
1. **범위 한정 우선**: 전체 DE를 무차별 조회하지 않는다. 폴더/카테고리로 먼저 좁히고, 매칭이 모호할 때만 전체 조회로 fallback.
2. **근거 기반 추천**: 모든 후보는 실제 조회한 DE/필드에 근거한다.
3. **의도 정합성**: 자동 선택 시 사용자의 한 문장 의도에 가장 부합하는 후보를 고른다. (정렬은 복잡도 오름차순이되, 선택 기준은 의도 적합성)
4. **복잡도 다양성 보장**: 후보는 단순 → 복합으로 정렬하고, 복합 분기 후보를 항상 1개 이상 포함한다(1-4 규칙). 간략 입력에도 복합 옵션이 추천 목록에 노출되게 한다.

---

# STEP 2 — 실행 모드 선택 + 기획 / 정의서

캠페인이 선택되면 **이 시점에서** 실행 모드를 묻는다. 이 선택이 기획(STEP 2)과 저니 생성(STEP 3)의 진행 방식을 가른다.

| 모드 | 동작 |
|---|---|
| **수동 (Manual)** | Plan을 **대화 형식**으로 함께 구성한다. 진입 방식·이메일·단계·분기·대기·재진입·스케줄을 사용자와 하나씩 합의한 뒤 정의서를 만들고, STEP 3 전에 한 번 더 승인을 받는다. |
| **자동 (Auto)** | **대화 없이** Plan 기획 → 정의서 → MCE Journey 생성까지 일괄 진행한다. 명시되지 않은 값은 MCE 표준 기본값을 자동 적용한다. |

> 🔘 **클릭형 선택**: 모드는 `AskUserQuestion`(header `실행 모드`)으로 **`수동` / `자동`** 버튼을 제시해 받는다.
> 사용자가 처음부터 "자동으로", "알아서 저니까지 만들어줘"라고 명시하면 이 질문을 생략하고 **자동**으로 진행한다.

**모드별 STEP 2 처리:**

- **자동** → 의도를 분석해 기본값으로 Plan 설계 + 정의서 생성을 일괄 수행하고, 곧바로 STEP 3로 이어간다.

- **수동** → 직접 대화로 Plan을 합의한다. 아래 항목을 순서대로 사용자와 정한다:
  1. Entry Source (Data Extension / API Event) 및 진입 DE
  2. **스케줄** — 발송 일정 / 스케줄 시작일 / Schedule Flow Mode (Recurring vs On Activation)
     → 🔘 `AskUserQuestion`(header `스케줄`)으로 **`Recurring (반복 발송)` / `On Activation (발행 시 1회)`** 을 먼저 받는다.
       `Recurring`이면 이어서 **주기(매일/매주/매월)·시작일·발송 시각**을 대화로 확정한다(날짜·시각은 텍스트 입력).
  3. 재진입 설정 (No re-entry / Re-entry anytime / Re-entry only after exiting)
  4. Journey 단계 구성 (Email / Wait / Decision Split / Engagement Split / Wait & Exit ...)
  5. 각 단계의 상세값 (이메일명·ID, 대기 기간, 분기 조건/기준 속성)

  > ⚠️ **스케줄을 자동 기본값으로 조용히 넘기지 않는다.** 수동 모드에서는 스케줄(발송 일정·시작일·Schedule Flow Mode)을 **반드시 사용자와 확정**하고, Plan 요약(2-1)의 `스케줄` 라인을 항상 실제 값으로 채워 보여준다. 사용자가 스케줄을 언급하지 않았더라도 추천값을 제시해 **확인을 받는다**(애매한 항목만 묻는 사전 확인 체크리스트를 쓸 때도 스케줄을 반드시 포함).

  합의가 끝나면 확정된 Plan을 요약해 보여준 뒤, **진행 방식을 한 번 묻는다** (🔘 `AskUserQuestion`, header `진행 방식`):
  - ① **정의서 생성 후 승인** — xlsx 정의서를 먼저 생성해 보여주고, 사용자 승인을 받은 뒤 STEP 3 Journey 생성
  - ② **바로 저니 생성** — 정의서 xlsx 생성 후 중간 확인 없이 곧바로 STEP 3 Journey(Draft)까지 생성

  선택된 값 그대로 정의서를 생성한다. (임의로 바꾸지 않는다.)

## 2-1. Journey Plan 요약 (정의서 생성 전 먼저 제시)

```
[ Plan: <캠페인 시나리오명> ]
- 목적      : <비즈니스 목적>
- 진입      : <Entry Source> / <진입 DE 또는 Event Key>
- 스케줄    : <발송 일정> (시작 <스케줄 시작일>) / <Recurring | On Activation>
- 재진입    : <No re-entry | Re-entry anytime | Re-entry only after exiting>
- 흐름      : Entry → Email(<이메일명>) → Wait(<기간>) → Decision Split(<기준>) → ...
- 분기 속성 : <DE 필드명 및 조건> (실제 DE에 존재하는 필드 기준)
```

Plan의 분기 기준 속성은 **실제 DE에 존재하는 필드**를 사용한다. 필드가 없으면 Plan에 그 사실을 명시한다(예: "IsCouponUsed 필드 없음 — DE에 추가 필요").

## 2-2. 정의서 시트 구조

캠페인 정의서는 **캠페인 개요 / 저니 구조** 2개 탭으로 구성된다.

### 캠페인 개요 탭

| 컬럼명 | 설명 |
|---|---|
| 캠페인 ID | 고유 식별자 (예: CP_001) |
| 캠페인 시나리오명 | Journey 이름으로 사용 |
| 설명 및 비즈니스 목적 | 캠페인 목적 설명 |
| 발송 일정 | 발송 기준 일정 |
| 스케줄 시작일 | 실행 시작 날짜 (예: 2026-06-01) |
| Entry Source | Data Extensions / API Event |
| Entry DE 명 | 진입 DE 이름 |

### 저니 구조 탭

| 컬럼명 | 설명 |
|---|---|
| 캠페인 ID | 개요 탭과 매칭 키 |
| 단계 (Step) | 순서 (1, 2, 3-A, 3-B ...) |
| 컴포넌트 유형 | Entry Source / Message (Email) / Message (알림톡/문자/카카오/SMS) / Wait / Decision Split / Engagement Split / Wait & Exit 등 |
| 상세 설정 조건 / 분기 로직 (Criteria & Path) | 컴포넌트별 세부 조건 및 분기 경로 |
| 연결 콘텐츠 명칭 (Email Name) | Content Builder 에셋명 |
| 연결 콘텐츠 ID (Email ID) | Content Builder legacyId |
| 대기 기간 (Wait) | 대기 시간 (예: 3 Days, 1 Day) |
| 고객 재진입 설정 (Contact Re-entry) | No re-entry / Re-entry only after exiting / Re-entry at any time |
| Schedule Flow Mode | Recurring (반복) 또는 빈값 (On Activation — 발행 시 1회) |

**메시지 채널 판단 기준 (컴포넌트 유형 결정):**

| 캠페인/정의서에 등장하는 문구 | 컴포넌트 유형 | STEP 3 생성 방식 |
|---|---|---|
| `알림톡`, `문자`, `카카오`, `SMS` 중 하나라도 포함 | `Message (알림톡/문자/카카오/SMS)` | **REST 커스텀 액티비티** ([`reference/journey-build.md`](reference/journey-build.md) ④) — 이메일 에셋/액티비티 생성 안 함 |
| 위 문구 없음 (기본) | `Message (Email)` | 이메일 액티비티(`EMAILV2`) + 이메일 에셋 생성 |

> ⚠️ 위 4종 채널 문구가 감지되면 **`Message (Email)`을 `Message (알림톡/문자/카카오/SMS)`로 대체**한다. 같은 단계에 이메일과 채널 메시지를 중복으로 넣지 않는다. (REST 단독 처리)

**고객 재진입 설정 판단 기준 (자동 모드에서 미지정 시):**

| 의도 예시 | 재진입 설정 |
|---|---|
| "웰컴 1번만", "가입 즉시 발송", "생일 축하 1회" | `No re-entry` |
| "이탈할 때마다", "구매할 때마다 발송" | `Re-entry at any time` |
| "여정 끝난 고객은 다시 받을 수 있게", "매일 체크해서 재시도" | `Re-entry only after exiting` |
| 사용자가 명시 | 지정값 우선 |
| 판단 불가 | `No re-entry` (기본값) |

**Schedule Flow Mode 판단 기준:**

| 요청 | Schedule Flow Mode | 발송 일정 | 스케줄 시작일 |
|---|---|---|---|
| "매일 09:00", "매주 월요일" 등 반복 | `Recurring` | 예: `매일 09:00` | 예: `2026-06-10` |
| "가입 즉시", "1회 발송", 반복 언급 없음 | *(빈값)* | `즉시` 또는 `-` | `-` |
| API Event 기반 | *(빈값)* | `실시간` | `-` |

## 2-3. 정의서 생성 워크플로우

### ① 캠페인 ID 채번

`campaign_definitions\` 폴더 내 기존 xlsx 파일명에서 `CP_NNN` 패턴을 스캔한다.
- 가장 큰 번호 + 1을 새 캠페인 ID로 사용 (예: CP_014 존재 → CP_015)
- 기존 파일이 없으면 CP_001부터 시작

### ② xlsx 파일 생성

확인 없이 즉시 `generate_campaign_definition.js` 스크립트로 xlsx 파일을 생성한다.

**출력 경로**: `<프로젝트 루트>\campaign_definitions\`
**파일명 규칙**: `{캠페인ID}_{캠페인시나리오명}_{YYYYMMDD}.xlsx`
**시트 구성**: `시나리오 정의` 탭 + `저니 구조` 탭

생성 방법:
1. 데이터를 **`campaign_data.json`** 파일로 저장 (Write 도구 사용)
2. `node generate_campaign_definition.js <파일명.xlsx> campaign_data.json` 실행
3. 실행 완료 후 `campaign_data.json` 삭제

```json
// campaign_data.json 형식
{
  "overviewRows": [
    ["CP_XXX", "시나리오명", "설명", "발송일정", "2026-06-03", "Data Extensions", "DE명"]
  ],
  "journeyRows": [
    ["CP_XXX", "1", "Entry Source", "조건", "-", "-", "-", "No re-entry", "-"],
    ["CP_XXX", "2", "Message (Email)", "설명", "이메일명", "63559", "-", "-", "-"],
    ["CP_XXX", "3", "Wait & Exit", "종료", "-", "-", "1 Day", "-", "-"]
  ]
}
```

```bash
node generate_campaign_definition.js CP_XXX_시나리오명_20260603.xlsx campaign_data.json
```

**절대 `node -e` 인라인 실행 금지** — Windows 백슬래시 경로가 깨져 파일이 엉뚱한 위치에 생성됨.

### ③ 완료 보고

Plan 요약 → 파일 경로 → 생성된 정의서 테이블(캠페인 개요 / 저니 구조)을 순서대로 출력한다.

```
[ 정의서 생성 완료 ]
파일: campaign_definitions/CP_XXX_시나리오명_YYYYMMDD.xlsx
캠페인 ID: CP_XXX
```

- **수동 모드** → 정의서를 사용자에게 보여주고 STEP 3 전에 승인을 받는다. (🔘 `AskUserQuestion`, header `Plan 승인` — `승인 (저니 생성)` / `수정할게요`. "수정할게요"면 변경 항목을 다시 합의 후 정의서 갱신.)
- **자동 모드** → 곧바로 STEP 3로 진행한다.

## 2-4. 저니 구조 설계 패턴

저니 구조 설계 패턴(단순 이메일 / Decision Split / Engagement Split 및 중첩 분기) 예시는 [`reference/journey-build.md`](reference/journey-build.md)의 "저니 구조 설계 패턴" 절을 참조한다.

---

# STEP 3 — Journey 생성 (SFMC)

STEP 2에서 생성된 정의서(또는 사용자가 직접 첨부한 정의서)를 읽어 SFMC Journey Builder에 Journey를 생성한다.

> ⚠️ **STEP 3 시작 전, [`reference/error-log.md`](reference/error-log.md)(오류 학습 표)를 먼저 훑어 같은 오류를 반복하지 않는다.**
> 저니 페이로드/액티비티 상세 규칙(이벤트 정의·스케줄 PATCH·Decision Split criteria XML·entryMode·Engagement Split statsTypeId 등)은 [`reference/journey-build.md`](reference/journey-build.md)에 정리돼 있다.

**모드별 처리:**
- **자동** → STEP 2 직후 대화 없이 곧바로 진행한다.
- **수동** → STEP 2에서 승인을 받은 뒤 진행한다.

## 3-1. 캠페인 정의서 읽기

**입력 소스 우선순위 (위에서부터 순서대로 판단)**

1. **전체 경로 또는 파일명 제시** → 해당 파일을 직접 파싱
   - 전체 경로 예: `campaign_definitions/CP_005_신규회원웰컴이메일_20260604.xlsx`
   - 파일명만 제시 시 기본 경로 자동 적용: `<프로젝트 루트>\campaign_definitions\`
2. **캠페인 ID만 제시** (예: `CP_005`) → `campaign_definitions\` 폴더에서 `CP_005` 패턴으로 파일을 검색하여 파싱
3. **"최신 파일", "방금 만든", "최근"** 등의 키워드 → `campaign_definitions\` 폴더에서 수정일 기준 가장 최근 xlsx 파일을 자동 선택
4. **위 3가지에 해당하지 않는 경우** → Google Sheets를 읽는다 (Spreadsheet ID: `1QMILA9OOVJ6bqydgG9UQP8pgBTRBttcWsr4_PdNXltc`)

> STEP 2에서 방금 정의서를 만든 경우, 그 데이터를 그대로 메모리에 들고 STEP 3로 넘어가도 된다(재파싱 불필요).

읽은 데이터에서 **캠페인 개요 테이블**과 **저니 구조 테이블**을 파싱한다.
캠페인 ID를 키로 두 테이블을 매칭하여 Journey별 실행 정보를 구성한다.

파싱 과정에서 생성한 임시 JSON 파일(예: `cp0XX_parsed.json`)은 파싱 완료 즉시 삭제한다.

**xlsx 파싱 시 절대 경로 규칙:**
- `cd "경로" && python ...` 형태 **금지** — `cd` + 경로 조합은 보안 정책상 매번 승인 요구됨
- 대신 `python -c "... pd.ExcelFile(r'<프로젝트 루트>\campaign_definitions\파일명.xlsx') ..."` 형태로 절대 경로를 직접 사용한다
- PowerShell에서도 동일하게 `cd` 없이 절대 경로만 사용한다

## 3-2. Journey 이름 중복 확인 및 버전 suffix 부여

`sfmc_get_journeys` 로 동일한 캠페인 시나리오명이 존재하는지 확인한다.

- **중복 없음** → 정의서의 시나리오명 그대로 사용
- **중복 있음** → 기존 버전 번호를 확인하여 자동으로 suffix 부여:
  - 동일 이름이 처음 중복: `시나리오명_v1`
  - `_v1` 도 존재하면: `_v2`, `_v3` ... 순으로 증가
- Journey Key, Event Definition Key에도 동일하게 suffix 반영
  - 예: `CP006-WelcomeEmail-Entry-20260604` → `CP006-WelcomeEmail-Entry-v1-20260604`

## 3-3. 캠페인 ID별 Journey 생성 (즉시 실행)

파싱한 모든 캠페인 ID에 대해 순서대로 Journey를 생성한다.
이벤트 정의 생성·스케줄 PATCH·Journey 액티비티 구성·entryMode·발행 규칙의 **상세 페이로드와 검증된 형식**은 모두 [`reference/journey-build.md`](reference/journey-build.md)에 있다. 그 문서의 규칙을 그대로 따른다.

> ⚠️ **최우선 규칙: 정의서에 명시된 모든 액티비티의 조건/설정값은 빠짐없이 Journey에 채워 넣는다.**
> 조건을 비워둔 채(미설정 상태) Journey를 생성하는 것은 절대 허용되지 않는다.

> 📨 **메시지 채널 분기**: 정의서의 컴포넌트 유형이 `Message (알림톡/문자/카카오/SMS)`이거나 단계 설명에 `알림톡·문자·카카오·SMS` 문구가 있으면, 이메일 액티비티(`EMAILV2`) 대신 **REST 커스텀 액티비티**([`reference/journey-build.md`](reference/journey-build.md) ④)를 생성한다. 이 경우 **이메일 에셋·이메일 표준 단계는 건너뛴다.** 그 외(`Message (Email)`)는 기존대로 이메일 액티비티로 생성한다.

> ⚠️ **발행은 기본적으로 하지 않는다.** 정의서에 `auto_publish = TRUE`가 명시되었거나 사용자가 명시적으로 "발행해줘"/"publish"를 요청한 경우에만 `sfmc_publish_journey`를 호출한다. 그 외에는 **Draft 상태로 둔 채 종료**하고, "Draft 상태로 생성됨 (미발행)"임을 보고한다.

---

# STEP 4 — 결과 보고

모든 처리 완료 후 결과를 요약한다.

Journey 생성에 성공하면 **`sfmc_get_journey_link` 를 호출해 Journey Builder 접속 URL을 얻어** 결과에 포함한다. (여러 저니를 만들었으면 저니마다 이름·ID·링크를 각각 표기한다.)

```
[ 실행 결과 ]
선택 캠페인 : <캠페인명>
실행 모드   : 수동 / 자동
정의서      : campaign_definitions/CP_XXX_시나리오명_YYYYMMDD.xlsx
Journey 명  : <Journey 이름>
Journey ID  : <uuid> (Draft / 발행됨)
접속 링크   : <Journey Builder URL>
```

> 링크는 가능한 한 클릭 가능한 형태로 제공한다. `sfmc_get_journey_link` 가 URL을 돌려주지 못하면 ID·이름까지만 표기하고 링크 줄은 생략한다.

오류가 발생한 단계는 오류 내용을 명시하고, 가능한 경우 다음 단계로 계속 진행한다.

> ⭐ **자기 학습 규칙**: 캠페인 생성 중 오류가 발생하여 수정/우회했다면, **그 원인과 해결책을 즉시 [`reference/error-log.md`](reference/error-log.md)에 한 줄 추가**한다. 다음 캠페인 생성 시 그 문서를 먼저 참고하여 같은 오류를 반복하지 않는다.

---

## 저니 생성 이력 관리

- 저니 생성 결과는 `<프로젝트 루트>\.claude\journey_history.md` 에 단일 파일로 누적 저장한다.
- 매 실행 후 아래 형식으로 append 한다.

```
## YYYY-MM-DD HH:MM
- 캠페인 ID: CP_XXX
- Journey 명: <name>
- Journey ID: <uuid>
- 상태: 성공 / 실패 (<오류내용>)
```

- `MEMORY.md` 인덱스에는 등록하지 않는다. (자동 로딩 방지)
