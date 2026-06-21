# 추천 데이터 소스 / 진입 DE / 폴더 구조 (STEP 1 참조)

STEP 1(주제 선정/캠페인 추천)은 **고객 데이터를 직접 분석**해 캠페인을 추천한다.
분석의 단일 소스는 **`Customer_Profile`** 이며, 추천된 캠페인의 실제 발송 진입 DE는 Automation(SQL Query)이 Customer_Profile을 필터해 생성한다.

---

## ⭐ 1순위 — 분석·추천 소스 `Customer_Profile`

- **DE Key**: `CD_Customer_Profile_DE`
- **위치**: `Data Extensions > Campaign_Package(93372) > Customer Data(93869)`
- **구조**: 1행 = 1고객 (카페24 회원/주문/장바구니/쿠폰/포인트를 집계 신호로 평탄화). sendable, Contact Key = `member_id`.
- **추천 로직**: 이 DE를 분석해 **각 캠페인 신호에 해당하는 고객 수(세그먼트 규모)** 를 집계하고, 규모가 있고 의도에 맞는 캠페인을 추천한다.

> 세그먼트 규모 집계 방법: SQL Query 액티비티(`sfmc_create_sql_query`/`sfmc_run_sql_query`)로 `SELECT COUNT(*) ... WHERE <신호조건>` 을 돌리거나, 행을 조회해 신호 컬럼별로 카운트한다. 추천 표에는 **각 캠페인의 대상 고객 수**를 함께 표기한다.

### 캠페인 신호 컬럼 → 추천 캠페인 매핑

| 캠페인 | Customer_Profile 필터(신호) | 비고 |
|---|---|---|
| 생일 쿠폰 | `is_birthday_today = true`(+ `email_consent=true`) | `birthday_coupon_unused`면 리마인더 결합 |
| 신규 회원 온보딩 | `is_new_member = true` | 미구매(`order_count=0`)면 첫 구매 유도 |
| 이탈/휴면 재활성화 | `is_dormant = true` 또는 `is_churn_risk = true` | `days_since_last_order` 클수록 우선 |
| 장바구니 이탈 | `has_abandoned_cart = true` | `cart_total_amount` 기준 차등 가능 |
| 쿠폰 만료 리마인더 | `has_expiring_coupon = true` | `unused_coupon_count`>0 |
| 포인트 만료 알림 | `has_expiring_points = true` | `points_balance` 기준 |
| VIP 우대 | `grade = 'VIP'`(+ `total_spent` 상위) | 고액 구매자 리워드 |
| 등급별 캠페인 | `grade` 분기 | Decision Split |
| 취향 기반 추천 | `preferred_category` 분기 | 카테고리별 콘텐츠 |
| 지역 타겟 | `region` 분기 | 지역 프로모션 |

> 분기·세분화에 쓸 수 있는 핵심 컬럼: `grade`, `member_type`, `is_new_member`, `is_dormant`, `is_churn_risk`, `has_abandoned_cart`, `has_expiring_coupon`, `birthday_coupon_unused`, `has_expiring_points`, `is_birthday_today`, `days_since_last_order`, `total_spent`, `preferred_category`, `region`, `sms_consent`, `email_consent`.
> ⚠️ **발송 필터**: 이메일 캠페인은 `email_consent=true`, SMS/알림톡은 `sms_consent=true` 인 고객만 대상으로 한다(추천 규모 집계 시에도 반영).

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
