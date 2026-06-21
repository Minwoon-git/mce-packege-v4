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
