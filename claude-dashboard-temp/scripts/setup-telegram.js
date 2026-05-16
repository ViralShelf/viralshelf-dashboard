/**
 * ViralShelf — Telegram Bot Setup Helper
 * Run: node scripts/setup-telegram.js
 *
 * What this does:
 *   1. Verifies your bot token works
 *   2. Shows your bot's username
 *   3. Optionally registers the webhook URL
 *   4. Tells you your chat ID (send /start to your bot first)
 */

import 'dotenv/config';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const PORT  = process.env.PORT || 4317;

if (!TOKEN) {
  console.error('❌  TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

const BASE = `https://api.telegram.org/bot${TOKEN}`;

async function run() {
  console.log('\n⬡  ViralShelf Telegram Setup\n');

  // 1. Check bot token
  const me = await fetch(`${BASE}/getMe`).then(r=>r.json());
  if (!me.ok) {
    console.error('❌  Bot token invalid:', me.description);
    process.exit(1);
  }
  console.log(`✅  Bot connected: @${me.result.username} (${me.result.first_name})`);

  // 2. Get recent updates (to find your chat ID)
  const updates = await fetch(`${BASE}/getUpdates?limit=5`).then(r=>r.json());
  if (updates.result?.length > 0) {
    const ids = [...new Set(updates.result.map(u => u.message?.chat?.id).filter(Boolean))];
    console.log(`\n📱  Recent chat IDs (add to TELEGRAM_ALLOWED_CHAT_ID in .env):`);
    ids.forEach(id => console.log(`    ${id}`));
  } else {
    console.log('\n⚠️   No messages yet. Send /start to your bot on Telegram, then re-run this script.');
  }

  // 3. Check current webhook
  const wh = await fetch(`${BASE}/getWebhookInfo`).then(r=>r.json());
  if (wh.result?.url) {
    console.log(`\n🔗  Current webhook: ${wh.result.url}`);
    console.log(`    Pending updates:  ${wh.result.pending_update_count}`);
    if (wh.result.last_error_message) {
      console.log(`    Last error:       ${wh.result.last_error_message}`);
    }
  } else {
    console.log('\n📡  No webhook set — using polling mode (polling runs inside server.js automatically)');
  }

  // 4. Send a test message if allowed chat ID is set
  const chatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;
  if (chatId && chatId !== '7117568471') {
    console.log(`\n📤  Sending test message to chat ${chatId}...`);
    const send = await fetch(`${BASE}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '⬡ <b>ViralShelf Bot Connected!</b>\n\nSend /help for available commands.',
        parse_mode: 'HTML',
      }),
    }).then(r=>r.json());
    if (send.ok) console.log('✅  Test message sent!');
    else console.log('⚠️   Send failed:', send.description);
  }

  console.log('\n─────────────────────────────────────────');
  console.log('Setup complete. Start the server with: node server.js');
  console.log('Commands your bot supports:');
  console.log('  /status   — server + spend summary');
  console.log('  /pending  — pending design approvals');
  console.log('  /approve [id] — approve a design');
  console.log('  /reject [id]  — reject a design');
  console.log('  /spend    — 30-day spend breakdown');
  console.log('  /help     — command list\n');
}

run().catch(e => { console.error('Error:', e.message); process.exit(1); });
