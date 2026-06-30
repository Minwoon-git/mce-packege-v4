---
name: reference-customer-profile-fields
description: Customer_Profile DE 현황 — 원천 사실값 구조로 재구성(2026-06-22). key/id/필드/upsert PK 등 핵심 메타
metadata:
  type: reference
---

## Customer_Profile DE (무신사 BU, 2026-06-22 재구성)

- **key**: `CD_Customer_Profile_DE`
- **id (GUID)**: `d64d8979-346d-f111-a5e1-5cba2c19fe48` (2026-06-30 재확인 — 이전 0e7c0166-... 는 stale)
- **name**: `Customer_Profile`
- **categoryId**: `93869` (Customer Data 폴더)
- **isSendable**: true
- **sendableCustomObjectField**: `member_id`
- **sendableSubscriberField**: `_SubscriberKey`
- **upsert pk_name**: `SubscriberKey` (sendable DE는 member_id가 PK로 인식 안 됨 — SubscriberKey 사용)
- **행 수**: 10,000행 (2026-06-30 확인. 최신 rowCount 기준)

## 스키마 — 원천 사실값 컬럼 (23개 + SFMC 자동추가 SubscriberKey)

| # | 필드명 | 타입 | 비고 |
|---|--------|------|------|
| 1 | member_id | Text(50) | sendable mapping 필드, NOT NULL |
| 2 | name | Text(100) | |
| 3 | email | EmailAddress | |
| 4 | cellphone | Text(20) | |
| 5 | grade | Text(20) | 일반/골드/VIP |
| 6 | member_type | Text(20) | |
| 7 | region | Text(50) | |
| 8 | preferred_category | Text(50) | |
| 9 | email_consent | Boolean | |
| 10 | sms_consent | Boolean | |
| 11 | signup_date | Date | |
| 12 | last_login_date | Date | |
| 13 | last_order_date | Date | |
| 14 | birthday | Date | |
| 15 | coupon_expire_date | Date | |
| 16 | points_expire_date | Date | |
| 17 | cart_updated_date | Date | |
| 18 | order_count | Number | |
| 19 | total_spent | Decimal(18,2) | |
| 20 | points_balance | Number | |
| 21 | cart_total_amount | Decimal(18,2) | |
| 22 | unused_coupon_count | Number | |
| 23 | has_abandoned_cart | Boolean | 이벤트 사실 플래그(예외 유지) |

## 제거된 파생 컬럼 (구버전 → 신버전에서 삭제)

`is_new_member`, `is_dormant`, `is_churn_risk`, `is_birthday_today`, `birthday_coupon_unused`,
`has_expiring_coupon`, `has_expiring_points`, `days_since_signup`, `days_since_last_login`, `days_since_last_order`

→ Automation SQL Query에서 오늘 날짜 기준으로 동적 계산.

## 샘플 행 세그먼트 분포 (오늘=2026-06-22 기준 쿼리 시 예상)

| 세그먼트 | member_id 범위 | SQL 조건 |
|---------|---------------|---------|
| 신규+동의 | cust1001~1010 중 8명+ | signup_date >= DATEADD(day,-30,GETDATE()) AND (email_consent=1 OR sms_consent=1) |
| 휴면 | cust1011~1015 (5명) | last_login_date <= DATEADD(day,-90,GETDATE()) |
| 이탈위험 | cust1016~1020 (5명) | last_order_date BETWEEN DATEADD(day,-180,GETDATE()) AND DATEADD(day,-60,GETDATE()) |
| 생일오늘 | cust1021~1023 (3명) | MONTH(birthday)=6 AND DAY(birthday)=22 |
| 장바구니 | cust1024, 1025, 1030 (3명) | has_abandoned_cart=1 AND cart_total_amount>0 |
| 쿠폰만료(7일내) | cust1026, 1027 (2명) | coupon_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND unused_coupon_count>0 |
| 포인트만료(7일내) | cust1028, 1029 (2명) | points_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND points_balance>0 |
| VIP/골드 | cust1022, 1025, 1030 (3명) | grade IN ('VIP','골드') |

## 이전 BU — 무신사 기반 DE 6개 (참고용, stale 가능성)

| DE명 | Key | 주요 필드 | 용도 |
|---|---|---|---|
| DE_Master_Member_Musinsa | C0862E30-... | ContactKey, Email, Phone, Marketing_Opt_In | 회원 마스터·동의 |
| DE_Cart_Event | 3E0D3510-... | ContactKey, Product_ID, Cart_Flag, Cart_Date | 장바구니 이탈 |
| DE_Product_View_7d | B25FC3F0-... | ContactKey, Product_ID, View_Count_7d | 고관여 행동 |
| DE_Purchase_Status | 80ACBCBB-... | ContactKey, Product_ID, Purchase_Date | 구매 이력 |
| DE_Login_Event | 08FF0BF9-... | ContactKey, Last_Login_Date, Login_Count_30d | 로그인/휴면 |
| DE_Product_Discount | 8ED344BB-... | Product_ID, Discount_Rate, Price | 할인 정보 |
