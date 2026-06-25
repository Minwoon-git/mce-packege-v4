/**
 * Customer_Profile 진단 테스트용 합성 데이터 생성기
 * - 10,000행, DE(CD_Customer_Profile_DE) 24필드 스키마와 동일한 컬럼/순서
 * - 의도적으로 "약점"을 심어 3차원 진단 시연이 되도록 분포 설계
 * - 기준일 고정(2026-06-25)으로 결정적(deterministic) 생성 → 언제 돌려도 같은 결과
 *
 * 심어둔 목표 비율 (de-and-folders.md 진단 룰셋 기준):
 *   1회성 구매자(order_count=1)        64%  > 60%  → 약점 (2차 구매 유도)
 *   첫구매 미전환(order_count=0)        21%  > 20%  → 약점 (웰컴 온보딩)
 *   이탈률(구매자 중 마지막주문 90일+) ~32%  > 25%  → 약점 (윈백)
 *   휴면율(로그인 90일+)               35%  > 30%  → 약점 (재활성화)
 *   장바구니 이탈                      18%  > 15%  → 약점 (장바구니 리마인더)
 *   수신동의율(email OR sms)           45%  < 50%  → 약점 (동의 확보)
 */

const fs = require('fs');
const path = require('path');

const N = 10000;
const TODAY = new Date(Date.UTC(2026, 5, 25)); // 2026-06-25

function daysAgo(n) {
  const d = new Date(TODAY.getTime() - n * 86400000);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function daysAhead(n) {
  const d = new Date(TODAY.getTime() + n * 86400000);
  return d.toISOString().slice(0, 10);
}
// 결정적 의사난수 (인덱스 기반) — 다른 속성의 사실감을 위해
function prand(i, salt) {
  let x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x); // 0~1
}
function pick(i, salt, arr) {
  return arr[Math.floor(prand(i, salt) * arr.length)];
}

const grades = ['일반', '일반', '일반', '일반', '일반', '일반', '일반', '골드', '골드', 'VIP']; // 70/20/10
const memberTypes = ['개인', '개인', '개인', '멤버십'];
const regions = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '강원', '제주'];
const categories = ['패션', '뷰티', '디지털', '리빙', '식품', '스포츠', '유아', '도서'];

const header = [
  'member_id', 'name', 'email', 'cellphone', 'grade', 'member_type', 'region',
  'preferred_category', 'email_consent', 'sms_consent', 'signup_date',
  'last_login_date', 'last_order_date', 'birthday', 'coupon_expire_date',
  'points_expire_date', 'cart_updated_date', 'order_count', 'total_spent',
  'points_balance', 'cart_total_amount', 'unused_coupon_count',
  'has_abandoned_cart', 'SubscriberKey'
];

const lines = [header.join(',')];

// 검증용 카운터
let c = { oc0: 0, oc1: 0, oc2: 0, churn: 0, buyers: 0, dormant: 0, cart: 0, consent: 0, bdayThisMonth: 0 };

for (let i = 0; i < N; i++) {
  const id = 'SYN' + (100001 + i);

  // ---- order_count 분포 (결정적): 0=2100, 1=6400, 2+=1500
  let order_count;
  if (i < 2100) order_count = 0;
  else if (i < 8500) order_count = 1;
  else order_count = 2 + Math.floor(prand(i, 7) * 4); // 2~5

  const isBuyer = order_count >= 1;
  if (order_count === 0) c.oc0++; else if (order_count === 1) c.oc1++; else c.oc2++;
  if (isBuyer) c.buyers++;

  // ---- last_order_date: 구매자만. 구매자 인덱스 기준 앞 2528명을 이탈(90일+)로
  let last_order_date = '';
  if (isBuyer) {
    const bIdx = i - 2100; // 구매자 시작 인덱스
    if (bIdx < 2528) {
      last_order_date = daysAgo(90 + Math.floor(prand(i, 11) * 270)); // 90~360일 전 (이탈)
      c.churn++;
    } else {
      last_order_date = daysAgo(1 + Math.floor(prand(i, 11) * 88)); // 1~88일 전 (활성)
    }
  }

  // ---- 휴면율: 35% (i%20 < 7)
  let last_login_date;
  if (i % 20 < 7) {
    last_login_date = daysAgo(90 + Math.floor(prand(i, 13) * 310)); // 90~400일 전 (휴면)
    c.dormant++;
  } else {
    last_login_date = daysAgo(Math.floor(prand(i, 13) * 89)); // 0~88일 전
  }

  // ---- 장바구니 이탈: 18% (i%50 < 9)
  let has_abandoned_cart = 'False';
  let cart_total_amount = '0.00';
  let cart_updated_date = '';
  if (i % 50 < 9) {
    has_abandoned_cart = 'True';
    cart_total_amount = (10000 + Math.floor(prand(i, 17) * 290000)).toFixed(2);
    cart_updated_date = daysAgo(1 + Math.floor(prand(i, 19) * 20));
    c.cart++;
  }

  // ---- 수신동의: 45% (i%20 < 9). 동의자는 email_consent=True, 절반은 sms도 True
  let email_consent = 'False', sms_consent = 'False';
  if (i % 20 < 9) {
    email_consent = 'True';
    sms_consent = (prand(i, 23) < 0.5) ? 'True' : 'False';
    c.consent++;
  }

  // ---- signup_date: 0~1000일 전 (일부 신규)
  const signup_date = daysAgo(Math.floor(prand(i, 29) * 1000));

  // ---- birthday: 8% 이번달(6월), 나머지 랜덤. 연도 1975~2005
  const byear = 1975 + Math.floor(prand(i, 31) * 31);
  let bmonth, bday;
  if (i % 25 < 2) { bmonth = 6; bday = 1 + Math.floor(prand(i, 37) * 28); c.bdayThisMonth++; }
  else { bmonth = 1 + Math.floor(prand(i, 37) * 12); bday = 1 + Math.floor(prand(i, 41) * 28); }
  const birthday = `${byear}-${String(bmonth).padStart(2, '0')}-${String(bday).padStart(2, '0')}`;

  // ---- 쿠폰/포인트: 일부 7일내 만료
  const unused_coupon_count = Math.floor(prand(i, 43) * 4); // 0~3
  let coupon_expire_date = '';
  if (unused_coupon_count > 0) {
    coupon_expire_date = (i % 30 < 3) ? daysAhead(1 + Math.floor(prand(i, 47) * 6)) // 7일내
                                      : daysAhead(10 + Math.floor(prand(i, 47) * 120));
  }
  const points_balance = Math.floor(prand(i, 53) * 50000);
  let points_expire_date = '';
  if (points_balance > 0) {
    points_expire_date = (i % 30 < 3) ? daysAhead(1 + Math.floor(prand(i, 59) * 6))
                                      : daysAhead(20 + Math.floor(prand(i, 59) * 200));
  }

  // ---- total_spent: 구매수 기반
  let total_spent;
  if (order_count === 0) total_spent = '0.00';
  else if (order_count === 1) total_spent = (10000 + Math.floor(prand(i, 61) * 140000)).toFixed(2);
  else total_spent = (100000 + Math.floor(prand(i, 61) * 1900000)).toFixed(2);

  const grade = pick(i, 67, grades);
  const member_type = pick(i, 71, memberTypes);
  const region = pick(i, 73, regions);
  const preferred_category = pick(i, 79, categories);
  const name = '고객' + (100001 + i);
  const email = 'syn' + (100001 + i) + '@example.com';
  const cellphone = '010-' + String(1000 + (i % 9000)).padStart(4, '0') + '-' + String((i * 7) % 10000).padStart(4, '0');

  const row = [
    id, name, email, cellphone, grade, member_type, region, preferred_category,
    email_consent, sms_consent, signup_date, last_login_date, last_order_date,
    birthday, coupon_expire_date, points_expire_date, cart_updated_date,
    order_count, total_spent, points_balance, cart_total_amount,
    unused_coupon_count, has_abandoned_cart, id
  ];
  lines.push(row.join(','));
}

const outPath = path.join(__dirname, 'Customer_Profile_test_10000.csv');
fs.writeFileSync(outPath, lines.join('\r\n') + '\r\n', 'utf8');

// 검증 리포트
const pct = (n) => (n / N * 100).toFixed(1) + '%';
console.log('생성 완료:', outPath);
console.log('총 행:', N);
console.log('--- 심어둔 진단 비율 (검증) ---');
console.log(`1회성 구매자(oc=1)      : ${c.oc1} (${pct(c.oc1)})  [목표 >60%]`);
console.log(`첫구매 미전환(oc=0)     : ${c.oc0} (${pct(c.oc0)})  [목표 >20%]`);
console.log(`이탈(구매자중 90일+)    : ${c.churn} / 구매자 ${c.buyers} (${(c.churn / c.buyers * 100).toFixed(1)}%)  [목표 >25%]`);
console.log(`휴면(로그인 90일+)      : ${c.dormant} (${pct(c.dormant)})  [목표 >30%]`);
console.log(`장바구니 이탈           : ${c.cart} (${pct(c.cart)})  [목표 >15%]`);
console.log(`수신동의(email|sms)     : ${c.consent} (${pct(c.consent)})  [목표 <50% = 약점]`);
console.log(`생일 이번달(참고)       : ${c.bdayThisMonth} (${pct(c.bdayThisMonth)})`);
