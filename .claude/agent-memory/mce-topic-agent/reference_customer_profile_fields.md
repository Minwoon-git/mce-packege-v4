---
name: reference-customer-profile-fields
description: Customer_Profile DE(key CD_Customer_Profile_DE, id d64d8979-346d-f111-a5e1-5cba2c19fe48) 전체 필드 목록 및 캠페인 신호 컬럼 확인 결과
metadata:
  type: reference
---

## DE 기본 정보

- 이름: Customer_Profile
- Key: CD_Customer_Profile_DE
- ID: d64d8979-346d-f111-a5e1-5cba2c19fe48
- categoryId: 93869 (Customer Data 폴더)
- rowCount: 100
- fieldCount: 33
- sendableField: member_id → _SubscriberKey

## 캠페인 신호 컬럼 (Boolean)

| 컬럼명 | 타입 | 캠페인 신호 |
|---|---|---|
| is_birthday_today | Boolean | 생일 |
| is_new_member | Boolean | 신규회원 |
| is_dormant | Boolean | 휴면 |
| is_churn_risk | Boolean | 이탈 위험 |
| has_abandoned_cart | Boolean | 장바구니 이탈 |
| has_expiring_coupon | Boolean | 쿠폰 만료 임박 |
| has_expiring_points | Boolean | 포인트 만료 임박 |
| birthday_coupon_unused | Boolean | 생일쿠폰 미사용 |

## 분기/세분화 컬럼

| 컬럼명 | 타입 | 용도 |
|---|---|---|
| grade | Text | VIP·등급 분기 |
| preferred_category | Text | 취향/카테고리 개인화 |
| region | Text | 지역 타겟팅 |
| days_since_last_order | Number | 이탈 기간 분기 |
| total_spent | Decimal | 구매금액 분기 |
| cart_total_amount | Decimal | 장바구니 금액 분기 |
| days_since_signup | Number | 가입 후 경과일 분기 |
| points_balance | Number | 포인트 잔액 분기 |
| unused_coupon_count | Number | 미사용 쿠폰 수 |
| member_type | Text | 회원 유형 |
| sms_consent | Boolean | SMS 동의 여부 |
| email_consent | Boolean | 이메일 동의 여부 |

## 기타 기본 컬럼

member_id, email, name, cellphone, sex, birthday, age, signup_date, last_login_date,
days_since_last_login, last_order_date, order_count, SubscriberKey
