---
name: urbanmall-schema
description: 어반몰(urbanmall) 원천 스키마 5테이블 구조와 STEP 0 Phase A에서 확정 대기 중인 핵심 정의
metadata:
  type: reference
---

어반몰(UrbanMall) — **데모/시연용 가상 고객사**(실제 운영 고객사 아님, 활성 고객사는 ecommerce-default). 커머스 온보딩 STEP 0 예시. 담당(시나리오상): 이서준 매니저.

**원천 5테이블** (조인키 = `MBR_ID`, 전 테이블 공통):
`MEMBER_INFO`(회원, PK MBR_ID) · `ORDER_MST`(주문, PK ORDER_ID, FK MBR_ID) · `ORDER_ITEM`(주문상세, PK ORDER_ITEM_SEQ, FK ORDER_ID·ITEM_CD) · `ITEM_MST`(상품, PK ITEM_CD) · `COUPON_ISSUE`(쿠폰, PK COUPON_ID, FK MBR_ID).
명명 패턴: `*_YN`=Y/N 플래그, `*_DTM`=DATETIME, `*_YMD`=DATE, `*_AMT`/`*_PRC`=금액. 표준 스키마 5엔티티에 **1:1 전량 매핑 가능**(미매핑 확장 컬럼 없음).

**고객사 특이사항** (`2.핵심정의확인` 시트 기재):
- 총구매액 = `ORDER_MST.PAY_AMT` 합(실결제액, 부가세·배송비 포함)
- `ORDER_STATUS`: COMPLETE=집계 / CANCELED·RETURNED=제외
- **휴면 기준 180일**(표준 템플릿 90일과 다름), 이탈위험은 90일
- 등급값 VIP/GOLD/BASIC, 지역=시도 단위, 마일리지=포인트
- 제공 CSV는 **UTF-8 BOM**(+CRLF) — Import 인코딩 주의

**실측 검증(2026-08-13 재분석)**: 온보딩 킷 폴더명은 `docs/onboarding-kit/작성예시_어반몰/`(과거 `03_` 접두어 없음). CSV 샘플 기준 고아 FK 0건, `ORDER_ITEM_SEQ`는 전역 유일(운영에서 주문별 리셋 여부는 미확인 → **복합 PK `order_id`+`detail_id`로 확정**), `PAY_AMT` vs 상세 단가×수량 합은 15건 중 `U260722-0004`만 4,000 차이(배송비 추정), `MILEAGE_EXP_YMD` 공란 5/10행.

**Phase B 완료(2026-08-13)** — 폴더 `test > urbanmall` **categoryId 96520**. 🚨 표준 키(`RAW_*_DE`, `RECON_Profile_DE`)가 **다른 데이터셋(categoryId 93897, 10만~31만 행)에 선점**돼 있어 전 객체에 **`URBANMALL_` 접두어**를 붙였다. **STEP 1은 `URBANMALL_RECON_Profile`·`URBANMALL_SEG_*`로 부트스트랩해야 한다**(접두어 없이 만들면 기존 10만 행 프로파일을 덮어씀). Import 5종(`IMP_URBANMALL_*`, ManualMap, Enhanced FTP `/Import` 직접 픽업 — File Transfer 불필요) + Automation `ATM_URBANMALL_RAW_Import`(Ready, 무스케줄). **미해결: Update Type이 HITL 확정값 Overwrite가 아니라 `AddAndUpdate`** — API로 설정 불가([[sfmc-import-updatetype]]), UI 수동 변경 필요.

관련: [[onboarding-kit-template]], [[sfmc-import-updatetype]]
