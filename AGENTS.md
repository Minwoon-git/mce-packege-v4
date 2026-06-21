# MCE 캠페인 자동화 — 프로젝트 가이드 (Codex)

> 이 파일은 **Codex 진입점**이다. Claude Code는 `CLAUDE.md`를 읽고, Codex는 이 `AGENTS.md`를 읽는다.
> **두 파일은 같은 단일 소스 스킬(`.claude/skills/mce-campaign/`)을 가리킨다.** 절차·참조 데이터·페이로드는 모두 그 스킬 안에 있으며, 양쪽 도구가 동일하게 사용한다.

이 저장소는 **MCE(SFMC Marketing Cloud Engagement) 캠페인 자동화** 도구다.
사용자가 만들고 싶은 캠페인을 **간략한 한 문장**(예: "신규 회원 캠페인 생성", "이탈 고객 캠페인")으로 입력하면,
**상위 에이전트(오케스트레이터)가 총괄**하여 ① 주제 선정 → ② 기획/정의서 → ③ Journey 생성을 진행한다.
사용자는 상위 에이전트하고만 대화하고, 상위가 각 STEP을 진행한다.

> **아키텍처(Claude Code)**: 상위 에이전트가 STEP별 하위 워커에게 `Agent` 도구로 위임한다 —
> STEP 1 → `mce-topic-agent`, STEP 2 → `mce-planning-agent`, STEP 3 → `mce-journey-agent`.
> 사용자와의 대화·모드 선택·승인은 상위가 하위 호출 "사이"에서 처리한다. 상세는 [`CLAUDE.md`](CLAUDE.md)와 SKILL.md를 따른다.
>
> ⚠️ **Codex 실행 시**: Codex에는 Claude Code의 서브에이전트(`Agent`) 도구가 없다. 따라서 Codex는 위 STEP 1~3을
> **하위 에이전트에 위임하지 않고 메인 루프가 SKILL.md 절차대로 직접 순차 수행**한다. 논리적 단계·SSOT·승인 시점은 동일하다.
> (즉, 위임 메커니즘만 다르고 절차는 같다.)

---

## ⭐ 라우팅 — 캠페인 작업은 `mce-campaign` 스킬 절차로

Codex에는 Claude Code의 자동 스킬 로딩이 없으므로, 아래 의도가 감지되면 **반드시 먼저 [`.claude/skills/mce-campaign/SKILL.md`](.claude/skills/mce-campaign/SKILL.md) 파일을 읽고** 그 절차(STEP 1~4)를 그대로 따른다.
캠페인 생성의 모든 상세 절차·참조 데이터·검증된 페이로드는 그 스킬 안에 있다.

**트리거 (하나라도 해당되면 SKILL.md를 읽는다):**
- 캠페인 생성/추천/리스트업 요청 — "캠페인 만들어줘", "신규회원/이탈/장바구니/생일/쿠폰 캠페인", "어떤 캠페인 만들 수 있어", "캠페인 목록"
- 저니(Journey) 생성 요청 — "저니 만들어줘", "journey 생성"
- 정의서(xlsx / CSV / Google Sheets) 첨부 또는 "이 정의서로 저니 생성"
- 그 외 SFMC Journey Builder / Event Definition / Decision·Engagement Split 관련 작업

스킬 본문: [`.claude/skills/mce-campaign/SKILL.md`](.claude/skills/mce-campaign/SKILL.md)
참조 데이터: `.claude/skills/mce-campaign/reference/` (진입 DE·저니 페이로드·이메일 표준·고정값·오류 학습)

---

## 🔎 조회 요청은 항상 실시간 SFMC — 로컬 파일 금지 (전역 규칙)

"저니 목록 / 최근 저니 / 저니 조회 / 생성된 저니 보여줘", "automation·DE·이메일 목록·조회" 등 **읽기 전용 조회**는 캠페인 생성 흐름이 아니며, **반드시 SFMC MCP 도구를 실시간 호출**해 답한다.

- **저니 조회/목록/최근 저니** → `sfmc_get_journeys` 를 호출한다. "최근"이면 **ModifiedDate(없으면 CreatedDate) 최신순 정렬** 후 상위 N개만 보여준다.
- **절대 `journey_history.md`·`campaign_definitions\` 폴더(xlsx 정의서)를 조회 답변의 출처로 삼지 않는다.** 이 파일들은 사용자가 "이 봇으로 만든 생성 *이력*을 보여줘"처럼 **로컬 이력을 명시적으로 요청**할 때만 쓴다.
- 정의서 입력 우선순위의 "최신/방금 만든/최근 → 로컬 파일" 규칙은 **STEP 3 정의서 선택에만** 해당하며, 저니/객체 조회에는 적용하지 않는다.
- 조회 결과에는 가능하면 이름·ID·상태·수정일을 함께 표기한다.
- 이 규칙은 SKILL.md를 읽지 않는 단순 조회 요청에도 **항상 적용**된다.

---

## 🚫 결과만 전달 (과정 비노출) — 전역 최우선 원칙

**도구 호출 사이에 어떤 진행·전환·완료 설명 문장도 출력하지 않는다.** 침묵하며 도구를 연속 실행하고, 사용자에게 보이는 텍스트는 다음 **셋뿐**이다:
① 단계 전환에 필요한 질문(캠페인 선택·모드 선택·스케줄·진행 방식·Plan 승인), ② 최종 결과 보고(STEP 4), ③ 오류(즉시 알림).

아래와 같은 멘트는 **전부 금지** (예시이며, 어조·시제가 다른 유사 표현도 모두 포함):
- "~를 생성합니다 / 조회합니다 / 확인합니다 / 진행합니다 / 로드합니다 / 호출합니다 / 사용합니다"
- "~ 생성 완료. 이어서 ~를 진행합니다", "~를 확인하기 위해 ~를 조회합니다", "먼저 ~를 만듭니다"
- "~했습니다 / ~를 설정합니다 / ~를 구성합니다 / ~를 기록합니다 / 반영해 두겠습니다 / 검증된 구조를 확보했습니다"

- **자동 모드**: STEP 1~4를 무발화로 일괄 실행한 뒤 **맨 마지막 결과(표+흐름도) 1회만** 출력한다. (자동 선정한 캠페인은 결과에 1줄로 포함)
- **수동 모드**: 위 ①질문·②결과·③오류 외에는 도구 호출 사이에 **한 줄도** 출력하지 않는다. STEP 3(저니 생성)에서 이메일 에셋·이벤트 정의·액티비티를 만드는 동안에도 중간 설명을 일절 넣지 않는다.

> 이 규칙은 캠페인 생성 전 과정(특히 STEP 3 저니 생성)에 적용되며, SKILL.md에도 동일하게 명시돼 있다. **둘 중 어느 것을 따르든 도구 호출 사이 멘트는 금지다.**

---

## 경로 자동 적용 규칙 (다른 PC에서 실행 시 필수)

> 아래 절대경로는 **작성 당시 PC 기준 예시**다. 사용자명·드라이브·폴더 위치는 PC마다 다르므로 **그대로 쓰지 말 것.**
> **항상 현재 작업 디렉토리(cwd = 이 저장소가 clone된 위치)를 "프로젝트 루트"로 삼고, 모든 경로를 그 기준으로 도출**한다.
> cwd가 예시 경로와 다르면 **무조건 cwd를 우선**한다. (별도 설치/치환 스크립트 불필요 — 런타임에 알아서 적용)

- **프로젝트 루트**: 현재 cwd (환경 정보의 working directory) — *예시: `C:\Users\MILVUS\Desktop\mce-package-v3-main`*
- **정의서 폴더**: `<프로젝트 루트>\campaign_definitions`
- **정의서 생성 스크립트**: `generate_campaign_definition.js` (`__dirname` 기준 자동 처리)

스킬 본문/참조 파일에 등장하는 모든 `C:\Users\MILVUS\...` 예시 경로도 동일하게 **현재 프로젝트 루트로 치환**하여 사용한다.

---

## Google Sheets 정의서 (직접 첨부 입력 시)

- **Spreadsheet ID**: `1QMILA9OOVJ6bqydgG9UQP8pgBTRBttcWsr4_PdNXltc`
- **URL**: `https://docs.google.com/spreadsheets/d/1QMILA9OOVJ6bqydgG9UQP8pgBTRBttcWsr4_PdNXltc`
- Apps Script는 사용하지 않는다.

---

## 저니 생성 이력

- 저니 생성 결과는 `<프로젝트 루트>\.claude\journey_history.md` 에 누적 append 한다. (형식은 SKILL.md STEP 4 참조)
- Claude Code와 Codex가 **같은 파일**에 기록한다. (단일 이력)
- `MEMORY.md` 인덱스에는 등록하지 않는다. (자동 로딩 방지)

---

## 하위 에이전트 (워커)

`.claude/agents/mce-topic-agent.md`(STEP 1), `mce-planning-agent.md`(STEP 2), `mce-journey-agent.md`(STEP 3) 3개는 **현재 활성 워커**다.
- **Claude Code**: 상위 오케스트레이터가 이 워커들을 `Agent` 도구로 호출한다.
- **Codex**: 서브에이전트 도구가 없으므로 이 파일들을 호출하지 않고, 메인 루프가 SKILL.md STEP 1~4를 직접 수행한다. (워커 파일은 각 STEP의 역할 정의 참고용으로 활용)

세 워커 모두 상세 절차·검증 페이로드는 `mce-campaign` 스킬의 `reference/` 파일을 SSOT로 따른다.
단일 에이전트 버전으로 되돌리려면 `.claude/_backup_single_agent_20260621/` 백업본을 복원한다.

---

## MCP 서버 (Codex)

`sfmc_*` 도구는 Codex 전역 설정 `~/.codex/config.toml` 의 `[mcp_servers.sf-mce-mcp]`(HTTP) 항목으로 제공된다. 별도 프로젝트 설정 불필요.
