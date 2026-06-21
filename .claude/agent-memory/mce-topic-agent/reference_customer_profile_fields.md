---
name: reference-customer-profile-fields
description: 현재 계정 DE 현황 — Customer_Profile(CD_Customer_Profile_DE) 없음. 실제 존재하는 캠페인용 DE 6개(무신사 기반) 필드 정리. 2026-06-21 기준.
metadata:
  type: reference
---

## 중요: Customer_Profile DE 부재 확인 (2026-06-21)

- `Customer_Profile` (key: `CD_Customer_Profile_DE`, id: `d64d8979-...`) 은 현재 계정에 존재하지 않음.
- REST API 검색(`/data/v1/customobjects?$search=Customer_Profile` 등) 및 폴더(93869) 조회 모두 0건.
- 이전 메모리의 ID는 stale — 해당 DE가 삭제되었거나 다른 BU에 있을 가능성.

## 실제 존재하는 캠페인용 DE (루트 폴더 82564, Jinny 작성, 무신사 기반)

| DE명 | ID | Key | 주요 필드 | 용도 |
|---|---|---|---|---|
| DE_Master_Member_Musinsa | ed219863-... | C0862E30-... | ContactKey, Email, Phone, Marketing_Opt_In, Name | 회원 마스터·동의 |
| DE_Cart_Event | c0229863-... | 3E0D3510-... | ContactKey, Product_ID, Cart_Flag, Cart_Date | 장바구니 이탈 |
| DE_Product_View_7d | ec219863-... | B25FC3F0-... | ContactKey, Product_ID, View_Count_7d, Last_View_Date, Email, Discount_Rate, Price, Purchase_Date, Marketing_Opt_In, Phone | 상품 조회 행동·고관여 |
| DE_Purchase_Status | ee219863-... | 80ACBCBB-... | ContactKey, Product_ID, Purchase_Date | 구매 이력 |
| DE_Login_Event | 06229863-... | 08FF0BF9-... | ContactKey, Last_Login_Date, Login_Count_30d | 로그인 이력·휴면 판단 |
| DE_Product_Discount | eb219863-... | 8ED344BB-... | Product_ID, Discount_Rate, Discount_Start_Date, Price, ContactKey | 상품 할인 정보 |

## DataCloud 폴더(90248) DE

| DE명 | ID | 주요 필드 | 비고 |
|---|---|---|---|
| AllContact_260415 | ba90ebf6-... | Contactkey (5개 필드, 13000행) | 전체 연락처 |
| PurchaseData_260415 | 694a615b-... | Contactkey (5개 필드, 13000행) | 구매 데이터 |

## 캠페인 신호 매핑 (실제 DE 기반)

| 신호 | 근거 DE·필드 | 캠페인 |
|---|---|---|
| 장바구니 이탈 | DE_Cart_Event.Cart_Flag / Cart_Date | 장바구니 이탈 재타겟 |
| 휴면/비활성 | DE_Login_Event.Last_Login_Date + Login_Count_30d | 휴면 재활성화 |
| 고관여 미구매 | DE_Product_View_7d.View_Count_7d (구매 없음) | 관심상품 구매 유도 |
| 할인 상품 알림 | DE_Product_Discount.Discount_Rate + DE_Product_View_7d 조인 | 가격 인하 알림 |
| 구매 후 리텐션 | DE_Purchase_Status.Purchase_Date | 재구매 유도 |
| 마케팅 동의자 | DE_Master_Member_Musinsa.Marketing_Opt_In = 'Y' | 일반 마케팅 발송 |
