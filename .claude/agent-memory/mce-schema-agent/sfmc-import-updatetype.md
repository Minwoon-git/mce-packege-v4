---
name: sfmc-import-updatetype
description: SFMC /automation/v1/imports의 updateTypeId 실측 매핑(0/1/2만 허용, Overwrite 불가) 및 DE 이름 유일성 제약
metadata:
  type: reference
---

**Import Definition `updateTypeId` (REST `/automation/v1/imports`) — 2026-08-13 실측 검증**

| 값 | SOAP `UpdateType` 라벨 | UI 표기 |
|---|---|---|
| 0 | `AddAndUpdate` | Add and Update |
| 1 | `AddAndDoNotUpdate` | Add Only |
| 2 | `UpdateButDoNotAdd` | Update Only |
| 3 | ❌ **400 Bad Request** | — |

- **`Overwrite`는 REST로 설정할 수 없다.** POST·PATCH 모두 `updateTypeId: 3`을 `"The value specified for the following field is not valid: 'UpdateTypeId'."`로 거부.
- SOAP `Update`(ImportDefinition, `UpdateType="Overwrite"`)도 실패 — 오류 **43060 `FieldMaps was not specified`**. 전체 FieldMaps 배열 재전송을 요구하고, 일반 soap_update 도구는 flat map만 받아 표현 불가.
- **검증 방법**: REST GET은 내가 보낸 숫자를 그대로 되돌려주므로 라벨 확인이 안 된다. `sfmc_soap_retrieve('ImportDefinition', ['CustomerKey','UpdateType'])`로 **문자열 라벨을 반드시 재확인**할 것.
- **우회안**: ① UI에서 Data Action 수동 변경 ② Import 앞에 대상 DE를 비우는 SQL Query(Overwrite, 0행 SELECT) 스텝 추가.
- 부수 관찰: REST GET 응답의 `fileSpec`이 `""`로 보여도 실제 값은 살아 있다(SOAP `FileSpec`으로 확인). `encodingName`은 요청에 없어도 `utf-8`로 자동 설정된다.

**DE 이름/키 유일성** — Data Extension의 `name`과 `key`는 **BU 전체에서 유일**해야 한다. 표준 이름(`RAW_Customers_DE`, `RECON_Profile_DE` 등)이 선점돼 있으면 신규 고객사는 `<고객사>_` 접두어를 붙이고 **가이드 MD에 실제 키를 기록**한다(표준 *컬럼명*은 유지 → 하류 계약 유지).

**Automation 무스케줄 생성** — `startSource: {typeId: 0}`(unspecified)로 POST하면 상태 `Ready`·`scheduleStatus: none`으로 만들어져 자동 실행되지 않는다. 데이터 적재 전 파이프라인을 미리 구성할 때 쓴다. Import File 액티비티 `objectTypeId` = **43**. Automation 루트 폴더 categoryId는 `sfmc_get_automations` 응답에서 확인(`/automation/v1/folders`는 `$filter` 필수이고 `parentId` 필터를 거부).

관련: [[urbanmall-schema]]
