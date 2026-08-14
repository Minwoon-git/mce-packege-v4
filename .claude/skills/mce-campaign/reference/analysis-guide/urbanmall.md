# 분석 가이드 — 고객사: 어반몰 (UrbanMall)

> 🤖 **STEP 0 자동 생성 문서 — 사람이 검토 요망.**
> 최초 생성 **2026-08-07** · **Phase B 완료 2026-08-13** · 생성 주체 `mce-schema-agent` (STEP 0)
> 원천: `docs/onboarding-kit/작성예시_어반몰/` (데이터정보 템플릿 xlsx + `ERD_urbanmall.pdf` + CSV 샘플 5종)
> §2 의미규칙은 고객사(이서준 매니저) 답변 + 사용자 HITL 확정을 그대로 반영했다. **임의 추정값이 아니다.**
>
> ✅ **Phase B 완료 (2026-08-13)** — 폴더·RAW DE 5종·Import 정의 5종·Import Automation을 **실제 생성하고 라이브 재조회로 검증**했다(§1-2·§8).
>
> 🚨 **이름 충돌 회피 — 전 객체에 `URBANMALL_` 접두어를 붙였다.** 표준 키(`RAW_Customers_DE` 등)와 `RECON_Profile_DE`는
> **이미 다른 데이터셋(`test > mce-package`, categoryId 93897, 각 10만~31만 행)이 점유**하고 있다. SFMC는 BU 내 DE 이름·키가 유일해야 하므로
> 표준 이름으로 만들면 기존 활성 고객사 데이터를 건드리게 된다. **표준 컬럼명은 그대로 유지**되므로 하류 계약은 깨지지 않는다.
> ⚠️ **STEP 1은 반드시 `URBANMALL_RECON_Profile` / `URBANMALL_SEG_*` 로 부트스트랩할 것** — 접두어 없이 만들면 기존 `RECON_Profile`(10만 행)을 덮어쓴다.
>
> 📌 **키 전략 확정 (2026-08-13 사용자 승인)** — **활성 고객사 전환 시점에 표준 키로 교체**한다.
> 전환 전까지는 `URBANMALL_` 접두어 그대로 운영하고, 데이터 적재 + 전환 확정 시:
> ① 기존 표준 키 DE(ecommerce-default 데모 데이터 `RAW_*_DE`·`RECON_Profile_DE` 등, categoryId 93897) 삭제 →
> ② 어반몰 객체를 표준 키로 재생성 + `URBANMALL_RAW_*` 데이터 이관(SQL) + Import 5종 대상 DE 재연결 →
> ③ 이 문서의 `URBANMALL_` 키 표기를 표준 키로 일괄 갱신. (기존 데모 DE 삭제는 실행 전 사용자 재확인 필수)

---

## 1. 분석 소스 + 스키마

> ⭐ **이 고객사 원천은 다중 엔티티(정규화된 5테이블)다.** 진단은 이들을 JOIN·집계한 **고객 프로파일 DE(`URBANMALL_RECON_Profile`)** 위에서 수행한다(빌드 방법 = [`_common.md`](_common.md) §6-0). `URBANMALL_SEG_*`와 STEP 1은 이 프로파일을 읽는다.

**원천 엔티티 (위치: `Data Extensions > test > urbanmall`, categoryId **`96520`** — 라이브 검증됨):**

| 엔티티 | 고객 원천 파일 | RAW DE Key | PK | 조인키 | 도출되는 파생값 |
|---|---|---|---|---|---|
| 고객 | `MEMBER_INFO.csv` | `URBANMALL_RAW_Customers_DE` | `member_id` | — | (직접) 로그인·동의·장바구니·생일·등급·포인트 |
| 구매마스터 | `ORDER_MST.csv` | `URBANMALL_RAW_Orders_DE` | `order_id` | `member_id` | `order_count`·`total_spent`·`last_order_date` |
| 구매상세 | `ORDER_ITEM.csv` | `URBANMALL_RAW_OrderDetails_DE` | **`order_id` + `detail_id` (복합 PK)** | `order_id`, `product_id` | (제품 조인) `preferred_category` |
| 제품 | `ITEM_MST.csv` | `URBANMALL_RAW_Products_DE` | `product_id` | — | 카테고리 |
| 쿠폰 | `COUPON_ISSUE.csv` | `URBANMALL_RAW_Coupons_DE` | `coupon_id` | `member_id` | `unused_coupon_count`·`coupon_expire_date` |

- **관계**: 고객 1:N 주문 · 주문 1:N 상세 · 상세 N:1 제품 · 고객 1:N 쿠폰.
- **Contact Key = `member_id`** (원천 `MBR_ID`). ERD 명시 + 고객 답변 + CSV 값 검증(고아 FK 0건) 3중 확인 — HITL 확정.
- **분석 base(진단 소스) = `URBANMALL_RECON_Profile`** — 위 5테이블을 JOIN·집계해 **1행=1고객**으로 통합. 빌드 쿼리 `BUILD_URBANMALL_RECON_Profile`(§2-4 SQL). **데이터 적재 후 STEP 1이 자동 부트스트랩**한다([`_common.md`](_common.md) §6) — STEP 0는 만들지 않았다. 🚨 접두어 없는 `RECON_Profile`은 **다른 데이터셋이 점유 중**(상단 배너).
- ⚠️ **신호는 플래그로 저장하지 않는다** — 대상 판정은 쿼리가 계산한다([`_common.md`](_common.md) 2절).

### 1-1. 컬럼 매핑 (고객 원천 → 표준) + RAW DE 필드 사양

> 🔑 **Y/N 컬럼은 RAW 계층에 `Text(1)` 원문(`Y`/`N`)으로 적재**하고, Boolean 변환은 `BUILD_URBANMALL_RECON_Profile` SQL의 `CASE WHEN … = 'Y'`에서 수행한다(HITL #7 확정).
> 사유 — SFMC Import는 Boolean 필드에 `True/False`·`1/0`을 기대해 `Y/N` 직접 적재가 실패할 수 있다. **표준 컬럼 이름은 그대로 유지**되므로 하류 계약은 깨지지 않는다.

**`URBANMALL_RAW_Customers_DE`** ← `MEMBER_INFO.csv` (14필드, 비-sendable) · DE id `1513d256-b596-f111-a5e1-5cba2c196e68` — ✅ 라이브 검증

| # | 고객 컬럼 | 표준 컬럼 | DE 타입 | Nullable | 비고 |
|---|---|---|---|---|---|
| 1 | `MBR_ID` | `member_id` | Text(50) **PK** | N | Contact Key |
| 2 | `MBR_EMAIL` | `email` | EmailAddress(254) | Y | |
| 3 | `HP_NO` | `phone` | Text(20) | Y | 한국 형식 `010-0000-0000` — SFMC `Phone` 타입 대신 Text 사용(형식 검증 회피) |
| 4 | `BIRTH_YMD` | `birthday` | Date | Y | |
| 5 | `MBR_GRD` | `grade` | Text(20) | Y | `VIP`/`GOLD`/`BASIC` |
| 6 | `ADDR_CITY` | `region` | Text(50) | Y | 시·도 단위 |
| 7 | `REG_DTM` | `signup_date` | Date | Y | DATETIME 시각 보존 |
| 8 | `LST_LOGIN_DTM` | `last_login_date` | Date | Y | 웹·앱 통합 |
| 9 | `EML_AGREE_YN` | `email_consent` | Text(1) | Y | `Y`/`N` 원문 |
| 10 | `SMS_AGREE_YN` | `sms_consent` | Text(1) | Y | `Y`/`N` 원문 |
| 11 | `BASKET_YN` | `has_abandoned_cart` | Text(1) | Y | `Y`/`N` 원문 — **"보유" 플래그이지 "이탈" 아님**(§2-1 참조) |
| 12 | `BASKET_AMT` | `cart_total_amount` | Decimal(18,2) | Y | 미보유 시 `0` |
| 13 | `MILEAGE` | `points_balance` | Decimal(18,2) | Y | 마일리지 = 포인트 |
| 14 | `MILEAGE_EXP_YMD` | `points_expire_date` | Date | **Y** | 공란 실재(샘플 10행 중 **5행** — 2026-08-13 재실측) |

**`URBANMALL_RAW_Orders_DE`** ← `ORDER_MST.csv` (5필드, 비-sendable) · DE id `fc45255d-b596-f111-a5e1-5cba2c196e68` — ✅ 라이브 검증

| # | 고객 컬럼 | 표준 컬럼 | DE 타입 | Nullable |
|---|---|---|---|---|
| 1 | `ORDER_ID` | `order_id` | Text(30) **PK** | N |
| 2 | `MBR_ID` | `member_id` | Text(50) | N |
| 3 | `ORDER_DTM` | `order_date` | Date | Y |
| 4 | `PAY_AMT` | `order_amount` | Decimal(18,2) | Y |
| 5 | `ORDER_STATUS` | `order_status` | Text(20) | Y |

**`URBANMALL_RAW_OrderDetails_DE`** ← `ORDER_ITEM.csv` (5필드, 비-sendable) · DE id `0a46255d-b596-f111-a5e1-5cba2c196e68` — ✅ 라이브 검증

> 🔑 **복합 PK = `order_id` + `detail_id` (HITL 확정).** CSV 샘플에서 `ORDER_ITEM_SEQ`가 전역 유일이긴 했으나,
> 운영 DB에서 **주문별로 1부터 리셋되는 시퀀스일 가능성**을 배제할 수 없다. 단일 PK로 두면 리셋 시 서로 다른 주문의 라인이
> 같은 키로 충돌해 덮어써진다. 복합 PK는 두 경우 모두 안전하다.

| # | 고객 컬럼 | 표준 컬럼 | DE 타입 | Nullable |
|---|---|---|---|---|
| 1 | `ORDER_ITEM_SEQ` | `detail_id` | Number **PK(복합)** | N |
| 2 | `ORDER_ID` | `order_id` | Text(30) **PK(복합)** | N |
| 3 | `ITEM_CD` | `product_id` | Text(30) | Y |
| 4 | `ORD_QTY` | `quantity` | Number | Y |
| 5 | `UNIT_PRC` | `price` | Decimal(18,2) | Y |

**`URBANMALL_RAW_Products_DE`** ← `ITEM_MST.csv` (4필드, 비-sendable) · DE id `0c5d2a63-b596-f111-a5e1-5cba2c196e68` — ✅ 라이브 검증

| # | 고객 컬럼 | 표준 컬럼 | DE 타입 | Nullable |
|---|---|---|---|---|
| 1 | `ITEM_CD` | `product_id` | Text(30) **PK** | N |
| 2 | `ITEM_NM` | `product_name` | Text(200) | Y |
| 3 | `CAT_NM` | `category` | Text(50) | Y |
| 4 | `SELL_PRC` | `price` | Decimal(18,2) | Y |

**`URBANMALL_RAW_Coupons_DE`** ← `COUPON_ISSUE.csv` (5필드, 비-sendable) · DE id `185d2a63-b596-f111-a5e1-5cba2c196e68` — ✅ 라이브 검증

| # | 고객 컬럼 | 표준 컬럼 | DE 타입 | Nullable |
|---|---|---|---|---|
| 1 | `COUPON_ID` | `coupon_id` | Text(30) **PK** | N |
| 2 | `MBR_ID` | `member_id` | Text(50) | N |
| 3 | `ISSUE_YMD` | `issue_date` | Date | Y |
| 4 | `EXPIRE_YMD` | `coupon_expire_date` | Date | Y |
| 5 | `USED_YN` | `used_flag` | Text(1) | Y |

> **표준 스키마 커버리지 100%** — 표준 5엔티티 전 컬럼이 원천에 존재하고, 원천에만 있는 미매핑 확장 컬럼은 **0개**다.
> **원천에 없는 신호**: 장바구니 담은 시각(`cart_updated_date` 상당)이 없어 **"담고 N일 경과" 판정 불가**(§2-1). 필요 시 고객사에 컬럼 추가 요청.

### 1-2. 원천 파일 규격 (Import 설정 근거)

| 항목 | 값 |
|---|---|
| 형식 | CSV, 콤마 구분, 헤더 1행 |
| **인코딩** | **UTF-8 BOM** — ⚠️ BOM 미처리 시 첫 컬럼 매핑 실패. Import 인코딩 명시 필수 |
| 날짜 포맷 | `YYYY-MM-DD` / `YYYY-MM-DD HH:MM:SS` |
| 파일명 | 테이블명 그대로 (`MEMBER_INFO.csv`·`ORDER_MST.csv`·`ORDER_ITEM.csv`·`ITEM_MST.csv`·`COUPON_ISSUE.csv`) |
| 업로드 주기 | 고객 마스터 = 매일 05시 전체 스냅샷. 나머지 미기재 |
| 업로드 위치 | **Enhanced FTP `/Import`** (SFMC 계정 기본 SFTP). File Transfer 경유 없이 Import가 직접 픽업 |
| Update Type | **HITL 확정=Overwrite. 그러나 실제 생성값은 `AddAndUpdate`** — ⚠️ REST API 제약(아래 §1-3) |

### 1-3. 생성된 Import 파이프라인 (✅ 2026-08-13 라이브 검증)

**FTP 위치**: `ExactTarget Enhanced FTP` (id `54f8e795-8155-4197-98fa-fe98ee698172`, locationTypeId 0) — 계정 기본 위치를 재사용했다. **신규 SFTP 자격증명을 만들지 않았다.**

| Import 정의 (CustomerKey) | 원천 파일 | 대상 DE | 필드매핑 | Update Type |
|---|---|---|---|---|
| `IMP_URBANMALL_Customers` | `MEMBER_INFO.csv` | `URBANMALL_RAW_Customers_DE` | ManualMap 14 | `AddAndUpdate` ⚠️ |
| `IMP_URBANMALL_Orders` | `ORDER_MST.csv` | `URBANMALL_RAW_Orders_DE` | ManualMap 5 | `AddAndUpdate` ⚠️ |
| `IMP_URBANMALL_OrderDetails` | `ORDER_ITEM.csv` | `URBANMALL_RAW_OrderDetails_DE` | ManualMap 5 | `AddAndUpdate` ⚠️ |
| `IMP_URBANMALL_Products` | `ITEM_MST.csv` | `URBANMALL_RAW_Products_DE` | ManualMap 4 | `AddAndUpdate` ⚠️ |
| `IMP_URBANMALL_Coupons` | `COUPON_ISSUE.csv` | `URBANMALL_RAW_Coupons_DE` | ManualMap 5 | `AddAndUpdate` ⚠️ |

공통 설정: `fileType=CSV` · `hasColumnHeader=true` · `encodingName=utf-8`(SFMC 자동 설정 — BOM 요건 충족) · `dateFormatLocale=en-US`(ISO `YYYY-MM-DD` 파싱) · `allowErrors=true` · `deleteFile=false`.

> 🚨 **잔여 수동 작업 — Update Type을 Overwrite로 바꿔야 한다.**
> `/automation/v1/imports`의 `updateTypeId`는 **0·1·2만 허용**하고 `3`을 거부한다(400 Bad Request). SOAP 라벨을 실측한 결과:
> `0=AddAndUpdate` · `1=AddAndDoNotUpdate` · `2=UpdateButDoNotAdd` — **`Overwrite`를 지정할 값이 REST에 없다.**
> SOAP `Update`로 `UpdateType=Overwrite`를 시도하면 `FieldMaps was not specified`(오류 43060)로 전체 필드매핑 재전송을 요구해 실패한다.
> → **Automation Studio UI에서 Import 정의 5종의 Data Action을 "Overwrite"로 1회 변경**할 것.
> **미변경 시 영향**: 전량 스냅샷인데 AddAndUpdate로 동작해 **원천에서 삭제된 회원·주문 행이 DE에 잔존**한다(모수 과대 집계).
> 임시 대안: 각 Import 앞에 대상 DE를 비우는 SQL Query(Overwrite, 0행 SELECT) 단계를 넣으면 Overwrite와 동등해진다.

**Import Automation**: `ATM_URBANMALL_RAW_Import` (id `456f1d80-06c9-4adb-ab3e-6e9dc4fe75bf`, categoryId 82571)
- 5스텝 순차: 고객 → 제품 → 구매마스터 → 구매상세 → 쿠폰 (`objectTypeId` 43 = Import File)
- **상태 `Ready` / `typeId 0`(unspecified) — 스케줄 미등록·미실행.** 데이터 적재 게이트 전이라 의도적으로 스케줄을 걸지 않았다(걸면 파일 없는 상태로 매일 실패한다).
- 첫 파일 업로드·검증 후 스케줄 전환 권장값: `FREQ=DAILY;INTERVAL=1`, `startDate` 05:30, `timeZoneId=48`(Seoul) — 고객 업로드 05시 + 30분 버퍼.
- **File Transfer 액티비티는 만들지 않았다** — 파일이 Enhanced FTP에 직접 올라오므로 Import가 그대로 읽는다. Safehouse 경유가 불필요하고, 넣으면 Import 전에 파일을 옮겨버릴 위험이 있다. (계정의 기존 `IMP_Audit*` 임포트도 동일 위치를 직접 참조해 동작 중)

---

## 2. 지표 정의 (의미 사전 — AI는 이 "정의"를 SQL로 번역한다)

> ⭐ 정의를 바꾸면 AI가 만드는 쿼리도 따라 바뀐다 — **DE 재적재·코드 수정 불필요, 이 정의만 수정.**

### 2-1. 데이터 의미 규칙 (어반몰 확정 기준 — HITL 확정)

| 항목 | 어반몰 정의 | 확정 근거 |
|---|---|---|
| **누적 결제액 (`total_spent`)** | **`URBANMALL_RAW_Orders.order_amount`(원천 `PAY_AMT`) 합산.** 쿠폰·마일리지 차감 후 **실결제액**, 부가세·배송비 **포함**. 주문상세 단가×수량 합이 **아님** | 고객 답변 + HITL #2 확정. 샘플 15건 중 `U260722-0004`만 ①112,000 ≠ ②108,000(배송비 추정) — 실매출은 ① |
| **취소·환불 처리** | **`order_status = 'COMPLETE'`인 주문만 집계.** `CANCELED`(취소)·`RETURNED`(반품)는 **전면 제외** | 고객 답변 + HITL #3 |
| **`last_order_date`** | **`COMPLETE` 주문의 `MAX(order_date)`** — 취소·반품 주문은 마지막 주문일에도 반영하지 않음 | HITL #3 확정(고객 답변엔 미기재, 이탈 판정 일관성상 확정). ⚠️ 유일 주문이 취소된 회원은 "첫구매 미전환"으로 분류됨 |
| **주문 수 (`order_count`)** | `COMPLETE` 주문 건수 | HITL #3 |
| **동의 값 해석** | `Y` = 동의 / `N` **및 공란(NULL)** = 미동의 | 고객 답변("공란 없음 — 가입 시 필수 선택, 기본 N 저장") + HITL #5 |
| **Y/N → Boolean 변환 위치** | RAW DE는 `Text(1)` 원문 유지. **`BUILD_URBANMALL_RECON_Profile` SQL에서 `CASE WHEN … = 'Y' THEN 'True' ELSE 'False' END`** 로 변환해 `URBANMALL_RECON_Profile`에 Boolean 저장 | HITL #7 (기술 결정) |
| **장바구니 이탈 (`has_abandoned_cart`)** | **`BASKET_YN = 'Y' AND cart_total_amount > 0`** 일 때만 True. 원천 컬럼은 "장바구니 **보유**" 플래그이지 "이탈"이 아님 | HITL #6 |
| ⚠️ **장바구니 경과일 판정 불가** | **원천에 장바구니 담은 시각 컬럼이 없다.** "담고 3일 지난 사람" 류 조건은 **만들 수 없다** — 요청 시 "그 컬럼이 없다"고 명시하고 대안 제시(지어내지 않는다) | HITL #6 |
| **미사용 쿠폰 (`unused_coupon_count`)** | **`used_flag = 'N' AND coupon_expire_date >= 오늘`** — 미사용 **AND 미만료**만 카운트 | HITL #4. 원천에 만료 쿠폰이 섞여 들어옴(템플릿 "만료 쿠폰 포함") |
| **선호 카테고리 (`preferred_category`)** | 구매 **수량(`quantity`) 최다** 카테고리. 금액 기준 아님 | HITL #8 |
| **상품 단가 주의** | `URBANMALL_RAW_OrderDetails.price` = **주문 시점 판매단가**, `URBANMALL_RAW_Products.price` = **현재 판매가**. 두 값은 다르다(샘플에서 확인) — 금액 계산엔 항상 주문상세 단가 사용 | CSV 실측 |
| Boolean 비교 | `= 'True'` / `= 1` 둘 다 동작 (`URBANMALL_RECON_Profile` 계층) | 표준 |

### 2-2. 기준 일수 (⚠️ 표준 템플릿과 다름)

| 지표 | **어반몰 기준** | 표준 템플릿 | 근거 |
|---|---|---|---|
| **휴면** | **180일** (마지막 **로그인** 경과) | 90일 | 고객사 자사 CRM 기준 — "기본 90일 아님" 명시 요청. HITL #9 |
| **이탈위험** | **90일** (마지막 **주문** 경과) | 90일 | 고객사 동의. HITL #9 |
| 신규 회원 | 30일 (가입 경과) | 30일 | 표준 유지 |
| 만료 임박(쿠폰·포인트) | 7일 | 7일 | 표준 유지 |

> 🚨 **휴면 180일은 이 고객사 고유값이다.** 90일로 계산하면 대상 규모가 과대 집계된다. `URBANMALL_SEG_dormant_DE` 쿼리 생성 시 반드시 180 적용.

### 2-3. 지표 정의 (자연어 정의 → AI가 SQL 조립)

| 지표 | **정의 (말로)** | 쓰는 컬럼 | AI가 조립할 SQL 조건 *(예시)* |
|---|---|---|---|
| 구매자 | 완료 주문 1회 이상 | `order_count` | `order_count >= 1` |
| 1회성 구매자 | 완료 주문이 정확히 1회 | `order_count` | `order_count = 1` |
| 첫구매 미전환 | 가입했으나 완료 주문 0 | `order_count` | `order_count = 0` |
| **이탈위험** | 구매자 중 마지막 완료주문 후 **90일** 경과 | `order_count`,`last_order_date` | `order_count>=1 AND DATEDIFF(day,last_order_date,GETDATE())>=90` |
| **휴면** | 마지막 로그인 후 **180일** 경과 | `last_login_date` | `DATEDIFF(day,last_login_date,GETDATE())>=180` |
| 신규 회원 | 가입 30일 이내 | `signup_date` | `DATEDIFF(day,signup_date,GETDATE())<=30` |
| **장바구니 이탈** | 장바구니 보유 **AND** 금액 > 0 | `has_abandoned_cart`,`cart_total_amount` | `has_abandoned_cart='True' AND cart_total_amount>0` |
| 생일 | 오늘이 생일 | `birthday` | `MONTH(birthday)=MONTH(GETDATE()) AND DAY(birthday)=DAY(GETDATE())` |
| **쿠폰 만료 임박** | 미사용·미만료 쿠폰 보유 + 만료 7일 이내 | `coupon_expire_date`,`unused_coupon_count` | `unused_coupon_count>0 AND coupon_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE())` |
| 포인트 만료 임박 | 만료 7일 이내 + 잔액 보유 | `points_expire_date`,`points_balance` | `points_expire_date BETWEEN GETDATE() AND DATEADD(day,7,GETDATE()) AND points_balance>0` |
| VIP | 최상위 등급 | `grade` | `grade='VIP'` (등급 체계 `VIP` > `GOLD` > `BASIC`) |
| 미동의 | 이메일·SMS 모두 미동의 | `email_consent`,`sms_consent` | `email_consent='False' AND sms_consent='False'` |

> `GETDATE()`=오늘. 위 SQL은 정의를 보여주는 **예시**이며, 더 복잡한 캠페인은 AI가 정의들을 AND로 조합해 새 쿼리를 만든다.

### 2-4. `BUILD_URBANMALL_RECON_Profile` — 어반몰 전용 빌드 SQL (STEP 1 부트스트랩용)

> [`_common.md`](_common.md) §6-0 검증 패턴에 어반몰 확정 규칙(COMPLETE 필터·Y/N 변환·쿠폰 미만료·수량 기준 선호 카테고리)을 적용한 형태. **Overwrite로 매번 재집계**(파생값 박제 금지).

```sql
SELECT c.member_id,
       c.email, c.phone, c.birthday, c.grade, c.region,
       c.signup_date, c.last_login_date,
       CASE WHEN c.email_consent = 'Y' THEN 'True' ELSE 'False' END AS email_consent,
       CASE WHEN c.sms_consent   = 'Y' THEN 'True' ELSE 'False' END AS sms_consent,
       CASE WHEN c.has_abandoned_cart = 'Y' AND c.cart_total_amount > 0
            THEN 'True' ELSE 'False' END                            AS has_abandoned_cart,
       COALESCE(c.cart_total_amount,0) AS cart_total_amount,
       COALESCE(c.points_balance,0)    AS points_balance,
       c.points_expire_date,
       COALESCE(o.order_count,0)       AS order_count,
       COALESCE(o.total_spent,0)       AS total_spent,
       o.last_order_date,
       pc.category                     AS preferred_category,
       COALESCE(cp.unused_coupon_count,0) AS unused_coupon_count,
       cp.coupon_expire_date
FROM   URBANMALL_RAW_Customers_DE c
-- 주문 집계: COMPLETE만 (취소 CANCELED / 반품 RETURNED 제외)
LEFT JOIN (SELECT member_id,
                  COUNT(*)              AS order_count,
                  SUM(order_amount)     AS total_spent,      -- PAY_AMT 합 (실결제액)
                  MAX(order_date)       AS last_order_date
           FROM   URBANMALL_RAW_Orders_DE
           WHERE  order_status = 'COMPLETE'
           GROUP BY member_id) o ON o.member_id = c.member_id
-- 쿠폰 집계: 미사용 AND 미만료만
LEFT JOIN (SELECT member_id,
                  COUNT(*)              AS unused_coupon_count,
                  MIN(coupon_expire_date) AS coupon_expire_date
           FROM   URBANMALL_RAW_Coupons_DE
           WHERE  used_flag = 'N' AND coupon_expire_date >= GETDATE()
           GROUP BY member_id) cp ON cp.member_id = c.member_id
-- 선호 카테고리: 구매 '수량' 최다 (COMPLETE 주문 기준)
LEFT JOIN (SELECT member_id, category FROM (
             SELECT o2.member_id, p.category,
                    ROW_NUMBER() OVER (PARTITION BY o2.member_id
                                       ORDER BY SUM(d.quantity) DESC) rn
             FROM   URBANMALL_RAW_Orders_DE o2
             JOIN   URBANMALL_RAW_OrderDetails_DE d ON d.order_id   = o2.order_id
             JOIN   URBANMALL_RAW_Products_DE     p ON p.product_id = d.product_id
             WHERE  o2.order_status = 'COMPLETE'
             GROUP BY o2.member_id, p.category) z
           WHERE rn = 1) pc ON pc.member_id = c.member_id
```

**주의** ([`_common.md`](_common.md) §6-0 실측 한계 그대로 적용):
- `LEFT JOIN` + `COALESCE(...,0)` 으로 **비구매자도 프로파일에 남긴다**(모수 누락 방지).
- **비구매자의 `preferred_category`는 NULL** — 구매 기반으로는 채울 수 없다.
- 프로파일 DE도 **stale 대상**(§6-1b) — 원천 Import 후 재집계 필요.

### 2-5. 동의 필터 (채널별, 발송 쿼리에 항상 결합)

- 이메일 → `email_consent='True'` / SMS·알림톡·카카오 → `sms_consent='True'` (`URBANMALL_RECON_Profile` 계층 기준)
- ⚠️ 완전 미동의자는 도달 채널이 없어 **마케팅 캠페인 대상에서 제외**한다. 동의 필터를 우회한 발송 저니를 만들지 않는다([`_common.md`](_common.md) 4절).

---

## 3. 추천 기준선 — ⚠️ 참고용 예시 (규칙 아님)

> ⭐ **기준선은 AI가 데이터 분포를 프로파일링해서 정한다** ([`_common.md`](_common.md) 2절). 아래는 분포를 못 봤을 때의 fallback 예시일 뿐이다.
> **어반몰은 아직 데이터가 적재되지 않아 실제 분포가 없다.** STEP 1 최초 실행 시 프로파일링 결과로 이 표를 갱신할 것.

| 지표 | 참고 기본값(예시) | 흔한 추천 캠페인(예시) |
|---|---|---|
| 1회성 구매자 비중 | ~60% | 2차 구매 유도 |
| 이탈위험(90일) | ~25% | 이탈 고객 재구매 유도 |
| 휴면(**180일**) | — (기준일수가 표준보다 길어 표준 30%보다 **낮게** 나옴이 정상) | 휴면 고객 재활성화 |
| 첫구매 미전환 | ~20% | 신규 첫구매 유도 |
| 장바구니 이탈 | ~15% | 장바구니 리마인더 |

---

## 4. 진단 세그먼트 — `URBANMALL_SEG_*` (⚠️ 예시 세트, 고정 목록 아님)

> ⭐ 측정할 세그먼트는 AI가 §1 스키마 + §2 의미규칙을 프로파일링해 스스로 정한다. 아래는 이커머스 공통 출발점이다.
> **현재 계정에 어반몰 세그먼트 DE는 존재하지 않는다** — 데이터 적재 후 STEP 1이 [`_common.md`](_common.md) §6-2로 자동 생성한다.
> 🚨 **접두어 필수** — 접두어 없는 `SEG_*`·`CP_DIAGNOSIS_AUTOMATION`은 다른 데이터셋이 이미 쓰고 있다(상단 배너).

카운트 DE 위치: `Data Extensions > test > urbanmall` (categoryId **`96520`**). **`member_id` 1컬럼·비-sendable**, rowCount=인원.

| 세그먼트 | 카운트 DE Key | 근거 지표(§2-3) |
|---|---|---|
| 1회성 구매자 | `URBANMALL_SEG_repeat_buyer_DE` | 1회성 구매자 |
| 구매자(이탈 분모) | `URBANMALL_SEG_buyers_DE` | 구매자 |
| 이탈위험 | `URBANMALL_SEG_churn_DE` | 이탈위험 (90일) |
| 휴면 | `URBANMALL_SEG_dormant_DE` | 휴면 (**180일** — 표준과 다름) |
| 첫구매 미전환 | `URBANMALL_SEG_noconv_DE` | 첫구매 미전환 |
| 장바구니 이탈 | `URBANMALL_SEG_cart_DE` | 장바구니 이탈 (금액>0 결합) |
| 미동의 | `URBANMALL_SEG_noconsent_DE` | 미동의 |

- **Automation**: `URBANMALL_CP_DIAGNOSIS_AUTOMATION` — 매일 03:00 KST Overwrite 집계. **미생성** — STEP 1이 부트스트랩.
- **생성 SQL 형태**: `SELECT member_id FROM URBANMALL_RECON_Profile WHERE <§2 정의로 조립한 조건>` — Contact Key 1컬럼만, Overwrite.
- **전체 모수** = `URBANMALL_RECON_Profile` rowCount, **구매자 모수** = `URBANMALL_SEG_buyers_DE` rowCount.

---

## 5. 진입(발송) DE / 폴더 매핑

캠페인 선택 후 AI가 `URBANMALL_RECON_Profile`을 §2 정의 + 동의 필터로 조립한 쿼리로 필터해 진입 DE를 채운다(SKILL.md STEP 1-6).

> ⚠️ **어반몰 진입 DE는 아직 하나도 없다.** 아래는 명명 규칙 제안이다. 폴더는 `test > urbanmall`(**categoryId `96520`**)을 쓰거나
> 그 하위에 캠페인별 폴더를 새로 만든다. **DE Key에도 `URBANMALL_` 접두어를 붙일 것**(기존 데이터셋과 충돌 방지).

| 의도 | 진입 DE명(예) | DE Key(예) | categoryId |
|---|---|---|---|
| 신규 회원 | 신규회원_웰컴 | `URBANMALL_WELCOME_ENTRY_DE` | `96520` |
| 이탈/재활성화 | 이탈고객_재활성화 | `URBANMALL_CHURN_ENTRY_DE` | `96520` |
| 휴면 재활성화 | 휴면고객_재활성화 | `URBANMALL_DORMANT_ENTRY_DE` | `96520` |
| 장바구니 이탈 | 장바구니_이탈 | `URBANMALL_CART_ABANDON_ENTRY_DE` | `96520` |
| 생일 | 생일_쿠폰 | `URBANMALL_BIRTHDAY_ENTRY_DE` | `96520` |
| 쿠폰 만료 임박 | 쿠폰_만료임박 | `URBANMALL_COUPON_EXPIRE_ENTRY_DE` | `96520` |

---

## 6. 기획(planning) 가이드 — `mce-planning-agent`가 참조

- **주 채널**: ⚠️ **미확정.** 어반몰 BU에 알림톡(카카오) 채널이 연결됐는지 확인되지 않았다. 확인 전까지는 **이메일을 기본 채널로 가정**하고, 알림톡 요청 시 상위가 "채널 해소(seq 확보)"를 먼저 수행해야 한다(CLAUDE.md 메시지 채널 해소 절).
- **재진입 기본값**(의도 미지정 시): `No re-entry`.
- **스케줄 관례**: 반복 발송 기본 시각 **09:00 KST**, `timeZoneId=48`(Seoul). 1회성 의도면 On Activation(빈값).
- **동의 채널 매핑**: 이메일=`email_consent`, 알림톡/SMS=`sms_consent` (§2-5).
- **등급 활용**: `VIP`/`GOLD`/`BASIC` 3단계 — VIP 전용 혜택 캠페인 설계 가능.

---

## 7. 전이(journey) 가이드 — `mce-journey-agent`가 참조 (⚠️ BU 고정값)

> 🚨 **어반몰 BU의 발송 고정값은 하나도 확인되지 않았다.** 아래는 **전부 미확인**이며, `ecommerce-default.md`의 값을 그대로 쓰면 JB UI에서 "사용할 수 없는 콘텐츠"로 뜬다(다른 BU 값이므로).
> 첫 저니 생성 전 **`sfmc_get_send_classifications`·`sfmc_get_sender_profiles`·`sfmc_get_lists`로 라이브 조회**해 이 표를 채울 것.

### 7-1. 발송 고정값 (이메일 액티비티 `triggeredSend`)

| 항목 | 이름 | GUID / ID |
|---|---|---|
| Send Classification | `<미확인>` | `<미확인 — 라이브 조회 필요>` |
| Sender Profile | `<미확인>` | `<미확인 — 라이브 조회 필요>` |
| Delivery Profile | `<미확인>` | `<미확인 — 라이브 조회 필요>` |
| Publication List | `<미확인>` | `<미확인 — 라이브 조회 필요>` |

### 7-2. 알림톡/문자 (REST 커스텀 액티비티)

| 항목 | 값 |
|---|---|
| `applicationExtensionKey` | `<미확인 — 어반몰 BU 알림톡 연동 여부부터 확인>` |
| 모바일 컨텐츠 seq | `<미확인 — 채널 해소 단계에서 micrm 조회로 확정>` |

---

## 8. Phase B 실행 결과 (2026-08-13)

| # | 작업 | 결과 |
|---|---|---|
| 1 | 폴더 `Data Extensions > test > urbanmall` 생성 | ✅ **categoryId `96520`** (parent `test`=88641) |
| 2 | RAW DE 5종 생성 (§1-1 사양, 전부 비-sendable, 0행) | ✅ 5/5 — 접두어 `URBANMALL_` 적용 |
| 3 | 🚨 생성 후 검증 — 재조회로 실재·필드 구성·PK 확인 | ✅ 필드수 14/5/5/4/5 일치, **복합 PK(`order_id`+`detail_id`) 확인** |
| 4 | SFTP 위치 | ✅ **기존 `ExactTarget Enhanced FTP` 재사용** — 신규 자격증명 생성 안 함 |
| 5 | File Transfer 5종 | ⏭️ **의도적 미생성** — Enhanced FTP 직접 픽업이라 불필요(§1-3 사유) |
| 6 | Import Definition 5종 (ManualMap, utf-8, 헤더 1행) | ✅ 5/5 생성·SOAP 재검증. ⚠️ **Update Type = `AddAndUpdate`**(Overwrite는 API 불가 → §1-3 수동 작업) |
| 7 | Import Automation `ATM_URBANMALL_RAW_Import` | ✅ 생성 (5스텝 순차, 상태 `Ready`). **스케줄 미등록·미실행** — 데이터 게이트 준수 |
| 8 | 이 문서 갱신 | ✅ 배너·§1·§1-2·§1-3·§2·§4·§5·§8 |

### 8-1. 남은 작업 (사람이 해야 함)

| 우선순위 | 항목 | 사유 |
|---|---|---|
| 🔴 높음 | **Import 5종의 Data Action을 UI에서 `Overwrite`로 변경** | REST/SOAP로 설정 불가(§1-3). 미변경 시 삭제된 회원·주문 행이 DE에 잔존 |
| 🔴 높음 | **고객사에 SFTP 업로드 안내** — Enhanced FTP `/Import`에 5개 파일 | 업로드 없이는 STEP 1 진단 불가 |
| 🟡 중간 | **`ORDER_MST` 전량/증분 확인** | "최근 2년치 보유"만 기재. 증분이면 Overwrite가 과거 주문을 날린다 → 이 한 건만 AddAndUpdate 유지 |
| 🟡 중간 | **첫 Import 수동 1회 실행 후 결과 확인** → 이상 없으면 Automation 스케줄 05:30 KST 등록 | BOM·날짜 파싱·PK 충돌은 실제 파일로만 검증 가능 |
| 🟡 중간 | **어반몰 BU 발송 고정값 확보** (§7-1 4종) | 첫 저니 생성 전 필수 |
| ⚪ 낮음 | **`ORDER_ITEM_SEQ` 주문별 리셋 여부 확인** | 복합 PK로 이미 안전. 확인되면 문서만 정리 |

### 8-2. 고객사 전달용 — SFTP 업로드 규격

- **위치**: SFMC Enhanced FTP → **`/Import`** 디렉토리 (계정 SFTP 호스트·자격증명은 SFMC Setup > Data Management > FTP Accounts에서 발급)
- **파일명 (고정, 대소문자 일치)**: `MEMBER_INFO.csv` · `ORDER_MST.csv` · `ORDER_ITEM.csv` · `ITEM_MST.csv` · `COUPON_ISSUE.csv`
  - ⚠️ 날짜 suffix·zip 압축 없이 **위 이름 그대로** 올린다(Import 정의가 정확히 이 이름을 찾는다).
- **형식**: CSV · 콤마 구분 · **헤더 1행 필수**(원천 컬럼명 그대로: `MBR_ID`, `PAY_AMT` …) · UTF-8 · CRLF
- **날짜**: `YYYY-MM-DD` 또는 `YYYY-MM-DD HH:MM:SS`
- **권장 시각**: 매일 05:00 KST 이전 업로드 완료 (Import는 05:30 예정)
