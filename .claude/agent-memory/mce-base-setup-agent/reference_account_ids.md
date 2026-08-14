---
name: reference-account-ids
description: 이 SFMC 계정(mc82m0sycp8ynx4fqynw-63lx470)의 기본 세팅에 필요한 고정 ID/Key 모음 - 폴더, 이메일 발송 관련 org-specific GUID
metadata:
  type: reference
---

## Data Extension 폴더
- `93897` = "mce-package" (Data Extensions > test > mce-package) — **2026-08-13 하위 4폴더로 재편**: `01_RAW(원천)` **96524** / `02_진단(프로파일·SEG)` **96525** / `03_캠페인진입(ENTRY)` **96526** / `04_운영로그(기본세팅)` **96527**.
- ①②(SENDLOG_*)·③(IPWARM_Targets)·AUDITLOG_* = **96527**(04_운영로그)로 이동됨. 신규 기본세팅 DE도 96527에 생성할 것.
- `95720` = "MCE_Basic_Setup" (Data Extensions 루트 직속) — 존재하지만 실제 DE들은 93897에 생성됨. 혼동 주의.

## Content Builder 폴더 — ⚠️ SSOT(email-standard.md)와 계정 실제 상태 불일치
- `mce-campaign/reference/email-standard.md`는 "MCE-Package (Content Builder categoryId 93427)"을 SSOT로 명시하지만,
  이 계정에는 **해당 categoryId/폴더가 존재하지 않았다** (2026-08-05 `sfmc_get_content_categories` 확인 — Content Builder 루트 id `82578` 하위에 EDU_NGO/EDU_0306/Education/Gordon_HW만 존재, MCE-Package 없음).
- ③ IP 워밍 이메일(`EML_IPWarming_Base`) 생성을 위해 Content Builder 루트(`82578`) 하위에 새 폴더 **"MCE-Package" (categoryId `96253`)** 를 생성해 사용함.
- **후속 작업 시**: 이메일 콘텐츠 생성 전에 먼저 `sfmc_get_content_categories`로 `96253`이 여전히 유효한지 확인. `93427`을 그대로 쓰면 404/validation error 남.

## 이메일 발송 고정값 (EMAILV2 액티비티 필수 4종 ID)
기존 저니(예: `1eb58c79-...` 등 여러 개)에서 공통으로 확인된 값 (2026-08-05):
- `sendClassificationId`: `012f8a15-ecd4-f011-a5da-5cba2c19fe48` (Default Transactional / Operational)
- `senderProfileId`: `0ca1f078-5712-f111-a5dc-5cba2c19f760` (SenderProfile "MILVUS.EDU", FromAddress `mary@milvus.co.kr`)
- `deliveryProfileId`: `ff2e8a15-ecd4-f011-a5da-5cba2c19fe48` (Default)
- `publicationListId`: `1237`

이 4개 값은 신규 EMAILV2 액티비티(캠페인/인프라성 저니 불문) 생성 시 그대로 재사용 가능. `sfmc_get_send_classifications`/`sfmc_get_sender_profiles`(SOAP)로 재확인 가능하나, 매칭되는 값이 위와 같았음.

## IP 워밍 저니 생성 결과 (2026-08-05)
- DE `IPWARM_Targets` (key `ipwarm_targets`, GUID `55571187-df90-f111-a5e1-5cba2c196e68`, categoryId 96527 — 2026-08-13 04_운영로그로 이동)
- Email `EML_IPWarming_Base` (Content Builder id 181352, legacyId **67366** — Journey EMAILV2의 emailId로 사용)
- Event Definition `IPWarming_Ramp-Entry-20260805` (id `535cfc0d-97ce-49aa-9e67-607d1cfabbda`, type EmailAudience, schedule 없이 생성 = On Activation 모드, automationId `c5d991b4-1d74-4370-83bb-89f0c574bf3f`는 미사용/미PATCH)
- Journey `IPWarming_Ramp` (id `f739881f-7eec-4f33-bc0e-88e4041cdc33`, key `IPWarming_Ramp-20260805`, status Draft, entryMode OnceAndDone) — Decision Split(WarmingStage 6분기) + EMAILV2 x6(D1/D2-3/W1/W2/W3/W4), 발행 안 함.
