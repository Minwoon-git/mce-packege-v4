---
name: reference-infra-status
description: SFMC 계정 발송 인프라 구성 현황 (2026-07-10 기준 점검 결과)
metadata:
  type: reference
---

## 계정 정보

- MID 영역: mc82m0sycp8ynx4fqynw-63lx470 (S10 스택 추정)
- 점검일: 2026-07-10 (이전 점검: 2026-06-21)

## Sender Profile (3개, 변동 없음)

| 이름 | FromAddress | CustomerKey |
|---|---|---|
| MILVUS.EDU | mary@milvus.co.kr | 2489 |
| Default | salesforce_edu@milvus.co.kr | Default |
| salesforce_edu@milvus.co.kr | salesforce_edu@milvus.co.kr | 2441 |

## Send Classification (변동 없음)

| 이름 | 유형 | DeliveryProfile |
|---|---|---|
| Default Commercial | Marketing | Default (연결됨) |
| Default Transactional | Operational | Default (연결됨) |

## Content Builder 카테고리

- 7개 카테고리 확인 (root "Content Builder" + EDU_NGO/EDU_0306/Education/ariel/tableau_edu/Gordon_HW) → API 응답 정상, Content Builder 사용 가능(추정)

## Data Extension 폴더

- Data Extensions 루트 하위 다수 폴더 확인(sales_edu_1~25, 프리미엄 멤버십 업셀링/휴면 전환 방지 하위폴더, test/mce-package, DataCloud, EDU/프리미엄 멤버십 전환 등) → Contact Builder/데이터 모델 사용 가능(추정)

## Automation (8개, 이전 7개 대비 1개 증가)

| 이름 | 상태 |
|---|---|
| RECON_Profile 진단 카운트 (Daily) | **PausedSchedule** (신규 추가, key: CP_DIAGNOSIS_AUTOMATION) |
| 구매이력_리마인드 | Ready |
| 성향서베이_동물가중치 | Ready |
| 신규 회원 목록 | Building (테스트용) |
| 이용실적기반_FIN | Ready |
| 행동기반_추천_캠페인 | Ready |
| 행동기반_추천_캠페인_mastercontact | Ready |
| 휴면 전환 방지 및 컴백 유도 캠페인 | PausedSchedule |

- Ready: 5, Building: 1, PausedSchedule: 2 (신규로 RECON_Profile 진단 카운트 자동화가 추가되었으나 스케줄 일시정지 상태 — SEG_* 카운트 DE 갱신에 영향 가능)

## Journey (총 77개 중 최신 50개 확인, 이전 63개 대비 14개 증가)

- Draft: 23, Published: 24, Stopped: 3 (활발히 신규 캠페인 생성 중)

## 수동 확인 항목 (미확인, 변동 없음)

- 도메인 인증(SAP/SPF·DKIM): 미확인
- 전용 IP / IP 워밍: 미확인
- CAN-SPAM 물리 주소: 미확인
- 수신거부/프로필 센터: 미확인
- Reply Mail Management: 미확인
- Link/Tracking 도메인 브랜딩: 미확인
