// 봇이 채널에 남긴 자기 메시지를 일괄 삭제하는 1회용 스크립트.
// 사용법: node cleanup.js <채널이름 또는 채널ID>   (예: node cleanup.js mce-bot)
//   - 봇 메시지만 삭제한다(사용자 메시지는 chat:write로 못 지움).
//   - conversations.history 가 필요하므로 채널 종류에 맞는 history 스코프가 있어야 한다.
require('dotenv').config();
const { WebClient } = require('@slack/web-api');

const token = process.env.SLACK_BOT_TOKEN;
const target = process.argv[2];

if (!token) { console.error('❌ .env 에 SLACK_BOT_TOKEN 이 없습니다.'); process.exit(1); }
if (!target) { console.error('❌ 사용법: node cleanup.js <채널이름 또는 채널ID>'); process.exit(1); }

const web = new WebClient(token);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  try {
    const me = await web.auth.test();
    const botUserId = me.user_id;
    console.log('봇 사용자:', me.user, botUserId);

    // 채널 ID 해석 (이미 ID면 그대로, 이름이면 목록에서 검색)
    let channelId = target;
    if (!/^[CG]/.test(target)) {
      const list = await web.conversations.list({
        types: 'public_channel,private_channel',
        limit: 1000,
      });
      const found = list.channels.find((c) => c.name === target.replace(/^#/, ''));
      if (!found) { console.error('❌ 채널을 못 찾음:', target); process.exit(1); }
      channelId = found.id;
    }
    console.log('대상 채널 ID:', channelId);

    let cursor;
    let deleted = 0;
    do {
      const hist = await web.conversations.history({ channel: channelId, limit: 200, cursor });
      for (const m of hist.messages) {
        const isBot = m.user === botUserId || (m.bot_id && m.bot_profile);
        if (isBot) {
          try {
            await web.chat.delete({ channel: channelId, ts: m.ts });
            deleted++;
            await sleep(400); // rate limit 여유
          } catch (e) {
            console.warn('  삭제 실패 ts=%s: %s', m.ts, e.data?.error || e.message);
          }
        }
      }
      cursor = hist.response_metadata?.next_cursor;
    } while (cursor);

    console.log(`✅ 삭제 완료: ${deleted}건`);
  } catch (e) {
    console.error('❌ 오류:', e.data?.error || e.message);
    if ((e.data?.error || '').includes('missing_scope')) {
      console.error('   필요한 스코프가 없습니다. needed:', e.data.needed, '/ provided:', e.data.provided);
    }
    process.exit(1);
  }
})();
