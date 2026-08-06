# Memory Index

- [주요 DE 목록 및 필드](reference_key_des.md) — WTK_customer/J1_1_CreatedCustomers/3M_Join_Date_No_Order 등 신규회원·캠페인 핵심 DE 필드 및 용도 정리
- [Customer_Profile DE 현황](reference_customer_profile_fields.md) — 원천 사실값 구조 재구성(2026-06-22). key=CD_Customer_Profile_DE, GUID=0e7c0166-..., 필드23개(파생 컬럼 제거), sendable, rowCount=10,000(2026-06-25), upsert pk=SubscriberKey.
- [SEG_* 사전집계 진단 방법](reference_seg_de_guids.md) — 활성소스=RECON_Profile(2026-07-02~). SEG_* 7개 rowCount만 읽음(재생성 금지). GUID는 $search로 조회. 2026-07-21 실측 비율 포함.
