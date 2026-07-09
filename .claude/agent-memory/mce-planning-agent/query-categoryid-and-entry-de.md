---
name: query-categoryid-and-entry-de
description: sfmc_create_sql_query categoryId gotcha + RECON_Profile은 email/name 컬럼이 없어 RAW_Customers와 JOIN 필요
metadata:
  type: reference
---

**Automation SQL Query 활동(`sfmc_create_sql_query`) 생성 시 `categoryId`는 DE 폴더 categoryId(예: 93375, 93897)를 쓰면 400 에러**
(`"The value specified for the following field is not valid: 'categoryId'"`)가 난다.
Automation/쿼리 활동의 기본 폴더는 `82571`(Automation Studio 루트, 계정 내 기존 Automation들의 categoryId로 확인됨) — 이 값을 쓰면 201 성공.

**Why:** DE와 Query Activity는 서로 다른 폴더 트리(Content Builder/Contact Builder vs Automation Studio)에 속해 categoryId 네임스페이스가 다르다.

**How to apply:** 진입 DE용 SQL Query Activity를 만들 때 `categoryId`를 생략하거나 `82571`을 명시한다. DE 자체의 categoryId(예: 93375 = 장바구니 계열 폴더, [`reference/analysis-guide/ecommerce-default.md`](../../skills/mce-campaign/reference/analysis-guide/ecommerce-default.md) §5)와 혼동하지 말 것.

---

**`RECON_Profile`(진단 소스, 11개 파생 컬럼)에는 `email`·`name`(고객 성명) 컬럼이 없다** — email_consent(Boolean)만 있고 실제 이메일 주소는 없음.
발송용 진입 DE(EmailAddress 필요)를 만들 때는 `RAW_Customers_DE`(member_id로 조인, email/name/cellphone 보유)와 INNER JOIN해서 가져와야 한다.

**Why:** RECON_Profile은 "진단 집계용 파생 프로파일"이고 개인식별 연락처 정보는 원천 테이블에만 있다(§1 스키마 설계).

**How to apply:** 이메일/알림톡 발송 진입 DE 생성 SQL은 `FROM RECON_Profile r INNER JOIN RAW_Customers c ON r.member_id = c.member_id`로 조인해 `c.email AS EmailAddress`, `c.name AS FirstName`을 가져오고, 분기용 파생값(cart_total_amount 등)은 `r.*`에서 가져온다.
