---
name: reference-diagnosis-counts
description: STEP1 진단 = 사전 집계 SEG_* 카운트 DE의 rowCount를 읽음(즉석 집계 X). 발송 DE는 선택 후 생성. 2026-08-10 확장 세그먼트 7종 추가.
metadata:
  type: reference
---

## STEP 1 진단 = 사전 집계 카운트 읽기 (대기 없음)

Automation이 세그먼트별 `SEG_*` 카운트 DE에 인원을 미리 적재한다. 추천 시엔 **rowCount만 읽어** 즉시 진단.

방법:
1. `sfmc_get_data_extensions(query_json:{"$search":"SEG_"})`로 GUID 조회 → `sfmc_get_data_extension`(GUID)로 rowCount 읽기.
2. 비율 = 세그먼트/분모(전체 `RECON_Profile` 또는 `SEG_buyers_DE`) → **비율 높은 순** 추천.
3. 발송(진입) DE는 진단 단계에서 안 만든다. 캠페인 선택 후 1-6에서 세그먼트 조건 + 동의 필터로 생성.

## 하지 말 것 / 주의

- **GUID 하드코딩 금지.** 재생성되면 바뀐다. `$search`로 그때그때 조회. `sfmc_get_data_extension`은 GUID(id)로만 조회(key 불가).
- rowCount 0이면 = 비동기 지연 또는 실제 0명. **"데이터가 SQL 레이어에 없다"고 오판 금지.** 100~120초 후 재조회.
- ~~`SEG_noconsent_DE` name이 "Random Split_Test"~~ → **2026-08-13 `SEG_noconsent`로 원복 + 비-sendable 해제 완료**. 이제 `$search:"SEG_"`로 정상 검색됨. (개명이 원인이었던 Automation 쿼리 실패도 해소 — error-log.md 참조)
- SQL Query 생성 시 **categoryId = 82567** (Query 폴더). 26296은 400 오류 — 이전 메모가 틀렸음.
- `sfmc_create_automation`/`update_automation`에 `schedule`을 넣어도 **스케줄이 붙지 않는다**(startSource typeId 0, scheduleStatus none). 생성은 되지만 스케줄은 UI에서 걸어야 함 → 정직 보고 필요.

## 운영 상수 (2026-08-10 라이브 재확인)

- 분석 소스: `RECON_Profile`(key `RECON_Profile_DE`), id `dd4657b0-3176-f111-a5e1-5cba2c19fe48`, rowCount 100,000, **fieldCount 22**(확장 컬럼 승계 완료 — grade·region·signup_date·birthday·points_balance·points_expire_date·cart_updated_date·coupon_expire_date·name·email·cellphone 모두 존재. 이전 메모의 "미승계"는 해소됨).
- SQL Query 폴더 categoryId **82567** / Automation 폴더 **82571** / SEG_* DE 폴더 **96525**(`mce-package > 02_진단(프로파일·SEG)` — 2026-08-13 폴더 재편: RAW=96524·진단=96525·진입=96526·운영로그=96527. 93897은 이제 상위 폴더).
- `CP_DIAGNOSIS_AUTOMATION`: id `4e4ee6dd-88fa-4931-b34e-cdc831fe6b40`, **PausedSchedule**(계속 멈춤 상태) → 매번 `sfmc_run_automation`으로 재집계 필요. runallonce는 정상 동작(201).
- `CP_DIAGNOSIS_AUTOMATION_EXT`: id `6a86e05b-db1f-4547-a867-8e3640afac2e` (2026-08-10 신규, 확장 7종). **스케줄 미부착(Ready, typeId 0 = unspecified)**.
  - ⚠️ **EXT는 `sfmc_run_automation`(runallonce) 불가** — 400 `"The selected automation type: unspecified is not valid to be used in run once."` (2026-08-13 실측). 재집계하려면 개별 `sfmc_run_sql_query`(DIAG_* 쿼리 id)로 돌리거나, UI에서 스케줄을 붙여 typeId를 scheduled로 바꿔야 한다.

## 신선도 확인법 (재집계 전에 먼저 이걸로 판정 — 불필요한 실행 방지)

`sfmc_get_data_extension(GUID)` 응답의 **`queryActivity.instanceDate`** = 그 SEG_ DE를 마지막으로 채운 쿼리 실행 시각. Automation `lastRunTime`보다 정확하고 세그먼트별로 개별 확인된다. 날짜 무관 지표(1회성·미전환·장바구니·동의·VIP·생일월)는 instanceDate가 오래돼도 값이 안 변하므로 재집계 불필요.

## ⚠️ 데이터 프리즈 — 날짜 상대 지표 왜곡 (2026-08-10 발견, 매우 중요)

`RECON_Profile` 마스터가 **2026-07-02/03 이후 재적재/재빌드 안 됨**(modifiedDate 2026-07-02, BUILD_RECON_Profile 마지막 instance 2026-07-03). 원천 RAW_*도 그때 기준. `GETDATE()`만 흐르므로 날짜 기반 지표가 계속 왜곡된다:

| 지표 | 2026-07-01 | 2026-07-21 | 2026-07-23 | 2026-08-10 | 2026-08-13 |
|---|---|---|---|---|---|
| 이탈위험(주문90일+) | 27,047 | 27,729 | 41,416 | 52,474 | **54,454** |
| 휴면(로그인90일+) | 31,488 | 32,255 | 48,266 | 61,223 | **63,570** |

드리프트 ≈ 하루 +660(이탈) / +780(휴면). 프리즈 시점(2026-07-03) 기준 참값 ≈ 이탈 27,000 / 휴면 31,500.

→ 휴면·이탈위험은 **과대**, 신규회원·쿠폰만료는 **0으로 과소**. 진단 보고 시 반드시 이 한계를 밝히고 원천 재적재를 권고한다. 날짜 무관 지표(1회성·미전환·장바구니·동의·VIP·생일)는 안정적.

## ⭐ 2026-08-10 실측값 (RECON_Profile 기준, 모수 100,000 / 구매자 85,059)

| DE key | GUID | rowCount | 비율 |
|---|---|---|---|
| RECON_Profile_DE (모수) | dd4657b0-3176-f111-a5e1-5cba2c19fe48 | 100,000 | - |
| SEG_buyers_DE | 509a6ca3-9f70-f111-a5e1-5cba2c19fe48 | 85,059 | 85.1%/전체 |
| SEG_email_ok_DE ⭐신규 | 5403aab6-7f94-f111-a5e1-5cba2c196e68 | 69,741 | 69.7%/전체 |
| SEG_repeat_buyer_DE (1회성) | e6996ca3-9f70-f111-a5e1-5cba2c19fe48 | 55,034 | 64.7%/구매자 |
| SEG_dormant_DE | f95563a9-9f70-f111-a5e1-5cba2c19fe48 | 61,223 | 61.2%/전체 |
| SEG_churn_DE | ef5563a9-9f70-f111-a5e1-5cba2c19fe48 | 52,474 | 61.7%/구매자 |
| SEG_sms_ok_DE ⭐신규 | 5503aab6-7f94-f111-a5e1-5cba2c196e68 | 52,162 | 52.2%/전체 |
| SEG_points_exp_DE ⭐신규 | 96d5d0bc-7f94-f111-a5e1-5cba2c196e68 | 19,947 | 19.9%/전체 |
| SEG_noconsent_DE | 7d5663a9-9f70-f111-a5e1-5cba2c19fe48 | 19,893 | 19.9%/전체 |
| SEG_cart_DE | 125663a9-9f70-f111-a5e1-5cba2c19fe48 | 18,149 | 18.1%/전체 |
| SEG_noconv_DE | 075663a9-9f70-f111-a5e1-5cba2c19fe48 | 14,941 | 14.9%/전체 |
| SEG_birthday_month_DE ⭐신규 | 87d5d0bc-7f94-f111-a5e1-5cba2c196e68 | 8,538 | 8.5%/전체 |
| SEG_vip_DE ⭐신규 | 1ad5d0bc-7f94-f111-a5e1-5cba2c196e68 | 8,038 | 8.0%/전체 |
| SEG_newmember_DE ⭐신규 | 15d5d0bc-7f94-f111-a5e1-5cba2c196e68 | 0 | 0% (프리즈) |
| SEG_coupon_exp_DE ⭐신규 | 92d5d0bc-7f94-f111-a5e1-5cba2c196e68 | 0 | 0% (만료일 과거) |

동의 교차 검증(정합): 미동의 19,893 + 도달가능 80,107 = 100,000. email-only 27,945 / 둘다 41,796 / sms-only 10,366.

프로브로 확인한 "0명의 원인": `signup_date` 100,000명 채워짐(→신규 0명은 진짜) · `coupon_expire_date` 40,092명 보유하나 **미래 만료(>=오늘) 0명**(→쿠폰 만료 캠페인은 데이터 프리즈 탓, 컬럼 문제 아님) · `grade` 전원 채워짐(VIP 8,038).

## 신규 SQL Query ID (2026-08-10 생성, categoryId 82567)

DIAG_email_ok `31d0dbcc-973e-4b40-b268-d6e06779dc59` · DIAG_sms_ok `012483e3-0e33-4df3-8c48-5d6b20279f02` · DIAG_newmember `54ea4174-f806-48ef-b402-aca977e93ac8` · DIAG_vip `5af8674c-bcb1-40ba-acc5-8addb25565ac` · DIAG_birthday_month `85956c61-e9d2-4383-a47a-baf0385d0320` · DIAG_coupon_exp `9978f6d8-ab8f-490a-afcb-24394e29c93d` · DIAG_points_exp `1440099c-4e50-45ff-aaa3-d97593044942`

## 프로브 (값 분포 확인용)

~~`SEG_probe`/`SEG_probe2` + `DIAG_probe`/`DIAG_probe2` 재사용~~ → **2026-08-13 정리 삭제됨** (일회성 임시물). 값 분포 확인이 필요하면 임시 카운트 DE+쿼리를 새로 만들어 쓰고 **확인 후 즉시 삭제**한다.

## 출력 표현 규칙 (사용자 노출)

- "약점/주목" 컬럼·단어 안 씀. **지표·인원·비율·추천 캠페인**만, 비율 높은 순.
- 캠페인 명칭 풀어쓰기: 윈백→"이탈 고객 재구매 유도", 재활성화→"휴면 고객 재활성화", 미전환→"신규 첫구매 유도".
