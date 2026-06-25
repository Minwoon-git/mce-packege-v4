# 추천 데이터 소스 / 진입 DE / 폴더 구조 (STEP 1 참조)

STEP 1(주제 선정/캠페인 추천)은 **고객 데이터를 직접 분석**해 캠페인을 추천한다.
분석의 단일 소스는 **`Customer_Profile`** 이며, 추천된 캠페인의 실제 발송 진입 DE는 Automation(SQL Query)이 Customer_Profile을 필터해 생성한다.

---

## ⭐ 1순위 — 분석·추천 소스 `Customer_Profile`

- **DE Key**: `CD_Customer_Profile_DE`
- **위치**: `Data Extensions > Campaign_Package(93372) > Customer Data(93869)`
- **구조**: 1행 = 1고객 (카페24 회원/주문/장바구니/쿠폰/포인트를 **원천 사실값 컬럼**으로 평탄화). sendable, Contact Key = `member_id`.
- ⚠️ **신호는 플래그로 저장하지 않는다**: 휴면·이탈·생일 등 날짜 상대 신호는 `is_dormant` 같은 Boolean으로 박제하면 매일 stale 되므로, **원천 날짜·수치 컬럼**(`signup_date`·`last_login_date`·`last_order_date`·`birthday`·`coupon_expire_date`·`points_expire_date`·`cart_updated_date`·`order_count`·`total_spent`·`points_balance`·`cart_total_amount`·`unused_coupon_count` 등)만 저장하고, **대상 판정은 진입 DE 생성 시 Automation SQL Query가 계산**한다.
- **추천 로직**: 이 DE를 분석해 **각 캠페인 신호에 해당하는 고객 수(세그먼트 규모)** 를 집계하고, 규모가 있고 의도에 맞는 캠페인을 추천한다.

> 세그먼트 규모 집계 방법: SQL Query 액티비티(`sfmc_create_sql_query`/`sfmc_run_sql_query`)로 `SELECT COUNT(*) ... WHERE <신호조건>` 을 돌리거나, 행을 조회해 신호 컬럼별로 카운트한다. 추천 표에는 **각 캠페인의 대상 고객 수**를 함께 표기한다.

### 원천 컬럼 → 추천 캠페인 + 판정 계산식 (신호는 쿼리로 계산)

> Customer_Profile은 **원천 사실값**만 저장한다. "누가 이 캠페인 대상이냐"는 아래 **계산식을 Automation SQL Query에서 평가**해 판정한다(`GETDATE()`=오늘). 플래그 컬럼(`is_dormant` 등)은 쓰지 않는다.

| 캠페인 | 원천 컬럼 | 판정 계산식 (WHERE) |
|---|---|---|
| 생일 쿠폰 | `birthday` | `MONTH(birthday)=MONTH(GETDATE()) AND DAY(birthday)=DAY(GETDATE())` |
| 신규 회원 온보딩 | `signup_date` | `DATEDIFF(day, signup_date, GETDATE()) <= 30` (미구매면 `order_count=0` 결합) |
| 휴면 재활성화 | `last_login_date` | `DATEDIFF(day, last_login_date, GETDATE()) >= 90` |
| 이탈 위험 | `last_order_date` | `DATEDIFF(day, last_order_date, GETDATE()) BETWEEN 60 AND 180` |
| 장바구니 이탈 | `has_abandoned_cart`, `cart_total_amount` | `has_abandoned_cart='True' AND cart_total_amount > 0` |
| 쿠폰 만료 리마인더 | `coupon_expire_date`, `unused_coupon_count` | `coupon_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND unused_coupon_count > 0` |
| 포인트 만료 알림 | `points_expire_date`, `points_balance` | `points_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND points_balance > 0` |
| VIP 우대 | `grade`, `total_spent` | `grade='VIP'` (또는 `total_spent` 상위) |
| 등급별 캠페인 | `grade` | `grade` 값으로 Decision Split |
| 취향 기반 추천 | `preferred_category` | 카테고리별 분기 |
| 지역 타겟 | `region` | 지역별 분기 |
| 첫 구매 유도 | `order_count` | `order_count = 0` |

> 기준값(예: 휴면 90일, 만료 7일 이내)은 **쿼리만 고치면 바뀐다** — DE 재적재 불필요.
> 분기·세분화에 쓸 핵심 컬럼: `grade`, `member_type`, `order_count`, `total_spent`, `last_order_date`, `last_login_date`, `signup_date`, `birthday`, `cart_total_amount`, `coupon_expire_date`, `points_expire_date`, `has_abandoned_cart`, `preferred_category`, `region`, `sms_consent`, `email_consent`.
> ⚠️ **발송 필터**: 이메일 캠페인은 `email_consent=true`, SMS/알림톡은 `sms_consent=true` 인 고객만 대상으로 한다(계산식에 항상 AND로 결합).

---

## ⭐ 1순위(심화) — 데이터 진단 기반 추천 (3차원)

> 위 "원천 컬럼 → 캠페인" 표는 **컬럼이 있으니 그 캠페인이 가능하다**(1~2차원)까지만 본다.
> 진단 기반 추천은 한 단계 더 나아가 **실제 데이터 값을 집계해 비중이 두드러진 지점을 찾고, 그에 맞는 캠페인을 우선 추천**한다(3차원 = 데이터 기반 추천). (내부 룰셋에선 "기준선 초과 지표"로 다루되, 사용자 출력엔 그 표현을 쓰지 않는다.)
>
> - **1차원**: 필드 존재 → "생일 필드 있음 → 생일 캠페인 가능"
> - **2차원**: 데이터 값 → "이탈 12,400명 → 이탈 캠페인"
> - **3차원(목표)**: 데이터 분석 → "이탈위험 32% → 이탈 고객 재구매 유도 **추천**"

### 데이터 흐름 (사전 집계 카운트 — 새벽 Automation)

```
[새벽 03:00 Automation]               [추천 시점 STEP 1]              [캠페인 선택 후 1-6]
Customer_Profile ─7개 COUNT SQL─► SEG_* 카운트 DE ─rowCount 즉시 읽기─► 선택 캠페인만 발송 DE 생성
 (전체 raw, 그대로)                세그먼트별 인원      비율→추천(대기 없음)   (조건+동의 필터+발송 컬럼)
```

- **원본 Customer_Profile은 그대로.** 무거운 집계는 **매일 새벽 Automation `CP_DIAGNOSIS_AUTOMATION`이 미리** 수행해 7개 `SEG_*` 카운트 DE에 적재한다.
- **진단(STEP 1)**: 이미 집계된 **카운트 DE의 `rowCount`만 읽어** 즉시 진단한다(대기 없음, 비동기 0 오판 없음).
  - ⚠️ **읽기 채널 = rowCount**: sf-mce는 DE **행 값** 일괄읽기 도구가 없다(단건 PK 조회는 SQL/import 행을 404). `rowCount`(메타)만 항상 읽힘 → "세그먼트 인원 = DE 행 수"로 rowCount만 읽는다. (data-cloud `get_de_rows`는 다른 BU라 사용 불가.)
  - `SEG_*`는 **카운트 전용**(member_id 1컬럼, 비-sendable) — 발송 DE 아님.
- **발송(진입) DE는 캠페인을 고른 뒤 STEP 1-6에서 생성**한다 — 세그먼트 조건 + **채널 동의 필터**(이메일=`email_consent='True'`, SMS/알림톡=`sms_consent='True'`) + 발송 컬럼. 발송 인원 = 세그먼트 ∩ 동의(진단 인원보다 작음).
- ⚠️ **즉석 집계(on-demand)는 채택하지 않는다** — 추천 때마다 1~2분 대기 + 비동기 race(rowCount 0 오판)로 불안정. 사전 집계가 빠르고 안정적이다.

### 지표 → 추천 캠페인 룰셋 (기준선 조정 가능)

> 모두 현재 `Customer_Profile`의 원천 컬럼만으로 계산 가능하다. 기준선은 **고객사·업종에 맞게 조정 가능**(문서만 수정).
> `GETDATE()`=오늘. 모수는 기본 **전체 고객 수**, 별도 명시 시 해당 모집단.
> ⚠️ **출력엔 "약점/주목" 컬럼을 넣지 않는다.** 사용자에겐 지표·인원·비율·추천 캠페인만, **비율 높은 순**으로 보여준다. 아래 기준선은 추천 순위 산정용 내부 참고값이다.

| 지표 | 기준선(참고) | 추천 캠페인 | 비율 계산 (분자 조건) |
|---|---|---|---|
| 1회성 구매자 비중 | > 60% | 2차 구매 유도 | `order_count = 1` |
| 이탈위험 (마지막 주문 90일+) | > 25% | 이탈 고객 재구매 유도 | `DATEDIFF(day, last_order_date, GETDATE()) >= 90` (모수: `order_count >= 1`) |
| 휴면 (로그인 90일+) | > 30% | 휴면 고객 재활성화 | `DATEDIFF(day, last_login_date, GETDATE()) >= 90` |
| 첫구매 미전환 | > 20% | 신규 첫구매 유도 | `order_count = 0` |
| 장바구니 이탈 | > 15% | 장바구니 리마인더 | `has_abandoned_cart = 1 AND cart_total_amount > 0` |
| 마케팅 미동의 | > 50% | 동의 확보 | `email_consent = 0 AND sms_consent = 0` |

> **추천 우선순위** = 기본은 **비율 높은 순**. 매출/이탈 손실 영향(이탈·1회성 등)이 큰 지표를 위로 가중할 수 있다. 비율이 낮아 두드러지지 않는 지표(생일·쿠폰만료 등)는 "추가 가능 캠페인"으로 하위에 둔다.

### 진단 카운트 DE — `SEG_*` (새벽 Automation이 적재, 구축됨)

위치 `Customer Data(93897)`, **member_id 1컬럼·비-sendable**. 각 DE rowCount = 세그먼트 인원. **발송 DE 아님.**

| 세그먼트 | 카운트 DE Key | 조건(WHERE) |
|---|---|---|
| 1회성 구매자 | `SEG_repeat_buyer_DE` | `order_count = 1` |
| 구매자(이탈 분모) | `SEG_buyers_DE` | `order_count >= 1` |
| 이탈위험 | `SEG_churn_DE` | `order_count>=1 AND DATEDIFF(day,last_order_date,GETDATE())>=90` |
| 휴면 | `SEG_dormant_DE` | `DATEDIFF(day,last_login_date,GETDATE())>=90` |
| 첫구매 미전환 | `SEG_noconv_DE` | `order_count = 0` |
| 장바구니 이탈 | `SEG_cart_DE` | `has_abandoned_cart='True' AND cart_total_amount>0` |
| 미동의 | `SEG_noconsent_DE` | `email_consent='False' AND sms_consent='False'` |

- **Automation**: `CP_DIAGNOSIS_AUTOMATION` — 매일 03:00 KST에 위 7개 SQL Query를 Overwrite 실행.
- **전체 모수** = `Customer_Profile` rowCount. **구매자 모수** = `SEG_buyers_DE` rowCount.

**읽기 절차 (STEP 1, 대기 없음):**
1. `Customer_Profile` + 각 `SEG_*` DE의 **rowCount**를 `sfmc_get_data_extension`(GUID)로 읽는다. (DE GUID는 `sfmc_get_data_extensions($search:"SEG_")`로 조회.)
2. **비율** = 세그먼트 rowCount / 분모 rowCount → 위 룰셋 기준선과 대조 → **비율 높은 순** 추천.

> 신규 계정(아직 Automation 미실행)일 때만: `sfmc_run_automation`로 1회 수동 실행 후 1~2분 뒤 읽는다. 평상시엔 새벽 적재분을 즉시 읽으므로 집계 대기가 없다.

### 발송(진입) DE — 캠페인 선택 후 생성 (STEP 1-6)

진단으로 캠페인이 **선택되면**, 그제서야 그 캠페인의 발송 DE를 만든다:
- `SELECT member_id AS SubscriberKey, member_id, name, email, ... FROM Customer_Profile WHERE <세그먼트 조건> AND <채널 동의>` → sendable 진입 DE에 적재.
- **채널 동의 필터 필수**: 이메일 캠페인 `AND email_consent='True'`, SMS/알림톡 `AND sms_consent='True'`. (단 "동의 확보" 캠페인은 대상이 미동의자이므로 동의 필터를 빼고 도달 가능한 채널로 발송.)
- 이 발송 DE rowCount = **실제 발송 인원**(진단 인원보다 작음 = 세그먼트 ∩ 동의). 결과 보고의 진입 인원은 이 값으로 표기한다.

> ⚠️ **현재 한계 — 추세 미지원**: `SEG_*`는 매일 overwrite라 스냅샷만 본다("증가/하락" 추세 X). 추세까지 보려면 별도 이력 DE에 `snapshot_date`+세그먼트별 rowCount를 매일 append로 쌓으면 된다(후속 과제).

---

## 2순위 — 캠페인별 진입 DE (`Campaign_Package`, 저니 진입 레이어)

추천된 캠페인을 실제 저니로 만들 때, **Automation SQL Query가 Customer_Profile을 필터해 아래 진입 DE를 채운다**(또는 새 진입 DE 생성). 저니는 이 진입 DE에서 진입한다.

| 하위 폴더 (categoryId) | 의도 | 진입 DE명 | DE Key |
|---|---|---|---|
| New Join (`93373`) | 신규 회원 | 신규회원_웰컴 | `WELCOME_ENTRY_DE` |
| Old Member (`93374`) | 이탈/재활성화 | 이탈고객_재활성화 | `CHURN_ENTRY_DE` |
| Cart (`93375`) | 장바구니 이탈 | 장바구니_이탈 | `CART_ABANDON_ENTRY_DE` |
| Birthday (`93376`) | 생일 | 생일_쿠폰 | `BIRTHDAY_ENTRY_DE` |
| Coupon (`93377`) | 쿠폰/프로모션 | 쿠폰_친구추가 | `COUPON_FRIEND_ENTRY_DE` |
| Customer Data (`93869`) | **분석 소스** | **Customer_Profile** | `CD_Customer_Profile_DE` |

> Automation(SQL Query) 구축은 STEP 1 추천 이후의 별도 단계다. 추천 단계에서는 Customer_Profile만 읽으면 된다.

---

## 일반 폴더 탐색 절차 (fallback)

Customer_Profile이 없거나 비어 있을 때만 아래로 폴백한다.

1. `sfmc_get_data_extension_folders` 로 폴더(카테고리) 트리를 조회한다.
2. 폴더명을 사용자 의도와 대조하여 관련 폴더를 1~3개 선정한다 (Welcome/Churn/Cart/Birthday/Coupon/Grade 등).
3. 선정 폴더에 대해 `sfmc_get_data_extensions_by_category` 로 해당 폴더의 DE만 조회한다.
4. 그래도 후보가 부족하면 `sfmc_get_data_extensions` 전체 조회 후 이름/설명으로 1차 필터한다.
