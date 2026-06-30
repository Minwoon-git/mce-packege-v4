# 온톨로지 — 고객사: ecommerce-default (일반 이커머스 기업 / 기본 고객사 템플릿)

> 이 파일은 **이 고객사의 "데이터 의미 사전"** 이다 — 스키마(어떤 컬럼이 있나) + 의미 규칙(컬럼·지표를 어떻게 해석하나) + 기준선.
> 분석·추천의 "방법"은 [`_common.md`](_common.md) 를 따른다. 이 둘을 **함께** 읽는다.
>
> ⭐ **이 파일은 "쿼리 카탈로그"가 아니다.** 아래에 등장하는 SQL/WHERE는 **정의를 보여주기 위한 예시**일 뿐, 그대로 복사하라는 목록이 아니다.
> **AI는 [캠페인 의도] + [§1 스키마] + [§2 지표 정의]를 읽고 그 캠페인에 맞는 SQL을 직접 조립한다.** 고정 목록(§4)에 없는 캠페인·세그먼트도 즉석에서 쿼리를 생성한다.
> 즉 고객사는 **컬럼명과 "이 지표는 이런 뜻"이라는 정의만** 여기에 적어두면, AI가 알아서 쿼리를 짠다.
>
> ℹ️ **스키마 출처**: 아래 컬럼 매핑은 cafe24 기반 쇼핑몰 스키마를 참고한 **일반 이커머스 표준 템플릿**이다(cafe24는 컬럼 참고용, 실제 고객사명 아님). 실제 고객사 확정 시 이 파일을 복제해 컬럼·의미 규칙·기준선을 실제 값으로 갱신한다.

---

## 1. 분석 소스 + 스키마 (AI가 쿼리를 짤 때 쓰는 "재료")

- **DE Key**: `CD_Customer_Profile_DE` (이름 `Customer_Profile`), id `0e7c0166-836d-f111-a5e1-5cba2c19fe48`
- **위치**: `Data Extensions > test > mce-package` (categoryId **93897**) — `SEG_*` 카운트 DE와 같은 폴더. *(2026-06-30 라이브 확인. 이전 문서값 `Campaign_Package/Customer Data`는 이 BU에 없는 잘못된 값이었음.)*
- **구조**: 1행 = 1고객, 24컬럼, rowCount ≈ 10,001(2026-06-25 적재). sendable, Contact Key = `member_id`.
- ⚠️ **신호는 플래그로 저장하지 않는다** — `is_dormant` 같은 Boolean을 두지 않고 원천 날짜·수치만 두며, 대상 판정은 **쿼리가 계산**한다([`_common.md`](_common.md) 2절).

### 스키마 매핑 (원천 컬럼 — AI가 SQL에서 참조)

| 의미 | 컬럼명 | 타입 |
|---|---|---|
| 가입일 | `signup_date` | Date |
| 마지막 로그인 | `last_login_date` | Date |
| 마지막 주문일 | `last_order_date` | Date |
| 생일 | `birthday` | Date |
| 쿠폰 만료일 | `coupon_expire_date` | Date |
| 포인트 만료일 | `points_expire_date` | Date |
| 장바구니 수정일 | `cart_updated_date` | Date |
| 누적 주문 수 | `order_count` | Number |
| 누적 결제액 | `total_spent` | Number |
| 포인트 잔액 | `points_balance` | Number |
| 장바구니 금액 | `cart_total_amount` | Number |
| 미사용 쿠폰 수 | `unused_coupon_count` | Number |
| 장바구니 이탈 여부 | `has_abandoned_cart` | Boolean (`'True'`/`1`) |
| 회원 등급 | `grade` | Text (예: VIP/General) |
| 회원 유형 | `member_type` | Text |
| 선호 카테고리 | `preferred_category` | Text |
| 지역 | `region` | Text |
| **이메일 수신 동의** | `email_consent` | Boolean (`'True'`/`1`) |
| **SMS/알림톡 수신 동의** | `sms_consent` | Boolean (`'True'`/`1`) |

> 위에 없는 컬럼은 쓰지 않는다. 캠페인에 필요한 신호 컬럼이 스키마에 없으면 "그 컬럼이 없다"고 명시하고 대안을 제시한다(지어내지 않는다).

---

## 2. 지표 정의 (의미 사전 — AI는 이 "정의"를 SQL로 번역한다)

> ⭐ **여기가 핵심이다.** 고객사는 **"이 지표는 이런 뜻"** 이라는 정의만 적는다. AI는 이 정의 + §1 스키마로 SQL을 **직접 작성**한다.
> 정의를 바꾸면(예: 휴면 90→60일, "거래액에 세금 빼기") AI가 만드는 쿼리도 따라 바뀐다 — **DE 재적재·코드 수정 불필요, 이 정의만 수정**.

### 2-1. 데이터 의미 규칙 (이 고객사의 해석 기준)

| 항목 | 이 고객사 정의 | 비고 |
|---|---|---|
| 누적 결제액(`total_spent`) | **세금 포함, 취소·환불건 제외, 포인트 사용분 차감 전 결제 기준** | ※ 고객사 확인 후 확정 |
| 주문 수(`order_count`) | **완료 주문 기준(취소 제외)** | |
| Boolean 비교 | `= 'True'` / `= 1` 둘 다 동작 | |

> ⚠️ "세금/포인트/취소 포함 여부"는 고객사 거래 정의에 따라 **반드시 실제 값으로 확정**해야 매출/이탈 진단이 정확하다. 현재는 일반적 가정값.

### 2-2. 지표 정의 (자연어 정의 → AI가 SQL 조립)

| 지표 | **정의 (말로)** | 쓰는 컬럼 | AI가 조립할 SQL 조건 *(예시)* |
|---|---|---|---|
| 구매자 | 주문 1회 이상 | `order_count` | `order_count >= 1` |
| 1회성 구매자 | 주문이 정확히 1회 | `order_count` | `order_count = 1` |
| 첫구매 미전환 | 가입했으나 주문 0 | `order_count` | `order_count = 0` |
| 이탈위험 | **구매자 중** 마지막 주문 후 90일 경과 | `order_count`,`last_order_date` | `order_count>=1 AND DATEDIFF(day,last_order_date,GETDATE())>=90` |
| 휴면 | 마지막 로그인 후 90일 경과 | `last_login_date` | `DATEDIFF(day,last_login_date,GETDATE())>=90` |
| 신규 회원 | 가입 30일 이내 | `signup_date` | `DATEDIFF(day,signup_date,GETDATE())<=30` |
| 장바구니 이탈 | 담아두고 미결제 | `has_abandoned_cart`,`cart_total_amount` | `has_abandoned_cart='True' AND cart_total_amount>0` |
| 생일 | 오늘이 생일 | `birthday` | `MONTH(birthday)=MONTH(GETDATE()) AND DAY(birthday)=DAY(GETDATE())` |
| 쿠폰 만료 임박 | 만료 7일 이내 + 미사용 보유 | `coupon_expire_date`,`unused_coupon_count` | `coupon_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND unused_coupon_count>0` |
| 포인트 만료 임박 | 만료 7일 이내 + 잔액 보유 | `points_expire_date`,`points_balance` | `points_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND points_balance>0` |
| VIP | 최상위 등급 | `grade` | `grade='VIP'` |
| 미동의 | 이메일·SMS 모두 미동의 | `email_consent`,`sms_consent` | `email_consent='False' AND sms_consent='False'` |

> **위 "SQL 조건"은 정의를 보여주는 예시다.** 캠페인이 더 복잡하면(예: "VIP 중 장바구니 담고 3일 지난 사람") AI가 해당 정의들을 **AND로 조합**해 새 쿼리를 만든다. 정의에 없는 완전히 새로운 조건은, 사용자 의도를 §1 스키마 컬럼으로 해석해 작성하고 어떤 컬럼·기준으로 만들었는지 1줄 밝힌다.
> `GETDATE()`=오늘. 기준일수(90/30/7 등)는 2-1·2-2의 정의를 고치면 바뀐다.

### 2-3. 동의 필터 (채널별, 발송 쿼리에 항상 결합)

- 이메일 → `email_consent='True'` / SMS·알림톡·카카오 → `sms_consent='True'`
- ("동의 확보" 캠페인은 미동의자가 대상 → 동의 필터 제외, [`_common.md`](_common.md) 4절)

---

## 3. 추천 기준선 (진단 순위 산정용)

> 진단 시 각 지표 비율을 이 기준선과 대조해 **비율 높은 순**으로 추천 순위를 정한다(기준선은 내부 참고값, 출력엔 "약점/주목" 표현 금지).
> 모수는 기본 전체 고객, 이탈·1회성은 구매자 모수.

| 지표 | 기준선(참고) | 추천 캠페인 |
|---|---|---|
| 1회성 구매자 비중 | > 60% | 2차 구매 유도 |
| 이탈위험 | > 25% | 이탈 고객 재구매 유도 |
| 휴면 | > 30% | 휴면 고객 재활성화 |
| 첫구매 미전환 | > 20% | 신규 첫구매 유도 |
| 장바구니 이탈 | > 15% | 장바구니 리마인더 |
| 마케팅 미동의 | > 50% | 동의 확보 |

---

## 4. 기본 진단 세트 — `SEG_*` (하이브리드의 "고정" 부분)

> 이 7개는 "어떤 캠페인 만들 수 있어?"(갈래 A) 진단을 **매번 같은 기준으로** 내기 위한 **안정적 기본 세트**다.
> ⭐ AI는 이 세그먼트들의 SQL을 **§2 지표 정의로부터 생성**한다(아래 WHERE는 그 정의의 현재 결과를 보여줄 뿐, 복사가 목적 아님). **정의(§2)를 고치면 이 세트의 쿼리도 따라 바뀐다.**
> ⭐ **고정 세트는 이 7개로 한정되지 않는다** — 특정/커스텀 캠페인 세그먼트는 이 목록에 없어도 AI가 §1+§2로 즉석 생성한다(STEP 1-6 발송 DE도 마찬가지).

카운트 DE 위치: **`Data Extensions > test > mce-package`** (categoryId `93897`). **member_id 1컬럼·비-sendable**, rowCount=인원. **발송 DE 아님.**

| 세그먼트 | 카운트 DE Key | 근거 지표(§2) |
|---|---|---|
| 1회성 구매자 | `SEG_repeat_buyer_DE` | 1회성 구매자 |
| 구매자(이탈 분모) | `SEG_buyers_DE` | 구매자 |
| 이탈위험 | `SEG_churn_DE` | 이탈위험 |
| 휴면 | `SEG_dormant_DE` | 휴면 |
| 첫구매 미전환 | `SEG_noconv_DE` | 첫구매 미전환 |
| 장바구니 이탈 | `SEG_cart_DE` | 장바구니 이탈 |
| 미동의 | `SEG_noconsent_DE` | 미동의 |

- **Automation**: `CP_DIAGNOSIS_AUTOMATION` — 매일 03:00 KST에 위 세트를 Overwrite 집계. (없으면 [`_common.md`](_common.md) 6절이 §2 정의로부터 SQL·DE·Automation을 자동 생성)
- **생성 SQL 형태**: `SELECT member_id FROM Customer_Profile WHERE <§2 정의로 조립한 조건>` — **Contact Key 1컬럼만**, Overwrite. raw 다중 컬럼 SELECT 금지.
- **전체 모수** = `Customer_Profile` rowCount, **구매자 모수** = `SEG_buyers_DE` rowCount.
- 읽기·자동생성 절차는 [`_common.md`](_common.md) 3·6절.

---

## 5. 진입(발송) DE / 폴더 매핑 (저니 진입 레이어)

캠페인 선택 후 AI가 `Customer_Profile`을 **§2 정의 + 동의 필터로 조립한 쿼리**로 필터해 진입 DE를 채운다(SKILL.md STEP 1-6). 저니는 이 진입 DE에서 진입한다.

> ⚠️ **아래 폴더 categoryId(93373~93377, 93869)는 미검증** — §1과 같은 사유로 현재 BU에 실재하는지 확인되지 않았다. 실제 진입 DE 생성 전 **라이브 폴더 조회로 categoryId를 확인**하고 갱신한다.

| 의도 | 진입 DE명(예) | DE Key(예) | categoryId(미검증) |
|---|---|---|---|
| 신규 회원 | 신규회원_웰컴 | `WELCOME_ENTRY_DE` | `93373` |
| 이탈/재활성화 | 이탈고객_재활성화 | `CHURN_ENTRY_DE` | `93374` |
| 장바구니 이탈 | 장바구니_이탈 | `CART_ABANDON_ENTRY_DE` | `93375` |
| 생일 | 생일_쿠폰 | `BIRTHDAY_ENTRY_DE` | `93376` |
| 쿠폰/프로모션 | 쿠폰_친구추가 | `COUPON_FRIEND_ENTRY_DE` | `93377` |
