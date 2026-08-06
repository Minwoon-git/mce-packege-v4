-- ==========================================================================
-- GlowShop (글로우샵) — 고객 제공 스키마 예시 (DDL 형태)
-- STEP 0 스키마 분석 입력 샘플 · 표준과 "일부러 다른" 명명 사용
-- 원천 5개 엔티티: 회원 / 주문 / 주문상세 / 상품 / 쿠폰
-- DBMS: MySQL 8 방언 가정 (COMMENT 로 컬럼 의미 힌트 포함)
-- ==========================================================================

-- 1) 회원 마스터  (표준: RAW_Customers)  파일: CUST_MST.csv
CREATE TABLE CUST_MST (
  CUST_NO       BIGINT       NOT NULL COMMENT '회원 고유번호(PK)',      -- ↔ member_id
  EMAIL_ADDR    VARCHAR(120)          COMMENT '이메일 주소',            -- ↔ email
  MOBILE        VARCHAR(20)           COMMENT '휴대폰 번호',            -- ↔ phone
  BIRTH_DT      DATE                  COMMENT '생년월일',               -- ↔ birthday
  GRADE_CD      VARCHAR(10)           COMMENT '회원등급코드(BRONZE/SILVER/GOLD/VIP)', -- ↔ grade
  SIDO          VARCHAR(20)           COMMENT '거주 시/도',             -- ↔ region
  JOIN_DT       DATETIME              COMMENT '가입일시',               -- ↔ signup_date
  LAST_CONN_DT  DATETIME              COMMENT '마지막 로그인 일시',     -- ↔ last_login_date
  EMAIL_YN      CHAR(1)               COMMENT '이메일 수신동의(Y/N)',   -- ↔ email_consent
  SMS_YN        CHAR(1)               COMMENT 'SMS 수신동의(Y/N)',      -- ↔ sms_consent
  CART_YN       CHAR(1)               COMMENT '장바구니 보유여부(Y/N)', -- ↔ has_abandoned_cart
  CART_AMT      DECIMAL(12,2)         COMMENT '장바구니 담긴 금액',     -- ↔ cart_total_amount
  POINT_BAL     DECIMAL(12,0)         COMMENT '보유 포인트 잔액',       -- ↔ points_balance
  POINT_EXP_DT  DATE                  COMMENT '포인트 소멸 예정일',     -- ↔ points_expire_date
  PRIMARY KEY (CUST_NO)
) COMMENT='회원 마스터';

-- 2) 주문 (구매 마스터)  (표준: RAW_Orders)  파일: ORD.csv
CREATE TABLE ORD (
  ORD_NO    VARCHAR(20)  NOT NULL COMMENT '주문번호(PK)',              -- ↔ order_id
  CUST_NO   BIGINT       NOT NULL COMMENT '주문한 회원번호(FK→CUST_MST)', -- ↔ member_id
  ORD_DT    DATETIME              COMMENT '주문일시',                  -- ↔ order_date (→ last_order_date 파생)
  ORD_AMT   DECIMAL(12,2)         COMMENT '주문 총액(배송비 포함)',    -- ↔ order_amount (→ total_spent 파생)
  ORD_STAT  VARCHAR(10)           COMMENT '주문상태(PAID/CANCEL/REFUND)',
  PRIMARY KEY (ORD_NO)
) COMMENT='주문';

-- 3) 주문상세  (표준: RAW_OrderDetails)  파일: ORD_DTL.csv
CREATE TABLE ORD_DTL (
  ORD_DTL_SEQ BIGINT      NOT NULL COMMENT '주문상세 일련번호(PK)',    -- ↔ detail_id
  ORD_NO      VARCHAR(20) NOT NULL COMMENT '주문번호(FK→ORD)',        -- ↔ order_id
  PRD_CD      VARCHAR(20) NOT NULL COMMENT '상품코드(FK→PRD)',        -- ↔ product_id
  QTY         INT                  COMMENT '수량',                     -- ↔ quantity
  SALE_PRC    DECIMAL(12,2)        COMMENT '판매단가(할인 반영)',      -- ↔ price
  PRIMARY KEY (ORD_DTL_SEQ)
) COMMENT='주문상세';

-- 4) 상품  (표준: RAW_Products)  파일: PRD.csv
CREATE TABLE PRD (
  PRD_CD   VARCHAR(20)  NOT NULL COMMENT '상품코드(PK)',              -- ↔ product_id
  PRD_NM   VARCHAR(200)          COMMENT '상품명',                    -- ↔ product_name
  CTGR_NM  VARCHAR(60)           COMMENT '카테고리명(스킨케어/메이크업/향수 등)', -- ↔ category (→ preferred_category 파생)
  LIST_PRC DECIMAL(12,2)         COMMENT '정가',                      -- ↔ price
  PRIMARY KEY (PRD_CD)
) COMMENT='상품';

-- 5) 쿠폰  (표준: RAW_Coupons)  파일: CPN.csv
CREATE TABLE CPN (
  CPN_NO  VARCHAR(24) NOT NULL COMMENT '쿠폰 발급번호(PK)',          -- ↔ coupon_id
  CUST_NO BIGINT      NOT NULL COMMENT '보유 회원번호(FK→CUST_MST)', -- ↔ member_id
  ISS_DT  DATE                 COMMENT '발급일',                     -- ↔ issue_date
  EXP_DT  DATE                 COMMENT '만료일',                     -- ↔ coupon_expire_date (미사용 MIN → 파생)
  USE_YN  CHAR(1)              COMMENT '사용여부(Y/N)',              -- ↔ used_flag (→ unused_coupon_count 파생)
  PRIMARY KEY (CPN_NO)
) COMMENT='쿠폰';
