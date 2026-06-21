---
name: reference-infra-status
description: SFMC 계정 발송 인프라 구성 현황 (2026-06-21 기준 점검 결과)
metadata:
  type: reference
---

## 계정 정보

- MID 영역: mc82m0sycp8ynx4fqynw-63lx470 (S10 스택 추정)
- 점검일: 2026-06-21

## Sender Profile (3개)

| 이름 | FromAddress | CustomerKey |
|---|---|---|
| MILVUS.EDU | mary@milvus.co.kr | 2489 |
| Default | salesforce_edu@milvus.co.kr | Default |
| salesforce_edu@milvus.co.kr | salesforce_edu@milvus.co.kr | 2441 |

## Send Classification

| 이름 | 유형 |
|---|---|
| Default Commercial | Marketing |
| Default Transactional | Operational |

## 구독 리스트

- All Subscribers (ID: 5523) 1개만 존재. 커스텀 목적별 리스트 없음.

## Data Extension (주요)

- **Master_Customer_Living** (categoryId: 88641) — rowCount: 100, isSendable: true, 필드 6개
- **Membership_1~25** — 각 rowCount 1~2, isSendable: true (테스트/학습용으로 보임)
- "customer", "contact", "entry", "cafe24", "구매" 검색 결과 없음 — 실 운영 진입 DE 미확인

## Automation (7개)

| 이름 | 상태 |
|---|---|
| 구매이력_리마인드 | Ready |
| 성향서베이_동물가중치 | Ready |
| 신규 회원 목록 | Building |
| 이용실적기반_FIN | Ready |
| 행동기반_추천_캠페인 | Ready |
| 행동기반_추천_캠페인_mastercontact | Ready |
| 휴면 전환 방지 및 컴백 유도 캠페인 | PausedSchedule |

- Ready: 5, Building: 1, PausedSchedule: 1

## Journey (총 63개 중 최신 50개 확인)

- Draft: 24, Published: 23, Stopped: 3
- 최근 Draft 저니 다수 생성 중 (CP038~CP042 시리즈 등)
- Published 저니 존재 → 실제 발송 운영 중

## 수동 확인 항목 (미확인)

- 도메인 인증(SAP/SPF·DKIM): 미확인
- 전용 IP / IP 워밍: 미확인
- CAN-SPAM 물리 주소: 미확인
- 수신거부/프로필 센터: 미확인
