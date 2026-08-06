# 스키마 매핑 (STEP 0) — 고객 스키마 파일 분석 → 표준 스키마 매핑 → 데이터 인입 세팅

> **이 문서는 STEP 0(스키마 분석)의 단일 출처(SSOT)다.** 워커 `mce-schema-agent`와 오케스트레이터가 함께 따른다.
> STEP 0는 **캠페인 생성(STEP 1~4)의 앞단**이다. 고객마다 파일명·컬럼명이 제각각인 원천 데이터를,
> 이 패키지가 이미 가정하는 **표준 스키마**로 매핑하고, RAW DE·Import를 세팅해 **STEP 1(값 분석)이 그대로 돌 수 있는 상태**를 만든다.

```
[STEP 0] 스키마 파일 분석 → 표준 매핑 → 핵심 컬럼 확인(HITL) → RAW DE 생성 + SFTP Import 세팅 + 가이드 MD 생성
   │  산출물 ①: 매핑표(구조) — 데이터 없이도 나옴
   ▼  ⏳ 데이터 적재 게이트 (고객이 SFTP 업로드 → Import가 RAW DE 채움)
[STEP 1] 값 분석 → 진단 → 분석 리포트(PPT)   ← 산출물 ②
[STEP 2~4] 기획/정의서 → Journey → 결과 보고
```

> ⭐ **설계 원리 — 표준 스키마가 "계약"이다.** STEP 0의 출력이 항상 **표준 이름의 RAW DE + 표준 규칙의 가이드 MD**이므로, 하류(STEP 1~4)는 무수정으로 재사용된다. 기존 시스템은 이미 "가이드 MD만 있으면 프로파일 빌드·집계·진단·리포트가 자동"이도록 설계돼 있다([`analysis-guide/_common.md`](analysis-guide/_common.md) §6). STEP 0는 지금 **사람이 손으로 쓰던 그 가이드 MD를 자동 생성**하는 일이다.

---

## 0. 언제 실행하나 (트리거)

- **신규 고객사 온보딩** — 고객 원천 데이터를 이 패키지로 처음 붙일 때 1회.
- 사용자가 스키마 파일(DDL/CSV)을 첨부하며 "스키마 분석", "이 데이터 붙여줘", "매핑해줘"라고 할 때.
- 캠페인 생성 요청인데 활성 고객사 가이드가 아직 없거나 원천 RAW DE가 비어 있을 때(오케스트레이터가 STEP 0를 먼저 태운다).

> 이미 활성 고객사 가이드 + RAW DE가 갖춰진 계정에서는 STEP 0를 다시 돌리지 않는다(부하·중복 방지). 스키마가 바뀐 경우만 재실행.

---

## 1. 입력 (A안 — 스키마 파일)

STEP 0는 **스키마(구조)** 만 있으면 된다. 실제 데이터 행은 필요 없다.

| 형태 | 받는 것 | 파싱 방법 |
|---|---|---|
| **DDL** (`.sql`) | `CREATE TABLE …` 정의 (컬럼·타입·PK/FK·COMMENT) | 테이블·컬럼·타입·키·주석 추출 |
| **CSV** (`.csv`) | 파일당 **헤더 + 샘플 행 몇 개** | 헤더=컬럼명, 샘플 값으로 타입·의미 추론 |
| **템플릿 시트** (xlsx) | 데이터정보 템플릿 "3.스키마(직접 기입)" 시트 (테이블명·컬럼명·타입·설명·샘플) | 시트 행을 컬럼 정의로 읽음 (파일 미제공 고객사 경로) |
| **ERD** (이미지/PDF) | 테이블 관계도 | **보조 입력** — 관계(조인키) 확인용으로 우선 활용. 전 컬럼·타입이 판독 가능한 상세 ERD면 단독 입력 허용(판독 불가 항목은 HITL로) |

- 여러 파일(엔티티)이 함께 온다: 보통 **고객 / 주문(구매마스터) / 주문상세 / 상품 / 쿠폰** 5종(고객사에 따라 가감).
- CSV는 값이 있으면 타입 추론이 쉬워지므로 **샘플 3~10행**을 권장. 헤더만 있어도 진행하되 추론 신뢰도를 낮춘다.
- 파일명 자체도 힌트다(예: `CUST_MST.csv` → 고객 마스터). 단 파일명만으로 단정하지 말고 컬럼으로 검증한다.

---

## 2. 표준 스키마 (매핑 목표 = "계약")

아래가 STEP 1 이후가 기대하는 **표준 엔티티·컬럼**이다. 매핑 목표는 항상 이 이름으로 맞추는 것.
(원천이 단일 평탄화 테이블이면 일부 엔티티가 합쳐질 수 있다. 파생값은 원천에서 계산 — 박제 금지.)

| 표준 엔티티 (RAW DE) | PK | 표준 컬럼 | 파생값(RECON_Profile에서 계산) |
|---|---|---|---|
| `RAW_Customers` | `member_id` | `email`, `phone`, `birthday`, `grade`, `region`, `signup_date`, `last_login_date`, `email_consent`, `sms_consent`, `has_abandoned_cart`, `cart_total_amount`, `points_balance`, `points_expire_date` | — |
| `RAW_Orders` | `order_id` | `member_id`, `order_date`, `order_amount`, `order_status` | `order_count`, `total_spent`, `last_order_date` |
| `RAW_OrderDetails` | `detail_id` | `order_id`, `product_id`, `quantity`, `price` | (제품 조인) |
| `RAW_Products` | `product_id` | `product_name`, `category`, `price` | `preferred_category` |
| `RAW_Coupons` | `coupon_id` | `member_id`, `issue_date`, `coupon_expire_date`, `used_flag` | `unused_coupon_count` |

> 표준 컬럼 정의·의미규칙의 상세 SSOT는 활성 고객사 가이드 템플릿 [`analysis-guide/ecommerce-default.md`](analysis-guide/ecommerce-default.md) §1·§2. **여기 없는 표준 컬럼을 지어내지 않는다.**
> 원천에만 있고 표준에 없는 컬럼은 **버리지 말고** 가이드 §1에 "확장 컬럼"으로 남겨, 나중에 캠페인이 필요로 하면 승계한다.

---

## 3. 스키마 분석 + 매핑 (매핑 산출)

### 3-1. 엔티티·컬럼·관계 파악
1. 각 파일 = 어떤 표준 엔티티인지 판정(컬럼 구성·PK·파일명 종합). 애매하면 후보를 표시한다.
2. 컬럼별 **타입**(정수/실수/날짜/문자/불리언)과 **역할**(식별자·외래키·날짜·금액·수량·플래그·범주) 추정.
3. **관계(조인키)** 파악: `주문.회원번호 → 고객.회원번호`, `주문상세.주문번호 → 주문.주문번호`, `주문상세.상품코드 → 상품.상품코드`, `쿠폰.회원번호 → 고객.회원번호`.

### 3-2. 컬럼 매핑 (고객 컬럼 → 표준 컬럼, 1:1)
매핑 근거는 3가지를 종합한다(이름만으로 단정 금지):
- **이름 유사도**: `CUST_NO`≈customer number→`member_id`, `ORD_AMT`≈order amount→`order_amount`.
- **타입/역할**: PK 정수+타 테이블서 FK로 쓰이면 식별자, `DECIMAL`+"AMT/PRICE"면 금액, `DATE`+"조인/로그인/주문"이면 해당 날짜.
- **샘플 값**: `Y/N`→Boolean, `010-…`→phone, `@` 포함→email, `2026-…`→date.

각 매핑에 **신뢰도(높음/보통/낮음)** 를 부여한다. 낮음·모호는 4절 HITL 후보로 올린다.

### 3-3. 값 변환 규칙 식별
표준으로 넣으려면 변환이 필요한 것을 명시한다:
- `Y/N`·`1/0`·`T/F` → Boolean (`email_consent` 등)
- 날짜 포맷 통일(`YYYY-MM-DD[ HH:MM:SS]`)
- 코드값 의미(`GRADE_CD`: BRONZE/SILVER/GOLD/VIP 등)

---

## 4. 핵심 컬럼 확인 (HITL) — ⚠️ 반드시 사용자 확인

> 워커는 격리 실행이라 **직접 묻지 못한다.** 워커는 **"확인이 필요한 항목"을 목록으로 반환**하고,
> **오케스트레이터가 `AskUserQuestion`으로 사용자에게 확정**받은 뒤(채널 해소와 동일 패턴), 그 확정값을 5절 materialize에 넘긴다.

회의 요건("이 컬럼으로 계산 맞나요?")이 여기다. **최소 아래는 반드시 확인**한다:

1. **핵심 ID (조인키)** — 전 테이블을 잇는 회원 식별자가 무엇인지 확정 (예: `CUST_NO` = `member_id` 맞나?).
2. **총구매액(`total_spent`) 산식** — 어느 금액 컬럼을 합산하나?
   - `RAW_Orders.order_amount` 합 vs `RAW_OrderDetails.price × quantity` 합 (회의 L182 "썸이 아니고 이 밑에 걸로" 사례)
   - **취소/환불 제외 여부** — `order_status`가 `CANCEL`/`REFUND`인 주문을 뺄지.
3. **날짜 기준** — `last_order_date`·`last_login_date`가 어느 컬럼인지(여러 날짜 컬럼이 있을 때).
4. **동의 값 해석** — `Y/N`을 각각 동의/미동의로 볼지, 공란은 어떻게 볼지.
5. **신뢰도 낮은 매핑** — 3-2에서 낮음/모호로 표시된 항목 전부.

확인 결과는 매핑·의미규칙에 반영한다. **사용자가 수정한 값이 우선**이다(임의로 바꾸지 않는다).

---

## 5. Materialize (확정 후) — RAW DE + Import + 가이드 MD

> HITL 확정값을 받은 뒤 실행한다. **부하 방지 대전제 유지**: 원천 raw 행을 끌어오지 않는다. DE는 "빈 테이블"로 만들고, 적재는 Import(서버)가 한다.

### 5-1. RAW DE 생성 (빈 테이블)
- 활성 고객사 폴더(예: `Data Extensions > test > <고객사>`)를 확인/생성(`sfmc_get_data_extension_folders` / `sfmc_create_folder`)하고 `categoryId`를 확보한다.
- 표준 엔티티별로 `sfmc_create_data_extension`으로 **표준 컬럼 이름·타입·PK**로 생성한다(2절 스키마). 매핑된 표준 컬럼만 만든다.
  - 생성명 규칙: `RAW_Customers_DE`, `RAW_Orders_DE`, `RAW_OrderDetails_DE`, `RAW_Products_DE`, `RAW_Coupons_DE`.
  - 비-sendable로 만든다(발송 DE 아님). PK·Nullable을 스키마대로.
- 🚨 **생성 후 검증**: `sfmc_get_data_extensions`로 재조회해 실제 생성·필드 구성을 확인하고, 확인된 것만 보고한다(추정 금지).

### 5-2. SFTP → RAW DE Import 세팅
- FTP 위치 확인/생성: `sfmc_get_ftp_location` / `sfmc_create_ftp_location`.
- File Transfer(SFTP→Safehouse): `sfmc_create_automation_file_transfer`.
- Import Definition(파일→DE, 컬럼 매핑·업데이트 타입): 전용 MCP 도구가 없으면 **`sfmc_rest_create`(`/automation/v1/imports`) 또는 `sfmc_soap_create`(ImportDefinition)** 로 생성한다. 컬럼 매핑에 **3절의 고객→표준 매핑**을 그대로 넣어, 고객 파일이 들어오면 표준 컬럼으로 적재되게 한다.
- Import Automation 구성(`sfmc_create_automation`): File Transfer → Import 순서. **스케줄은 등록만 하고 즉시 발행/실행하지 않는다**(온보딩 단계). 고객 파일 업로드 전이라 돌릴 게 없다.
- ⚠️ Import Definition 생성이 사용 가능한 도구로 불가하면, **RAW DE·File Transfer까지 만들고 Import 정의는 "수동/REST 필요"로 표시**해 상위에 반환한다(지어내지 않는다).

### 5-3. 활성 고객사 가이드 MD 자동 생성
[`analysis-guide/ecommerce-default.md`](analysis-guide/ecommerce-default.md)를 **골격 템플릿**으로 복제해 `analysis-guide/<고객사>.md`를 생성한다. 채우는 내용:
- **§1 분석 소스 + 스키마**: 원천 엔티티(생성한 RAW DE명·PK·폴더 `categoryId`), 조인키/관계, **고객→표준 컬럼 매핑표**, 확장 컬럼, 파생값 정의. `RECON_Profile` 빌드 대상으로 지정.
- **§2 의미규칙**: 4절 HITL로 확정한 산식(총구매액=…, 취소/환불 제외 여부, 휴면/이탈 기준 날짜 컬럼, 동의값 해석)을 자연어 정의로 기록.
- **§3 기준선 / §4 SEG_* / §5 진입DE / §6 기획 / §7 전이**: 템플릿 값을 기본으로 두되, 고객사 특이사항이 있으면 반영(없으면 템플릿 유지 — AI가 STEP 1에서 프로파일링해 정함).
- 파일 상단에 "STEP 0 자동 생성, 사람이 검토 요망" 배너와 생성일·확정 산식을 남긴다.

> `RECON_Profile`·`SEG_*`·`CP_DIAGNOSIS_AUTOMATION`은 STEP 0가 만들지 않는다 — 데이터가 적재된 뒤 **STEP 1이 이 가이드를 읽어 자동 부트스트랩**한다([`analysis-guide/_common.md`](analysis-guide/_common.md) §6). STEP 0의 책임은 **빈 RAW DE + Import + 가이드 MD**까지다.

### 5-4. 활성 고객사 전환 (오케스트레이터)
가이드 MD가 생성되면, **오케스트레이터가 사용자에게 전환 여부를 확인한 뒤** SKILL.md "활성 고객사" 줄과 CLAUDE.md 라우팅의 활성 고객사 표기를 `<고객사>`로 바꾼다. (활성 소스 변경은 시스템 전체에 영향을 주므로 **명시적 단계**로 둔다. 워커가 임의로 전환하지 않는다.)

---

## 6. 호출/반환 규약 (2-페이즈)

워커 `mce-schema-agent`는 오케스트레이터가 **두 번** 호출한다(채널 해소와 유사).

- **Phase A — 분석/제안** (입력: 스키마 파일 경로/내용)
  - 3절 수행 → **반환물**: ① 엔티티·매핑표(고객 컬럼→표준 컬럼, 신뢰도) ② 관계(조인키) ③ 값 변환 규칙 ④ **HITL 확인 필요 목록(4절)**. DE/Import/MD는 **아직 만들지 않는다.**
- (오케스트레이터가 4절 HITL을 `AskUserQuestion`으로 확정)
- **Phase B — Materialize** (입력: Phase A 매핑 + HITL 확정값 + 고객사명)
  - 5-1~5-3 수행 → **반환물**: 생성한 RAW DE 목록·검증 결과, Import 세팅 상태(또는 수동필요 표시), 생성한 가이드 MD 경로, 요약.
  - 5-4(활성 전환)는 오케스트레이터가 한다.

> 산출물 ①(매핑표)은 **Phase A 반환물**이며 데이터 없이 나온다. 분석 리포트(PPT)는 STEP 0가 아니라 **데이터 적재 후 STEP 1**에서 나온다.

---

## 7. 가드레일 (반드시 준수)

1. **표준이 계약**: 출력 RAW DE·가이드는 항상 표준 이름·규칙으로. 프로파일 형태·컬럼명을 바꾸지 않는다(하류가 깨짐).
2. **부하 방지**: raw 행을 끌어오지 않는다. DE는 빈 테이블로 만들고 적재는 Import(서버)가 한다. CSV 샘플은 타입 추론용 소량만.
3. **지어내기 금지**: 없는 표준 컬럼/매핑을 만들지 않는다. 모호하면 HITL로 올린다. Import 정의가 도구로 불가하면 "수동필요"로 표시.
4. **HITL 필수**: 핵심 ID·금액 산식·취소환불·동의값은 반드시 사용자 확정을 받고 반영한다(4절).
5. **생성 후 검증 의무**: DE/Import 생성 직후 라이브 재조회로 실재·구성을 확인하고 확인된 것만 보고(추정 금지).
6. **활성 전환은 명시적으로**: 활성 고객사 줄 변경은 오케스트레이터가 사용자 확인 후에만.
7. **한국어**로 소통·보고한다.
