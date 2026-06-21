---
name: no-narration-no-autopublish
description: Journey 작업 시 진행과정 설명 생략 + 발행은 명시 지시 있을 때만
metadata:
  type: feedback
---

Journey 생성/작업 중에는 (1) 진행 과정을 단계별로 설명하지 말 것, (2) 정의서에 발행 지시(auto_publish=TRUE 등)가 없거나 사용자가 명시적으로 "발행해줘"라고 하지 않으면 절대 `sfmc_publish_journey`를 호출하지 말 것 — Draft 상태로 두고 종료한다.

**Why:** 사용자가 두 가지 모두 반복적으로 강하게 지적함. 진행 설명은 노이즈로 느끼고, 임의 발행은 운영 영향이 있어 명시 승인이 필요하다.

**How to apply:** 작업은 조용히 실행하고 STEP 3 결과 요약만 보고한다. 발행 여부가 불명확하면 발행하지 말고 "발행하려면 말씀해 주세요"로 안내한다. [[no-narration-no-autopublish]]
