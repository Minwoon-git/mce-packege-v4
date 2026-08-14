---
name: reference-infra-status
description: SFMC 계정 발송 인프라 구성 현황 (2026-08-10 온보딩 점검 재확인 결과)
metadata:
  type: reference
---

## 계정 정보

- MID 영역: mc82m0sycp8ynx4fqynw-63lx470 (S10 스택 추정), BU 이름(추정, config.json 게이트 값): Salesforce_milvus_edu
- 점검일: 2026-08-10 (같은 날 3차 재점검, "MCE 초기 세팅 점검해줘" 요청 기준) / 이전 점검: 2026-08-07, 2026-08-10 오전·오전2
- 인증 상태: `sf-mce-mcp` 정상 (모든 호출 200 OK, 재시도 불필요)
- 3차 재점검 결과: 값 전부 동일(변동 없음). `sfmc_get_data_extensions` `$search`가 rowCount를 직접 반환함을 확인(별도 rowset 조회 불필요) — SENDLOG/AUDITLOG/IPWARM 전부 rowCount=0 재확인.

## [2026-08-10 재확인] rowCount API 실측치 확보 (customobjects $search + rowset 조회)

- `sfmc_get_data_extension`은 GUID id만 받고 key를 안 받음(400 Id is invalid) → key 조회는 `sfmc_query_data_extension_rows`(rowset count) 또는
  `sfmc_get_data_extensions` `$search`로 대체해야 함. 이번 점검에서 다음 확정:
  - `sendlog_daily`(id 7bad5f12-d190-f111-a5e1-5cba2c196e68) rowset count=0
  - `sendlog_history`(id d2086418-d190-f111-a5e1-5cba2c196e68) rowset count=0
  - `auditlog_activity_v3`(id 953a69e9-d990-f111-a5e1-5cba2c196e68) rowCount=0 (필드 13개)
  - `auditlog_access_v3`(id 13c989f5-d990-f111-a5e1-5cba2c196e68) rowCount=0 (필드 11개)
  - `ipwarm_targets`(id 55571187-df90-f111-a5e1-5cba2c196e68) rowset count=0 (설계상 정상 — Draft 저니 미발행)
- Automation 목록 재확인: 총 **14개** (Ready 6 / Building 1 / PausedSchedule 7) — 오전 점검(13개) 대비 1개 증가(`RECON_Profile 진단 카운트 확장 (Daily)`가 Ready로 잡힘). 핵심 파이프라인(SendLog/AuditLog)은 여전히 PausedSchedule, lastRunTime 변화 없음(둘 다 2026-08-05).

## [2026-08-10] 카테고리 B(기본 세팅 산출물) — 실측, 2026-08-07과 동일 이슈 지속

- **① 발송 결과 적재**: DE `sendlog_daily`/`sendlog_history` 존재, SQL `QRY_SendLog_Daily`/`QRY_SendLog_History` 존재,
  Automation `AUTO_SendLog_Daily`(key `auto_sendlog_daily`) 존재하나 **PausedSchedule** (lastRunTime 2026-08-05T07:27:19, 이후 재실행 없음).
  두 DE `rowset` 실측 count=0 → **⚠️ 점검필요 지속** (5일째 미적재).
- **② 감사로그 적재**: DE `auditlog_activity_v3`/`auditlog_access_v3` 존재, Automation `AUTO_AuditLog_Daily`(key `auto_auditlog_daily`)
  존재하나 **PausedSchedule** (lastRunTime 2026-08-05T08:34:12, 이후 재실행 없음). 두 DE rowset 실측 count=0 → **⚠️ 점검필요 지속**.
- **③ IP 워밍 저니**: DE `ipwarm_targets`(rowset count=0, Draft 설계상 정상) + Journey `IPWarming_Ramp`(id `f739881f-7eec-4f33-bc0e-88e4041cdc33`,
  key `IPWarming_Ramp-20260805`, status=**Draft**, lastPublishedDate 없음) → **✅ 정상**(발행 안 함이 설계 의도).
- **중복 Automation 4종 여전히 존재** (모두 PausedSchedule, 정리 안 됨):
  `ATM_Email_Tracking_Daily`(id 875147af...), `ATM_MCE_Send_Collect`(id a910bd02...), `MCE_SendResults_Collect`(id a51e1d54...),
  `AUTO_SendLog_Daily`(id 182dc32a...) — 전부 발송결과 적재 목적 중복. 3일 경과에도 미정리 → 계속 플래그.

## Sender Profile (3개, 2026-08-10 재확인, 변동 없음)

| 이름 | FromAddress | CustomerKey |
|---|---|---|
| MILVUS.EDU | mary@milvus.co.kr | 2489 |
| Default | salesforce_edu@milvus.co.kr | Default |
| salesforce_edu@milvus.co.kr | salesforce_edu@milvus.co.kr | 2441 |

## Send Classification (2026-08-10 재확인, 변동 없음)

| 이름 | 유형 | DeliveryProfile |
|---|---|---|
| Default Commercial | Marketing | Default (연결됨) |
| Default Transactional | Operational | Default (연결됨) |

## Content Builder / DE 폴더 (2026-08-10)

- Content Builder 카테고리 8개 (root+EDU_NGO/EDU_0306/Education/ariel/tableau_edu/Gordon_HW/MCE-Package) → 응답 정상, 활성화 추정.
- DE 폴더: `MCE_Basic_Setup`(id 95720, key `1624267b-...`) 등 다수 폴더 확인 → Contact Builder 사용 가능 추정.

## Automation (2026-08-10, 13개 — 2026-08-07과 동일 구성)

- Ready 5 / Building 1 / PausedSchedule 7 (변동 없음).
- 발송결과 적재 목적 중복 4종 전부 PausedSchedule, 실제 적재 진행 중인 automation 없음.

## Journey

- `IPWarming_Ramp` 개별 확인: Draft, 변동 없음. (전체 목록 재조회는 응답 크기상 생략 — 이전과 동일 판단)

## 수동 확인 항목 (미확인, 변동 없음)

- 도메인 인증(SAP/SPF·DKIM): 미확인
- 전용 IP / IP 워밍: 미확인
- CAN-SPAM 물리 주소: 미확인
- 수신거부/프로필 센터: 미확인
- Reply Mail Management: 미확인
- Link/Tracking 도메인 브랜딩: 미확인

## 결론 (2026-08-10)

- 2026-08-07 대비 **변동 없음** — B1/B2 미적재·Automation Paused·중복 4종 문제가 3일째 그대로 지속.
  다음 점검 시에도 동일하면 "Automation 스케줄 활성화(콘솔 수동, trigger API 404 확인됨) 안내"를 더 강하게 반복 플래그할 것.
