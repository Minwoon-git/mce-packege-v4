---
name: reference-diagnosis-counts
description: STEP1 진단 = 사전 집계 SEG_* 카운트 DE의 rowCount를 읽음(즉석 집계 X). 발송 DE는 선택 후 생성.
metadata:
  type: reference
---

## STEP 1 진단 = 사전 집계 카운트 읽기 (대기 없음)

매일 새벽 Automation `CP_DIAGNOSIS_AUTOMATION`(03:00 KST)이 세그먼트별 `SEG_*` 카운트 DE에 인원을 미리 적재한다. 추천 시엔 **rowCount만 읽어** 즉시 진단.

방법:
1. `sfmc_get_data_extension`(GUID)로 rowCount 읽기 — 모수 `Customer_Profile`·`SEG_buyers_DE`, 세그먼트 `SEG_repeat_buyer_DE`/`SEG_churn_DE`/`SEG_dormant_DE`/`SEG_noconv_DE`/`SEG_cart_DE`/`SEG_noconsent_DE`.
2. 비율 = 세그먼트/분모 → 분석 가이드 기준선과 대조 → **비율 높은 순** 추천.
3. 발송(진입) DE는 진단 단계에서 안 만든다. 캠페인 선택 후 1-6에서 세그먼트 조건 + 동의 필터로 생성.

## 하지 말 것 / 주의

- **즉석 집계(추천 때마다 SQL 직접 run) 금지.** 매번 1~2분 대기 + 비동기 rowCount 0 오판으로 불안정. 사전 적재분만 읽는다.
- rowCount가 0이면 = Automation 미실행 또는 비동기 지연. **"데이터가 SQL 레이어에 없다"는 식으로 오판 금지** — 비동기 지연일 뿐이며, 90초 후 재조회하면 정상 적재됨.
- **GUID는 하드코딩 금지.** SEG_*는 재생성되면 GUID가 바뀐다. `sfmc_get_data_extensions(query_json:{"$search":"SEG_"})`로 그때그때 GUID를 찾는다. `sfmc_get_data_extension`은 GUID(id)로만 조회된다(key 불가).

## 운영 상수 (2026-07-01 갱신)

- Customer_Profile: key `CD_Customer_Profile_DE`, GUID `0e7c0166-836d-f111-a5e1-5cba2c19fe48`, 100,000행(2026-06-30 import), 원천 24필드 sendable. (이전 GUID d64d8979-...는 stale)
- SQL Query 폴더: categoryId = **82567**. Automation 폴더: categoryId = **82571**.
- CP_DIAGNOSIS_AUTOMATION: id `4e4ee6dd-88fa-4931-b34e-cdc831fe6b40`, key `CP_DIAGNOSIS_AUTOMATION`, **PausedSchedule** (스케줄 일시정지 상태), lastRunTime `2026-07-01T07:35:19` — 오늘 수동 실행됨, SEG_* 값 신선.
- SFMC SQL Query/Automation은 비동기 — run 후 90초 대기 후 rowCount 재확인.

## 부트스트랩 이력 (2026-06-30 최초 구축)

이전 Customer_Profile GUID(0e7c0166-...)는 stale — 현재 GUID는 d64d8979-... 임.
SEG_* DE 7개 + SQL Query 7개 + CP_DIAGNOSIS_AUTOMATION 신규 생성 완료.
Automation runAllOnce는 typeId 미지정으로 불가 → sfmc_run_sql_query로 7개 개별 실행.
stepNumber는 0-based(0~6)로 해야 Automation 생성 성공.
SQL Query categoryId는 26296(Query 폴더 루트)이 유효 (이전 메모 82567은 stale).

## 출력 표현 규칙 (사용자 노출)

- "약점/주목" 컬럼·단어 안 씀. **지표·인원·비율·추천 캠페인**만, 비율 높은 순.
- 캠페인 명칭 풀어쓰기: 윈백→"이탈 고객 재구매 유도", 재활성화→"휴면 고객 재활성화", 미전환→"신규 첫구매 유도".

## 2026-07-01 실측값 (모수 100,000 / 구매자 85,059)

repeat_buyer 55,034(64.7%/구매자) · churn 27,047(31.8%/구매자) · dormant 31,488(31.5%/전체) · noconv 14,941(14.9%/전체) · noconsent 19,893(19.9%/전체) · cart 18,149(18.1%/전체).

## SEG_* DE GUID (2026-07-01 라이브 확인)

| DE key | GUID | rowCount(2026-07-01) |
|---|---|---|
| Customer_Profile(CD_Customer_Profile_DE) | 0e7c0166-836d-f111-a5e1-5cba2c19fe48 | 100,000 |
| SEG_buyers_DE | 509a6ca3-9f70-f111-a5e1-5cba2c19fe48 | 85,059 |
| SEG_repeat_buyer_DE | e6996ca3-9f70-f111-a5e1-5cba2c19fe48 | 55,034 |
| SEG_churn_DE | ef5563a9-9f70-f111-a5e1-5cba2c19fe48 | 27,047 |
| SEG_dormant_DE | f95563a9-9f70-f111-a5e1-5cba2c19fe48 | 31,488 |
| SEG_noconv_DE | 075663a9-9f70-f111-a5e1-5cba2c19fe48 | 14,941 |
| SEG_noconsent_DE | 7d5663a9-9f70-f111-a5e1-5cba2c19fe48 | 19,893 |
| SEG_cart_DE | 125663a9-9f70-f111-a5e1-5cba2c19fe48 | 18,149 |

## SQL Query ID (2026-06-30 생성)

| Query name | queryDefinitionId |
|---|---|
| DIAG_buyers | 9f7d497c-ac0b-49a3-8a63-9a86a0005769 |
| DIAG_repeat_buyer | a2882c64-4d9e-4f7f-be54-13e4e88dbb57 |
| DIAG_churn | d77ea94d-9a31-4f70-a3de-1cf7eb4b2875 |
| DIAG_dormant | f35a822f-9a31-4383-b065-0576e1f55fc9 |
| DIAG_noconv | 40d4d723-ac8a-4a69-acc2-c386de0f5b6f |
| DIAG_cart | 7332a1ec-fa00-475a-a810-aba724dbab2e |
| DIAG_noconsent | aa59a1f7-c459-4873-af24-1a897527bbec |
