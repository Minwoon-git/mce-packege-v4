---
name: reference-diagnosis-counts
description: STEP1 진단 = 새벽 Automation이 미리 적재한 SEG_* 카운트 DE의 rowCount를 읽음(즉석 집계 X). 발송 DE는 선택 후 생성.
metadata:
  type: reference
---

## STEP 1 진단 = 사전 집계 카운트 읽기 (대기 없음)

매일 새벽 Automation `CP_DIAGNOSIS_AUTOMATION`(03:00 KST)이 세그먼트별 `SEG_*` 카운트 DE에 인원을 미리 적재한다. 추천 시엔 **rowCount만 읽어** 즉시 진단.

방법:
1. `sfmc_get_data_extension`(GUID)로 rowCount 읽기 — 모수 `Customer_Profile`·`SEG_buyers_DE`, 세그먼트 `SEG_repeat_buyer_DE`/`SEG_churn_DE`/`SEG_dormant_DE`/`SEG_noconv_DE`/`SEG_cart_DE`/`SEG_noconsent_DE`.
2. 비율 = 세그먼트/분모 → `reference/de-and-folders.md` 룰셋 기준선과 대조 → **비율 높은 순** 추천.
3. 발송(진입) DE는 진단 단계에서 안 만든다. 캠페인 선택 후 1-6에서 세그먼트 조건 + 동의 필터로 생성.

## 하지 말 것 / 주의

- **즉석 집계(추천 때마다 SQL 직접 run) 금지.** 매번 1~2분 대기 + 비동기 rowCount 0 오판으로 불안정. 사전 적재분만 읽는다.
- rowCount가 0이면 = Automation 미실행. 상위에 "카운트 미적재 → `CP_DIAGNOSIS_AUTOMATION` 1회 실행(`sfmc_run_automation`) 후 1~2분 뒤 재시도"로 반환. **"데이터가 SQL 레이어에 없다"는 식으로 오판 금지** — Customer_Profile은 SQL로 정상 조회됨(`SELECT ... FROM Customer_Profile`로 6,400 등 확인 완료).
- **GUID는 하드코딩 금지.** SEG_*는 재생성되면 GUID가 바뀐다. `sfmc_get_data_extensions(query_json:{"$search":"SEG_"})`로 그때그때 GUID를 찾는다. `sfmc_get_data_extension`은 GUID(id)로만 조회된다(key 불가).

## 운영 상수

- Customer_Profile: key `CD_Customer_Profile_DE`, 10,000행(테스트 합성), 원천 23필드 sendable.
- SQL Query 폴더 categoryId = **82567**. Automation 폴더 = **82571**.
- SFMC SQL Query/Automation은 비동기 — run 후 1~2분 대기.

## 출력 표현 규칙 (사용자 노출)

- "약점/주목" 컬럼·단어 안 씀. **지표·인원·비율·추천 캠페인**만, 비율 높은 순.
- 캠페인 명칭 풀어쓰기: 윈백→"이탈 고객 재구매 유도", 재활성화→"휴면 고객 재활성화", 미전환→"신규 첫구매 유도".

## 2026-06-25 검증값 (모수 10,001 / 구매자 7,901)

repeat 6,401(81%/구매자) · churn 2,529(32%/구매자) · dormant 3,501(35%/전체) · noconv 2,100(21%/전체) · cart 1,800(18%/전체) · noconsent 5,500(55%/전체).

## SEG_* DE GUID (2026-06-25 조회)

| DE key | GUID | rowCount |
|---|---|---|
| SEG_repeat_buyer_DE | e6996ca3-9f70-f111-a5e1-5cba2c19fe48 | 6,401 |
| SEG_buyers_DE | 509a6ca3-9f70-f111-a5e1-5cba2c19fe48 | 7,901 |
| SEG_churn_DE | ef5563a9-9f70-f111-a5e1-5cba2c19fe48 | 2,529 |
| SEG_dormant_DE | f95563a9-9f70-f111-a5e1-5cba2c19fe48 | 3,501 |
| SEG_noconv_DE | 075663a9-9f70-f111-a5e1-5cba2c19fe48 | 2,100 |
| SEG_cart_DE | 125663a9-9f70-f111-a5e1-5cba2c19fe48 | 1,800 |
| SEG_noconsent_DE | 7d5663a9-9f70-f111-a5e1-5cba2c19fe48 | 5,500 |
| Customer_Profile (CD_Customer_Profile_DE) | 0e7c0166-836d-f111-a5e1-5cba2c19fe48 | 10,001 |
