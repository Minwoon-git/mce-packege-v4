---
name: onboarding-kit-template
description: 고객사 데이터정보 템플릿(xlsx)의 '2.핵심정의확인' 시트가 STEP 0 HITL 6항목을 사전 답변하므로, Phase A는 이 시트를 먼저 읽어야 한다
metadata:
  type: reference
---

신규 고객사가 `MCE_데이터정보_템플릿_커머스_*.xlsx`를 제출하면, 그 안의 **`2.핵심정의확인` 시트가 schema-mapping.md 4절 HITL 5~6항목을 이미 답변**하고 있다. (핵심 ID / 총구매액 산식 / 취소·환불 제외 / 날짜 기준 컬럼 / 동의값 해석 / 휴면·이탈 기준일수)

**How to apply:** Phase A에서 xlsx를 파싱할 때 `3.스키마` 시트만 보지 말고 **`2.핵심정의확인` 시트를 반드시 먼저 읽는다.** 답변이 채워져 있으면 HITL 목록을 열린 질문이 아니라 **"고객 기재 답변 + 권장안 → 승인/수정" 형태**로 축약해 상위에 반환한다. `1.데이터파일` 시트의 '비고' 열에는 스냅샷 주기(예: 매일 05시 전체 스냅샷)가 적혀 있어 Phase B의 Import Update Type(Overwrite/Upsert) 결정 근거가 된다.

템플릿·작성예시 위치: `docs/onboarding-kit/` (예시 = `03_작성예시_어반몰/`).
관련: [[urbanmall-schema]]
