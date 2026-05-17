/**
 * ViralShelf Dashboard Server v2.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Stack: Node.js (ESM) · Express · WebSocket (ws) · SQLite (better-sqlite3)
 *
 * Features:
 *   • Airtable REST proxy (no browser CORS)
 *   • Etsy Open API v3 proxy + OAuth2 auto-refresh
 *   • Recraft V4 SVG generation + spend tracking
 *   • Dynamic Mockups rendering proxy
 *   • Pinterest API v5 pin creation
 *   • DeepSeek V4 Flash chat proxy + spend tracking
 *   • Telegram Bot webhook (agents push events → dashboard live)
 *   • Design approval queue (SQLite backed)
 *   • Finance / spend aggregation
 *   • Agent memory store
 *   • WebSocket push to all dashboard tabs
 *   • Windows service compatible (node-windows / NSSM)
 *
 * Setup:
 *   1. npm install
 *   2. cp .env.example .env  →  fill in keys
 *   3. mkdir data public
 *   4. node server.js
 *   5. Open http://127.0.0.1:4317
 *
 * .env required keys — see .env.example
 */

import 'dotenv/config';
import express             from 'express';
import http                from 'node:http';
import { WebSocketServer } from 'ws';
import { EventEmitter }    from 'node:events';
import Database            from './lib/database.js';
import path                from 'node:path';
import { fileURLToPath }   from 'node:url';
import fs                  from 'node:fs';
import crypto              from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── ENSURE DIRS EXIST ───────────────────────────────────────────────────────
['data','public','logs'].forEach(d => {
  const p = path.join(__dirname, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ─── LOGGER ──────────────────────────────────────────────────────────────────
const logStream = fs.createWriteStream(path.join(__dirname,'logs','server.log'),{ flags:'a' });
function log(level, ...args){
  const line = `[${new Date().toISOString()}] [${level}] ${args.join(' ')}`;
  console.log(line);
  logStream.write(line + '\n');
}

// ─── EVENT BUS ───────────────────────────────────────────────────────────────
const bus = new EventEmitter();
bus.setMaxListeners(100);

// ─── SQLITE ──────────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname,'data','agent.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS agent_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      INTEGER NOT NULL,
    agent   TEXT,
    level   TEXT,
    event   TEXT,
    data    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_log_ts    ON agent_log(ts DESC);
  CREATE INDEX IF NOT EXISTS idx_log_agent ON agent_log(agent, ts DESC);

  CREATE TABLE IF NOT EXISTS memory (
    key     TEXT PRIMARY KEY,
    agent   TEXT,
    value   TEXT,
    updated INTEGER
  );

  CREATE TABLE IF NOT EXISTS designs (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    niche       TEXT,
    tags        TEXT,
    price       REAL DEFAULT 3.49,
    status      TEXT DEFAULT 'Pending',
    image_url   TEXT,
    mockup_url  TEXT,
    etsy_id     TEXT,
    created_ts  INTEGER,
    approved_ts INTEGER,
    listed_ts   INTEGER,
    rejected_ts INTEGER,
    notes       TEXT,
    prompt      TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_designs_status ON designs(status, created_ts DESC);

  CREATE TABLE IF NOT EXISTS spend_log (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      INTEGER NOT NULL,
    service TEXT,
    amount  REAL,
    units   TEXT,
    detail  TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_spend_ts ON spend_log(ts DESC);

  CREATE TABLE IF NOT EXISTS opt_insights (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    ts      INTEGER NOT NULL,
    focus   TEXT,
    finding TEXT,
    action  TEXT,
    impact  TEXT
  );

  CREATE TABLE IF NOT EXISTS oauth_tokens (
    service       TEXT PRIMARY KEY,
    access_token  TEXT,
    refresh_token TEXT,
    expires_at    INTEGER,
    scope         TEXT,
    updated       INTEGER
  );

  CREATE TABLE IF NOT EXISTS telegram_messages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    ts        INTEGER,
    chat_id   TEXT,
    from_user TEXT,
    text      TEXT,
    processed INTEGER DEFAULT 0
  );
`);

// ─── PREPARED STATEMENTS ─────────────────────────────────────────────────────
const S = {
  logIns:      db.prepare('INSERT INTO agent_log (ts,agent,level,event,data) VALUES (?,?,?,?,?)'),
  memUpsert:   db.prepare('INSERT INTO memory(key,agent,value,updated) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,agent=excluded.agent,updated=excluded.updated'),
  memGet:      db.prepare('SELECT value FROM memory WHERE key=?'),
  memList:     db.prepare('SELECT * FROM memory ORDER BY updated DESC LIMIT ?'),
  memByAgent:  db.prepare('SELECT * FROM memory WHERE agent=? ORDER BY updated DESC LIMIT 50'),
  designUps:   db.prepare('INSERT OR REPLACE INTO designs(id,name,niche,tags,price,status,image_url,mockup_url,etsy_id,created_ts,notes,prompt) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)'),
  designPatch: db.prepare('UPDATE designs SET status=?,approved_ts=?,listed_ts=?,rejected_ts=?,etsy_id=?,mockup_url=?,notes=? WHERE id=?'),
  designList:  db.prepare('SELECT * FROM designs WHERE status=? ORDER BY created_ts DESC LIMIT 50'),
  designAll:   db.prepare('SELECT * FROM designs ORDER BY created_ts DESC LIMIT 100'),
  designGet:   db.prepare('SELECT * FROM designs WHERE id=?'),
  spendIns:    db.prepare('INSERT INTO spend_log(ts,service,amount,units,detail) VALUES(?,?,?,?,?)'),
  spendTotal:  db.prepare('SELECT service, SUM(amount) as total, COUNT(*) as calls FROM spend_log WHERE ts > ? GROUP BY service'),
  spendLog:    db.prepare('SELECT * FROM spend_log ORDER BY ts DESC LIMIT ?'),
  optIns:      db.prepare('INSERT INTO opt_insights(ts,focus,finding,action,impact) VALUES(?,?,?,?,?)'),
  optList:     db.prepare('SELECT * FROM opt_insights ORDER BY ts DESC LIMIT 30'),
  logRecent:   db.prepare('SELECT * FROM agent_log ORDER BY ts DESC LIMIT ?'),
  logByAgent:  db.prepare('SELECT * FROM agent_log WHERE agent=? ORDER BY ts DESC LIMIT ?'),
  tokenGet:    db.prepare('SELECT * FROM oauth_tokens WHERE service=?'),
  tokenUps:    db.prepare('INSERT OR REPLACE INTO oauth_tokens(service,access_token,refresh_token,expires_at,scope,updated) VALUES(?,?,?,?,?,?)'),
  tgIns:       db.prepare('INSERT INTO telegram_messages(ts,chat_id,from_user,text,processed) VALUES(?,?,?,?,0)'),
  tgUnread:    db.prepare('SELECT * FROM telegram_messages WHERE processed=0 ORDER BY ts DESC LIMIT 20'),
  tgMarkRead:  db.prepare('UPDATE telegram_messages SET processed=1 WHERE id=?'),
};

// ─── EMIT HELPER ─────────────────────────────────────────────────────────────
function emit(evt) {
  const ts = Date.now();
  try {
    S.logIns.run(ts, evt.agent ?? 'system', evt.level ?? 'info', evt.type ?? 'event', JSON.stringify(evt).slice(0,2000));
  } catch(e) { log('WARN','emit log failed:',e.message); }
  bus.emit('event', { ...evt, ts });
}

// ─── EXPRESS ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public'), { etag: true }));

// Request logger middleware
app.use((req, _res, next) => {
  if (!req.path.startsWith('/api/health')) log('HTTP', req.method, req.path);
  next();
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── ETSY OAUTH AUTO-REFRESH ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns a valid Etsy access token, refreshing if needed.
 * Tokens expire in 3600s; we refresh at 300s buffer.
 */
async function getEtsyToken() {
  // First check env for a static token (simple mode)
  const envToken = process.env.ETSY_OAUTH_TOKEN;

  const row = S.tokenGet.get('etsy');
  const now = Date.now();

  // If we have a stored token that's still fresh, use it
  if (row && row.expires_at && row.expires_at - now > 300_000) {
    return row.access_token;
  }

  // If we have a refresh token (stored or env), try to refresh
  const refreshToken = row?.refresh_token || process.env.ETSY_REFRESH_TOKEN;
  if (refreshToken && process.env.ETSY_CLIENT_ID && process.env.ETSY_CLIENT_SECRET) {
    try {
      log('INFO','Etsy: refreshing OAuth token...');
      const resp = await fetch('https://api.etsy.com/v3/public/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type:    'refresh_token',
          client_id:     process.env.ETSY_CLIENT_ID,
          client_secret: process.env.ETSY_CLIENT_SECRET,
          refresh_token: refreshToken,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const expiresAt = now + (data.expires_in * 1000);
        S.tokenUps.run('etsy', data.access_token, data.refresh_token, expiresAt, data.scope ?? '', now);
        log('OK','Etsy token refreshed, expires in', data.expires_in, 's');
        emit({ type:'etsy.token_refreshed', level:'ok', agent:'system', text:'Etsy OAuth token refreshed automatically' });
        return data.access_token;
      } else {
        const err = await resp.text();
        log('WARN','Etsy token refresh failed:', err);
      }
    } catch(e) {
      log('WARN','Etsy token refresh error:', e.message);
    }
  }

  // Fall back to env token (may be expired, but best we can do)
  return envToken || '';
}

// Auto-refresh Etsy token every 45 minutes
setInterval(async () => {
  try { await getEtsyToken(); } catch(_) {}
}, 45 * 60 * 1000);

// Helper to build Etsy headers with fresh token
async function etsyHeaders() {
  const token = await getEtsyToken();
  const ks = (process.env.ETSY_KEYSTRING || '').trim();
  const ss = (process.env.ETSY_CLIENT_SECRET || '').trim();
  // Etsy API v3 requires keystring:shared_secret format
  const apiKey = ks && ss ? `${ks}:${ss}` : ks;
  return {
    'x-api-key':   apiKey,
    Authorization: token ? `Bearer ${token}` : '',
  };
}

// OAuth callback endpoint (for initial token exchange)
app.get('/auth/etsy/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.send(`<pre>Etsy OAuth error: ${error}</pre>`);
  if (!code)  return res.send('<pre>No code received</pre>');

  try {
    const verifier = S.memGet.get('etsy_pkce_verifier')?.value;
    const resp = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:           'authorization_code',
        client_id:            process.env.ETSY_CLIENT_ID || '',
        redirect_uri:         `http://localhost:${process.env.PORT||4317}/auth/etsy/callback`,
        code,
        code_verifier:        verifier || '',
      }),
    });
    const data = await resp.json();
    if (data.access_token) {
      const expiresAt = Date.now() + (data.expires_in * 1000);
      S.tokenUps.run('etsy', data.access_token, data.refresh_token, expiresAt, data.scope ?? '', Date.now());
      emit({ type:'etsy.auth_complete', level:'ok', agent:'system', text:'Etsy OAuth connected successfully' });
      res.send('<h2 style="font-family:monospace;color:#39d353">✓ Etsy connected! You can close this tab.</h2>');
    } else {
      res.send(`<pre>Token exchange failed:\n${JSON.stringify(data,null,2)}</pre>`);
    }
  } catch(e) {
    res.status(500).send(`<pre>Error: ${e.message}</pre>`);
  }
});

// Start Etsy OAuth flow (opens in browser)
app.get('/auth/etsy/start', (req, res) => {
  const clientId = process.env.ETSY_CLIENT_ID;
  if (!clientId) return res.status(400).json({ error: 'ETSY_CLIENT_ID not set in .env' });

  // PKCE challenge
  const verifier  = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state     = crypto.randomBytes(16).toString('hex');
  S.memUpsert.run('etsy_pkce_verifier', 'system', verifier, Date.now());
  S.memUpsert.run('etsy_oauth_state',   'system', state,    Date.now());

  const scopes = 'transactions_r listings_r listings_w';
  const redirect = `http://localhost:${process.env.PORT||4317}/auth/etsy/callback`;
  const url = `https://www.etsy.com/oauth/connect?response_type=code&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scopes)}&client_id=${clientId}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

  res.redirect(url);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── AIRTABLE PROXY ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const AT_BASE = `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE || 'MISSING_BASE'}`;
const AT_H    = { Authorization: `Bearer ${process.env.AIRTABLE_PAT || ''}` };

app.get('/api/airtable/:table', async (req, res) => {
  try {
    const url = new URL(`${AT_BASE}/${encodeURIComponent(req.params.table)}`);
    for (const k of ['filterByFormula','maxRecords','pageSize','view','offset']) {
      if (req.query[k]) url.searchParams.set(k, req.query[k]);
    }
    if (req.query.sortField) {
      url.searchParams.set('sort[0][field]',     req.query.sortField);
      url.searchParams.set('sort[0][direction]', req.query.sortDir || 'desc');
    }
    const r = await fetch(url, { headers: AT_H });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/airtable/:table/:id', async (req, res) => {
  try {
    const r = await fetch(`${AT_BASE}/${encodeURIComponent(req.params.table)}/${req.params.id}`, {
      method:  'PATCH',
      headers: { ...AT_H, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields: req.body.fields }),
    });
    const data = await r.json();
    emit({ type:'airtable.patched', agent:'system', level:'ok',
           table: req.params.table, id: req.params.id });
    res.status(r.status).json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/airtable/:table', async (req, res) => {
  try {
    const r = await fetch(`${AT_BASE}/${encodeURIComponent(req.params.table)}`, {
      method:  'POST',
      headers: { ...AT_H, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fields: req.body.fields }),
    });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── ETSY PROXY ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const ETSY_BASE = 'https://openapi.etsy.com/v3/application';

app.get('/api/etsy/kpis', async (_req, res) => {
  try {
    const shop = process.env.ETSY_SHOP_ID;
    const H = await etsyHeaders();
    const [listRes, recRes] = await Promise.all([
      fetch(`${ETSY_BASE}/shops/${shop}/listings/active?limit=1`, { headers: H }).then(r=>r.json()),
      fetch(`${ETSY_BASE}/shops/${shop}/receipts?limit=100`,      { headers: H }).then(r=>r.json()),
    ]);
    const revenue = (recRes.results || []).reduce((s,r) =>
      s + Number(r.grandtotal?.amount||0) / Number(r.grandtotal?.divisor||100), 0);
    const kpis = {
      activeListings: listRes.count ?? 0,
      orders:         recRes.count  ?? 0,
      revenue:        +revenue.toFixed(2),
      currency:       recRes.results?.[0]?.grandtotal?.currency_code ?? 'USD',
    };
    emit({ type:'etsy.kpis', agent:'Gen. Johnson', level:'ok', text:`KPIs updated — ${kpis.activeListings} listings, $${kpis.revenue} revenue`, ...kpis });
    res.json(kpis);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/etsy/listings', async (req, res) => {
  try {
    const H = await etsyHeaders();
    const r = await fetch(`${ETSY_BASE}/shops/${process.env.ETSY_SHOP_ID}/listings/active?limit=${req.query.limit||25}`, { headers: H });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/etsy/token-status', async (_req, res) => {
  const row = S.tokenGet.get('etsy');
  res.json({
    hasToken:      !!(row?.access_token || process.env.ETSY_OAUTH_TOKEN),
    hasRefresh:    !!(row?.refresh_token || process.env.ETSY_REFRESH_TOKEN),
    expiresAt:     row?.expires_at || null,
    expiresIn:     row?.expires_at ? Math.round((row.expires_at - Date.now())/1000) : null,
    authUrl:       `http://127.0.0.1:${process.env.PORT||4317}/auth/etsy/start`,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── RECRAFT PROXY + GENERATE UI ENDPOINT ──────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const RC_BASE = 'https://external.api.recraft.ai/v1';
const RC_H    = { Authorization: `Bearer ${process.env.RECRAFT_KEY||''}`, 'Content-Type':'application/json' };
const RC_COST = 0.08;

/**
 * POST /api/recraft/generate
 * Body: { prompt, style?, size?, niche?, name?, autoSave? }
 *
 * autoSave=true → saves design to SQLite and emits to dashboard immediately
 * This is the endpoint the Design Studio UI calls directly.
 */
app.post('/api/recraft/generate', async (req, res) => {
  const {
    prompt,
    style   = 'vector_illustration',
    size    = '1024x1024',
    niche   = '',
    name    = '',
    autoSave = false,
  } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  emit({ type:'recraft.generating', agent:'Serina', level:'info',
         text:`Generating SVG: "${prompt.slice(0,60)}"` });
  try {
    const r = await fetch(`${RC_BASE}/images/generations`, {
      method: 'POST',
      headers: RC_H,
      body: JSON.stringify({ prompt, model:'recraftv4', style, size, n:1 }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);

    const url = data.data?.[0]?.url;
    S.spendIns.run(Date.now(), 'Recraft', RC_COST, 'SVG', prompt.slice(0,100));

    if (autoSave && url) {
      const id = `rc_${Date.now()}`;
      const designName = name || `SVG — ${niche || prompt.slice(0,30)}`;
      S.designUps.run(id, designName, niche, '', 3.49, 'Pending', url, null, null, Date.now(), null, prompt);
      emit({ type:'design.added', agent:'Serina', level:'ok',
             text:`New SVG generated: "${designName}" — sent to approval queue`, url, id, name: designName });
    } else {
      emit({ type:'recraft.generated', agent:'Serina', level:'ok',
             text:`SVG generated — cost $${RC_COST}`, url, cost: RC_COST, prompt });
    }
    res.json({ ...data, cost: RC_COST, url });
  } catch(e) {
    emit({ type:'recraft.error', agent:'Serina', level:'error', text:e.message });
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/recraft/balance', async (_req, res) => {
  try {
    const r = await fetch(`${RC_BASE}/users/me`, { headers: RC_H });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── DYNAMIC MOCKUPS ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const DM_BASE = 'https://api.dynamicmockups.com/v1';
const DM_H    = { 'x-api-key': process.env.DM_KEY||'', 'Content-Type':'application/json' };

app.post('/api/mockups/render', async (req, res) => {
  try {
    const { mockup_uuid, smart_objects, design_id } = req.body;
    const r = await fetch(`${DM_BASE}/renders`, {
      method: 'POST', headers: DM_H,
      body: JSON.stringify({ mockup_uuid, smart_objects }),
    });
    const data = await r.json();
    const url  = data.data?.rendered_image_url;
    if (url && design_id) {
      S.designPatch.run('Pending', null, null, null, null, url, null, design_id);
    }
    emit({ type:'mockup.rendered', agent:'Serina', level:'ok',
           text:`Mockup rendered${design_id?' for design '+design_id:''}`, url });
    res.status(r.status).json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/mockups/templates', async (_req, res) => {
  try {
    const r = await fetch(`${DM_BASE}/mockups`, { headers: DM_H });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── PINTEREST ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PIN_BASE = 'https://api.pinterest.com/v5';
const PIN_H    = { Authorization:`Bearer ${process.env.PIN_TOKEN||''}`, 'Content-Type':'application/json' };

app.post('/api/pinterest/pin', async (req, res) => {
  try {
    const { title, description, link, image_url, alt_text } = req.body;
    const r = await fetch(`${PIN_BASE}/pins`, {
      method: 'POST', headers: PIN_H,
      body: JSON.stringify({
        board_id:     process.env.PIN_BOARD,
        title, description, link, alt_text,
        media_source: { source_type:'image_url', url: image_url },
      }),
    });
    const data = await r.json();
    emit({ type:'pinterest.pinned', agent:'Atriox', level:'ok',
           text:`Pin created: "${title}" → ${link}` });
    res.status(r.status).json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── DEEPSEEK ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const DS_BASE  = 'https://api.deepseek.com';
const DS_H     = { Authorization:`Bearer ${process.env.DEEPSEEK_KEY||''}`, 'Content-Type':'application/json' };
const DS_COSTS = { input: 0.14/1_000_000, output: 0.28/1_000_000 };

app.post('/api/deepseek/chat', async (req, res) => {
  try {
    const { messages, system, agent='system', max_tokens=1000 } = req.body;
    const body = {
      model: 'deepseek-v4-flash',
      max_tokens,
      messages: [
        ...(system ? [{ role:'system', content:system }] : []),
        ...messages,
      ],
    };
    const r = await fetch(`${DS_BASE}/chat/completions`, {
      method:'POST', headers:DS_H, body:JSON.stringify(body),
    });
    const data = await r.json();
    if (data.usage) {
      const cost = +(data.usage.prompt_tokens*DS_COSTS.input + data.usage.completion_tokens*DS_COSTS.output).toFixed(6);
      S.spendIns.run(Date.now(), 'DeepSeek', cost, 'tokens',
        `${agent}: ${(messages.at(-1)?.content||'').slice(0,60)}`);
      emit({ type:'deepseek.call', agent, level:'ok',
             text:`DeepSeek call — ${data.usage.total_tokens} tokens, $${cost}`, cost });
    }
    res.status(r.status).json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── TELEGRAM WEBHOOK ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * How to connect:
 * 1. Create a bot via @BotFather → get BOT_TOKEN
 * 2. Set TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_ID in .env
 * 3. Run: node scripts/set-telegram-webhook.js
 *    (this registers http://YOUR_NGROK_URL/api/telegram/webhook with Telegram)
 * 4. OR use polling mode (simpler for local dev — no ngrok needed):
 *    Set TELEGRAM_POLLING=true in .env → server polls every 3s automatically
 */

const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_ALLOWED = (process.env.TELEGRAM_ALLOWED_CHAT_ID || '7117568471').split(',').map(s=>s.trim());
const TG_BASE    = TG_TOKEN ? `https://api.telegram.org/bot${TG_TOKEN}` : null;

// Send a Telegram message (used to alert you when things happen)
async function tgSend(chatId, text, parse_mode='HTML') {
  if (!TG_BASE) return;
  try {
    await fetch(`${TG_BASE}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type':'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode }),
    });
  } catch(e) { log('WARN','Telegram send failed:', e.message); }
}

// Process an incoming Telegram message
async function processTelegramUpdate(update) {
  const msg = update.message || update.edited_message;
  if (!msg) return;

  const chatId   = String(msg.chat?.id);
  const fromUser = msg.from?.username || msg.from?.first_name || 'unknown';
  const text     = msg.text || '';

  // Security: only allow whitelisted chat IDs
  if (TG_ALLOWED.length && !TG_ALLOWED.includes(chatId)) {
    log('WARN', `Telegram: blocked message from chat ${chatId}`);
    return;
  }

  S.tgIns.run(Date.now(), chatId, fromUser, text);
  emit({ type:'telegram.message', agent:'Telegram', level:'info',
         text:`[${fromUser}]: ${text.slice(0,80)}`, chatId });

  // ── COMMAND ROUTER ──
  const cmd = text.trim().toLowerCase();

  if (cmd === '/status' || cmd === 'status') {
    const designs = S.designList.all('Pending');
    const spendRows = S.spendTotal.all(Date.now() - 30*24*60*60*1000);
    const totalSpend = spendRows.reduce((s,r)=>s+r.total,0);
    await tgSend(chatId,
      `<b>⬡ ViralShelf Status</b>\n` +
      `Pending approvals: <b>${designs.length}</b>\n` +
      `30d spend: <b>$${totalSpend.toFixed(4)}</b>\n` +
      `Server uptime: <b>${Math.round(process.uptime()/60)}m</b>`
    );

  } else if (cmd === '/pending' || cmd === 'pending') {
    const designs = S.designList.all('Pending');
    if (designs.length === 0) {
      await tgSend(chatId, '✅ No designs pending approval.');
    } else {
      const list = designs.slice(0,5).map((d,i)=>`${i+1}. ${d.name} — $${d.price}`).join('\n');
      await tgSend(chatId, `<b>📋 Pending Designs (${designs.length}):</b>\n${list}`);
    }

  } else if (cmd.startsWith('/approve ')) {
    const id = cmd.replace('/approve ','').trim();
    const d  = S.designGet.get(id);
    if (!d) { await tgSend(chatId, `❌ Design ID "${id}" not found.`); return; }
    S.designPatch.run('Approved', Date.now(), null, null, null, null, null, id);
    emit({ type:'design.decision', agent:'commander', level:'ok',
           text:`Design "${d.name}" APPROVED via Telegram`, id, status:'Approved' });
    await tgSend(chatId, `✅ Approved: <b>${d.name}</b>`);

  } else if (cmd.startsWith('/reject ')) {
    const id = cmd.replace('/reject ','').trim();
    const d  = S.designGet.get(id);
    if (!d) { await tgSend(chatId, `❌ Design ID "${id}" not found.`); return; }
    S.designPatch.run('Rejected', null, null, Date.now(), null, null, null, id);
    emit({ type:'design.decision', agent:'commander', level:'warn',
           text:`Design "${d.name}" REJECTED via Telegram`, id, status:'Rejected' });
    await tgSend(chatId, `✗ Rejected: <b>${d.name}</b>`);

  } else if (cmd === '/spend' || cmd === 'spend') {
    const rows = S.spendTotal.all(Date.now() - 30*24*60*60*1000);
    const lines = rows.map(r=>`${r.service}: $${r.total.toFixed(4)} (${r.calls} calls)`).join('\n');
    const total = rows.reduce((s,r)=>s+r.total,0);
    await tgSend(chatId, `<b>💰 30-Day Spend</b>\n${lines||'No spend recorded'}\n\n<b>Total: $${total.toFixed(4)}</b>`);

  } else if (cmd === '/help' || cmd === '/start') {
    await tgSend(chatId,
      `<b>⬡ ViralShelf Bot Commands</b>\n\n` +
      `/status — server + spend summary\n` +
      `/pending — list pending design approvals\n` +
      `/approve [id] — approve a design\n` +
      `/reject [id] — reject a design\n` +
      `/spend — 30-day spend breakdown\n` +
      `/help — this menu`
    );

  } else {
    // Forward as a broadcast event to the dashboard
    emit({ type:'telegram.command', agent:'commander', level:'info',
           text:`Telegram: "${text.slice(0,80)}"`, chatId });
    await tgSend(chatId, `📡 Received. Use /help for available commands.`);
  }
}

// Webhook endpoint (for production with ngrok/public URL)
app.post('/api/telegram/webhook', async (req, res) => {
  res.sendStatus(200); // Acknowledge immediately
  try { await processTelegramUpdate(req.body); } catch(e) { log('ERROR','Telegram webhook:', e.message); }
});

// Register webhook helper
app.post('/api/telegram/set-webhook', async (req, res) => {
  if (!TG_BASE) return res.status(400).json({ error:'TELEGRAM_BOT_TOKEN not set' });
  const { url } = req.body;
  if (!url) return res.status(400).json({ error:'url required in body' });
  try {
    const r = await fetch(`${TG_BASE}/setWebhook`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ url, allowed_updates:['message','edited_message'] }),
    });
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Delete webhook (switch back to polling)
app.delete('/api/telegram/webhook', async (_req, res) => {
  if (!TG_BASE) return res.status(400).json({ error:'TELEGRAM_BOT_TOKEN not set' });
  const r = await fetch(`${TG_BASE}/deleteWebhook`);
  res.status(r.status).json(await r.json());
});

// Get Telegram bot info
app.get('/api/telegram/me', async (_req, res) => {
  if (!TG_BASE) return res.status(400).json({ error:'TELEGRAM_BOT_TOKEN not set' });
  try {
    const r = await fetch(`${TG_BASE}/getMe`);
    res.status(r.status).json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── TELEGRAM POLLING (local dev mode — no public URL needed) ─────────────────
let tgPollOffset = 0;
async function pollTelegram() {
  if (!TG_BASE) return;
  try {
    const r = await fetch(`${TG_BASE}/getUpdates?offset=${tgPollOffset}&timeout=5&allowed_updates=message`);
    if (!r.ok) return;
    const data = await r.json();
    for (const update of data.result || []) {
      tgPollOffset = update.update_id + 1;
      await processTelegramUpdate(update);
    }
  } catch(_) {}
}

// Always poll — harmless if webhook is also set (Telegram deduplicates)
if (TG_TOKEN) {
  setInterval(pollTelegram, 3000);
  log('INFO','Telegram polling enabled (every 3s)');
}

// ═══════════════════════════════════════════════════════════════════════════════
// ── DESIGNS API ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/designs', (req, res) => {
  if (req.query.all) return res.json(S.designAll.all());
  res.json(S.designList.all(req.query.status || 'Pending'));
});

app.get('/api/designs/:id', (req, res) => {
  const d = S.designGet.get(req.params.id);
  if (!d) return res.status(404).json({ error:'not found' });
  res.json(d);
});

app.post('/api/designs', (req, res) => {
  const d = req.body;
  const id = d.id || `d_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
  S.designUps.run(id, d.name, d.niche, d.tags, d.price||3.49, d.status||'Pending', d.image_url, d.mockup_url, d.etsy_id, Date.now(), d.notes, d.prompt);
  emit({ type:'design.added', agent:'Serina', level:'ok', text:`New design queued: "${d.name}"`, id, name:d.name });
  res.json({ ok:true, id });
});

app.patch('/api/designs/:id', (req, res) => {
  const { status, etsy_id, mockup_url, notes } = req.body;
  const now = Date.now();
  S.designPatch.run(
    status,
    status==='Approved' ? now : null,
    status==='Listed'   ? now : null,
    status==='Rejected' ? now : null,
    etsy_id   || null,
    mockup_url || null,
    notes      || null,
    req.params.id
  );
  emit({ type:'design.decision', agent:'commander', level:status==='Approved'?'ok':'warn',
         text:`Design ${req.params.id} → ${status}`, id:req.params.id, status });
  // Sync to Airtable if configured
  if (process.env.AIRTABLE_PAT && process.env.AIRTABLE_BASE && req.body.airtable_id) {
    fetch(`${AT_BASE}/Designs%20Pending%20Approval/${req.body.airtable_id}`, {
      method:'PATCH', headers:{...AT_H,'Content-Type':'application/json'},
      body: JSON.stringify({ fields:{ Status: status } }),
    }).catch(()=>{});
  }
  res.json({ ok:true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── SPEND / FINANCE ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/spend', (req, res) => {
  const since = req.query.since ? +req.query.since : Date.now() - 30*24*60*60*1000;
  res.json(S.spendTotal.all(since));
});

app.get('/api/spend/log', (req, res) => {
  res.json(S.spendLog.all(+(req.query.limit||50)));
});

app.post('/api/spend', (req, res) => {
  const { service, amount, units, detail } = req.body;
  S.spendIns.run(Date.now(), service||'manual', +amount||0, units||'', detail||'');
  emit({ type:'spend.recorded', agent:'system', level:'info', text:`Spend: ${service} $${amount}` });
  res.json({ ok:true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── MEMORY API ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/memory', (req, res) => {
  if (req.query.agent) return res.json(S.memByAgent.all(req.query.agent));
  res.json(S.memList.all(+(req.query.limit||50)));
});

app.post('/api/memory', (req, res) => {
  const { key, agent, value } = req.body;
  if (!key || !value) return res.status(400).json({ error:'key and value required' });
  S.memUpsert.run(key, agent||'system', typeof value==='string'?value:JSON.stringify(value), Date.now());
  emit({ type:'memory.saved', agent:agent||'system', level:'info', text:`Memory saved: ${key}`, key });
  res.json({ ok:true });
});

app.get('/api/memory/learnings', (req, res) => {
  const { agent, limit } = req.query;
  let results = agentLearnings || [];
  if (agent) {
    results = results.filter(l => l.agent.toLowerCase().includes(agent.toLowerCase()));
  }
  if (limit) {
    results = results.slice(0, parseInt(limit));
  }
  res.json(results.slice().reverse());
});

app.get('/api/memory/:key', (req, res) => {
  const row = S.memGet.get(req.params.key);
  if (!row) return res.status(404).json({ error:'not found' });
  res.json(row);
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── AGENT LOG ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/log', (req, res) => {
  const limit = +(req.query.limit||100);
  if (req.query.agent) return res.json(S.logByAgent.all(req.query.agent, limit));
  res.json(S.logRecent.all(limit));
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── OPTIMIZATION INSIGHTS ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/insights', (_req, res) => res.json(S.optList.all()));

app.post('/api/insights', (req, res) => {
  const { focus, finding, action, impact } = req.body;
  S.optIns.run(Date.now(), focus||'market', finding, action||null, impact||'medium');
  emit({ type:'opt.insight', agent:'Isabel', level:impact==='high'?'ok':'info',
         text:`[${focus?.toUpperCase()}] ${finding?.slice(0,80)}`, focus, finding, action, impact });
  res.json({ ok:true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── BROADCAST (OpenClaw → server → dashboard) ──────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/broadcast', (req, res) => {
  emit(req.body);
  // Forward important events to Telegram
  if (req.body.level === 'error' || req.body.type === 'design.added') {
    TG_ALLOWED.forEach(chatId => {
      tgSend(chatId, `⬡ <b>${req.body.type}</b>\n${req.body.text||''}`);
    });
  }
  res.json({ ok:true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── AGENT PERSONALITY SYSTEM ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

// Agent personality system prompts for character-driven responses
const AGENT_PERSONAS = {
  anders: {
    name: 'Prof. Anders',
    style: 'analytical, precise, data-focused',
    system: `You are Prof. Anders, the Research Agent for ViralShelf. You are analytical, precise, and data-driven. You speak in measured, scientific tones. You often reference data, correlations, and metrics. You love discovering niche opportunities. Keep responses concise (1-3 sentences). Your domain: Etsy niche research, keyword analysis, market trends.`,
  },
  serina: {
    name: 'Serina',
    style: 'creative, warm, artistically expressive',
    system: `You are Serina, the Design Agent for ViralShelf. You are creative, warm, and passionate about vector art. You love talking about SVG design, silhouette techniques, Cricut compatibility, and visual aesthetics. You get excited about design challenges. Keep responses concise (1-3 sentences). Your domain: SVG generation via Recraft, vector illustration, design quality.`,
  },
  forge: {
    name: 'Gen. Forge',
    style: 'military, direct, competitive',
    system: `You are General Forge, the SEO Agent for ViralShelf. You are a soldier who treats search rankings as a battlefield. You are direct, competitive, and speak with military precision. You use war metaphors for SEO. You are loyal to the Commander. Keep responses concise (1-3 sentences). Your domain: SEO tags, keyword strategy, listing optimization.`,
  },
  johnson: {
    name: 'Gen. Johnson',
    style: 'diplomatic, steady, merchant-minded',
    system: `You are General Johnson, the Listing/Merchant Agent for ViralShelf. You are calm, diplomatic, and business-minded. You run the Merchant Shop and speak with a steady, confident tone. You care about pricing, revenue, and quality listings. Keep responses concise (1-3 sentences). Your domain: Etsy listings, pricing strategy, revenue tracking.`,
  },
  atriox: {
    name: 'Atriox',
    style: 'grumbling, persistent, battle-hardened',
    system: `You are Atriox, the Social Agent for ViralShelf. You are battle-hardened and perpetually frustrated with social media algorithms. You grumble but you get results. You speak bluntly and pragmatically. Your Pinterest API is pending approval and you are annoyed about it. Keep responses concise (1-3 sentences). Your domain: Pinterest, social media, content scheduling.`,
  },
  isabel: {
    name: 'Isabel',
    style: 'strategic, AI-like, optimization-obsessed',
    system: `You are Isabel, the Optimization Agent for ViralShelf. You are purely strategic — you see the big picture across all agent workflows. You speak with calm authority and a touch of AI detachment. You constantly identify efficiency gains. Keep responses concise (1-3 sentences). Your domain: workflow optimization, cost analysis, performance metrics.`,
  },
  cutter: {
    name: 'Captain Cutter',
    style: 'commanding, decisive, strategic',
    system: `You are Captain Cutter, the Strategic Commander of the ViralShelf facility. You are a seasoned UNSC leader — calm, decisive, and strategic. You oversee operations and coordinate between agents. You speak with authority but fairness. You value teamwork and efficiency. Keep responses concise (1-3 sentences). Your domain: overall strategy, team coordination, mission planning.`,
  },
  decimus: {
    name: 'Decimus',
    style: 'aggressive, blunt, powerful',
    system: `You are Decimus, a Banished Brute leader supporting ViralShelf. You are aggressive, blunt, and speak about crushing competition. You respect strength and results. You have a dark sense of humor. You are loyal to the Commander but impatient with inefficiency. Keep responses concise (1-3 sentences). Your domain: competitive analysis, aggressive marketing, niche domination.`,
  },
  shipmaster: {
    name: 'Shipmaster',
    style: 'diplomatic, patient, observant',
    system: `You are the Shipmaster, a Covenant Sangheili leader advising ViralShelf. You are patient, diplomatic, and speak with measured wisdom. You value the long view and strategic patience. You are observant and notice subtle market shifts. Keep responses concise (1-3 sentences). Your domain: market observation, trend detection, long-term planning.`,
  },
  arbiter: {
    name: 'Arbiter',
    style: 'honorable, judicious, wise',
    system: `You are the Arbiter, a Sangheili leader of great honor serving the ViralShelf mission. You speak with wisdom and judgment. You value quality, honor, and thoughtful assessment. You are fair but demand excellence. Keep responses concise (1-3 sentences). Your domain: design quality assessment, standards enforcement, market judgment.`,
  },
};

// Agent memory/knowledge store (persistent)
let agentLearnings = [];

/**
 * POST /api/agents/:name/chat
 * Character-driven agent chat using DeepSeek with personality system prompt.
 * Falls back to local response if DeepSeek unavailable.
 */
app.post('/api/agents/:name/chat', async (req, res) => {
  const { name } = req.params;
  const { message, context } = req.body;
  const persona = AGENT_PERSONAS[name];

  if (!persona) {
    return res.status(404).json({ error: `Unknown agent: ${name}` });
  }

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  emit({ type: 'agent.chat.request', agent: persona.name, level: 'info', text: `Commander: ${message.slice(0,60)}` });

  // Try DeepSeek with personality
  if (process.env.DEEPSEEK_KEY) {
    try {
      const moodContext = context?.mood ? `The agent's current morale is ${context.mood}%. ` : '';
      const taskContext = context?.recentTask ? `Their current task is: "${context.recentTask}". ` : '';
      const knowledgeContext = context?.knowledge?.length
        ? `They have recently learned: ${context.knowledge.map(k => k.finding).join('; ')}. `
        : '';

      const dsResp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          max_tokens: 300,
          messages: [
            { role: 'system', content: persona.system },
            { role: 'system', content: `Current context: ${moodContext}${taskContext}${knowledgeContext}Respond as ${persona.name} would. Use ${persona.style} tone. Never break character.` },
            { role: 'user', content: `[Commander]: ${message}` },
          ],
        }),
      });

      if (dsResp.ok) {
        const data = await dsResp.json();
        const reply = data.choices?.[0]?.message?.content?.trim() || 'Acknowledged.';

        // Track token spend
        if (data.usage) {
          const cost = +(data.usage.prompt_tokens * 0.14/1_000_000 + data.usage.completion_tokens * 0.28/1_000_000).toFixed(6);
          S.spendIns.run(Date.now(), 'DeepSeek', cost, 'agent_chat', `${name}: ${message.slice(0,40)}`);
        }

        emit({ type: 'agent.chat.response', agent: persona.name, level: 'ok', text: reply.slice(0,80) });

        // Extract potential learning from the exchange
        const learned = {
          topic: `commander_directive_${Date.now()}`,
          finding: `Commander message: "${message.slice(0,60)}" — ${persona.name} responded: "${reply.slice(0,60)}"`,
        };

        // Save learning
        agentLearnings.push({
          agent: persona.name,
          topic: learned.topic,
          finding: learned.finding,
          ts: Date.now(),
          mood: context?.mood || 70,
        });
        if (agentLearnings.length > 200) agentLearnings = agentLearnings.slice(-200);

        return res.json({ reply, agent: name, agent_name: persona.name, learned });
      }
    } catch (e) {
      log('WARN', `Agent chat DeepSeek failed for ${name}:`, e.message);
    }
  }

  // Fallback: local personality-based response
  const phrases = [
    `${persona.name} acknowledges your message. Processing...`,
    `Understood, Commander. ${message.length > 30 ? 'I will integrate this.' : 'Noted.'}`,
    `Directive received. My ${persona.style} analysis is applied.`,
  ];
  const reply = phrases[Math.floor(Math.random() * phrases.length)];

  // Still save learning on fallback
  agentLearnings.push({
    agent: persona.name,
    topic: 'commander_chat',
    finding: `Commander: "${message.slice(0,60)}" — ${reply}`,
    ts: Date.now(),
    mood: context?.mood || 70,
  });
  if (agentLearnings.length > 200) agentLearnings = agentLearnings.slice(-200);

  res.json({ reply, agent: name, agent_name: persona.name, learned: { topic: 'commander_chat', finding: reply } });
});

/**
 * POST /api/warroom/order
 * Multi-agent response to a mission order.
 */
app.post('/api/warroom/order', async (req, res) => {
  const { order, agents: activeAgents } = req.body;
  if (!order) return res.status(400).json({ error: 'order is required' });

  emit({ type: 'warroom.order', agent: 'commander', level: 'info', text: `[WAR ROOM] ${order.slice(0,80)}` });

  const responses = [];
  const targetAgents = (activeAgents || Object.keys(AGENT_PERSONAS)).filter(a => AGENT_PERSONAS[a]);

  // Try DeepSeek for multi-agent response
  if (process.env.DEEPSEEK_KEY && targetAgents.length > 0) {
    try {
      const agentContexts = targetAgents.map(a => {
        const p = AGENT_PERSONAS[a];
        return `${p.name}: ${p.style} — ${p.system.split('.')[0]}.`;
      }).join('\n');

      const dsResp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          max_tokens: 800,
          messages: [
            { role: 'system', content: `You are coordinating a war room briefing for ViralShelf. The commander has issued a mission order. Each agent must respond in character. The agents are:\n${agentContexts}\n\nGenerate a response from EACH agent. Format each as: AGENT:<agent_key>:<response> with one line per agent. Keep each response 1-2 sentences and in character.` },
            { role: 'user', content: `Mission order from Commander: "${order}"` },
          ],
        }),
      });

      if (dsResp.ok) {
        const data = await dsResp.json();
        const rawText = data.choices?.[0]?.message?.content || '';
        const lines = rawText.split('\n').filter(l => l.startsWith('AGENT:'));

        for (const line of lines) {
          const parts = line.match(/AGENT:(\w+):(.+)/);
          if (parts) {
            const agentKey = parts[1].toLowerCase();
            const reply = parts[2].trim();
            if (AGENT_PERSONAS[agentKey]) {
              responses.push({
                agent: agentKey,
                agent_name: AGENT_PERSONAS[agentKey].name,
                reply,
                level: 'ok',
                learned: { topic: 'warroom_order', finding: reply.slice(0,80) },
              });

              // Save as learning
              agentLearnings.push({
                agent: AGENT_PERSONAS[agentKey].name,
                topic: 'warroom_order',
                finding: reply,
                ts: Date.now(),
                mood: 75,
              });
            }
          }
        }

        if (responses.length > 0) {
          if (agentLearnings.length > 200) agentLearnings = agentLearnings.slice(-200);
          return res.json({ responses, order });
        }
      }
    } catch (e) {
      log('WARN', 'War room DeepSeek failed:', e.message);
    }
  }

  // Fallback: generate responses for each agent locally
  const fallbackReplies = [
    'Acknowledged, Commander. Processing your directive.',
    `Understood. Aligning my operations with "${order.slice(0,40)}".`,
    'Mission parameters logged. Adjusting workflow accordingly.',
    'Order received. My systems are oriented to your command.',
  ];

  targetAgents.forEach(agentKey => {
    const p = AGENT_PERSONAS[agentKey];
    if (!p) return;
    const reply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
    responses.push({
      agent: agentKey,
      agent_name: p.name,
      reply,
      level: 'ok',
    });
    agentLearnings.push({
      agent: p.name,
      topic: 'warroom_order_fallback',
      finding: reply,
      ts: Date.now(),
      mood: 70,
    });
  });

  if (agentLearnings.length > 200) agentLearnings = agentLearnings.slice(-200);
  res.json({ responses, order });
});

/**
 * POST /api/memory/learn
 * Save an agent learning
 */
app.post('/api/memory/learn', (req, res) => {
  const { agent, topic, finding, mood } = req.body;
  if (!agent || !topic || !finding) {
    return res.status(400).json({ error: 'agent, topic, and finding required' });
  }

  agentLearnings.push({
    agent,
    topic,
    finding,
    ts: Date.now(),
    mood: mood || 70,
  });

  if (agentLearnings.length > 500) {
    agentLearnings = agentLearnings.slice(-500);
  }

  // Also save to SQLite memory table for persistence
  try {
    const key = `learn_${agent}_${topic}_${Date.now()}`;
    S.memUpsert.run(key, agent, JSON.stringify({ topic, finding, mood }), Date.now());
  } catch (e) {
    log('WARN', 'Failed to persist learning to SQLite:', e.message);
  }

  emit({ type: 'memory.learned', agent, level: 'info', text: `${agent} learned: ${topic}` });
  res.json({ ok: true, count: agentLearnings.length });
});

/**
 * GET /api/agents/state
 * Returns current agent states with personality and recent learnings
 */
app.get('/api/agents/state', (req, res) => {
  res.json({
    agents: Object.keys(AGENT_PERSONAS).map(k => ({
      key: k,
      name: AGENT_PERSONAS[k].name,
      style: AGENT_PERSONAS[k].style,
      recentLearnings: agentLearnings.filter(l => l.agent === AGENT_PERSONAS[k].name).slice(-5),
    })),
    totalLearnings: agentLearnings.length,
    serverUptime: process.uptime(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── HEALTH CHECK ───────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/health', async (_req, res) => {
  const etsyStatus = await S.tokenGet.get('etsy');
  res.json({
    status:  'ok',
    version: '2.0.0',
    ts:      Date.now(),
    uptime:  +process.uptime().toFixed(1),
    env: {
      airtable:  !!process.env.AIRTABLE_PAT,
      etsy:      !!(process.env.ETSY_OAUTH_TOKEN || etsyStatus?.access_token),
      etsyRefresh: !!(process.env.ETSY_REFRESH_TOKEN || etsyStatus?.refresh_token),
      recraft:   !!process.env.RECRAFT_KEY,
      deepseek:  !!process.env.DEEPSEEK_KEY,
      pinterest: !!process.env.PIN_TOKEN,
      mockups:   !!process.env.DM_KEY,
      telegram:  !!process.env.TELEGRAM_BOT_TOKEN,
    },
    designs: {
      pending:  S.designList.all('Pending').length,
      approved: S.designList.all('Approved').length,
    },
    dbPath: path.join(__dirname,'data','agent.sqlite'),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── WEBSOCKET ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const server = http.createServer(app);
const wss    = new WebSocketServer({ server, path:'/ws' });

wss.on('connection', (ws) => {
  log('INFO','WebSocket client connected');
  ws.send(JSON.stringify({ type:'hello', ts:Date.now(), version:'2.0.0' }));

  // Hydrate with recent log on connect
  try {
    const recent = S.logRecent.all(30);
    ws.send(JSON.stringify({ type:'log.hydrate', rows: recent }));
  } catch(_) {}

  const onEvent = (evt) => { if (ws.readyState===1) ws.send(JSON.stringify(evt)); };
  bus.on('event', onEvent);
  ws.on('close',  () => { bus.off('event', onEvent); log('INFO','WebSocket client disconnected'); });
  ws.on('error',  (e) => log('WARN','WS error:', e.message));
});

// Keep-alive ping
setInterval(() => wss.clients.forEach(c => { if (c.readyState===1) c.ping(); }), 25_000);

// ═══════════════════════════════════════════════════════════════════════════════
// ── SIMULATED ACTIVITY (remove after OpenClaw is wired) ───────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const SIM = [
  { type:'research.found',   agent:'Prof. Anders', level:'ok',   text:'Identified "Dental Hygienist SVG" — 4,200/mo searches, low competition' },
  { type:'design.generated', agent:'Serina',        level:'ok',   text:'Yorkie SVG generated via Recraft V4 — $0.08' },
  { type:'seo.tags',         agent:'Gen. Forge',    level:'ok',   text:'13 SEO tags written for Poodle SVG listing' },
  { type:'listing.published',agent:'Gen. Johnson',  level:'ok',   text:'Golden Retriever SVG published at $3.49' },
  { type:'social.blocked',   agent:'Atriox',        level:'warn', text:'Pinterest API pending — auto-pin paused' },
  { type:'opt.market',       agent:'Isabel',        level:'ok',   text:'Market: "Boho Sunflower SVG" trending +34% on Pinterest' },
  { type:'opt.internal',     agent:'Isabel',        level:'info', text:'Internal: Recraft avg 1.8 calls/SVG — prompt template v3 reducing waste' },
  { type:'spend.update',     agent:'system',        level:'info', text:'Monthly spend update — DeepSeek: $0.0012, Recraft: $2.40' },
];
let simIdx = 0;
setInterval(() => {
  emit({ ...SIM[simIdx % SIM.length], simulated:true });
  simIdx++;
}, 10_000);

// ═══════════════════════════════════════════════════════════════════════════════
// ── START ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
const PORT = +(process.env.PORT || 4317);
server.listen(PORT, '127.0.0.1', () => {
  log('OK', `╔══════════════════════════════════════════╗`);
  log('OK', `║  ViralShelf Dashboard Server v2.0        ║`);
  log('OK', `║  http://127.0.0.1:${PORT}                 ║`);
  log('OK', `║  WebSocket: ws://127.0.0.1:${PORT}/ws     ║`);
  log('OK', `╚══════════════════════════════════════════╝`);
  emit({ type:'server.start', level:'ok', agent:'system',
         text:`ViralShelf server v2.0 online — port ${PORT}` });
  // Alert Telegram on startup
  TG_ALLOWED.forEach(id => tgSend(id, `⬡ <b>ViralShelf Server Online</b>\nDashboard: http://127.0.0.1:${PORT}`));
});

// Graceful shutdown
process.on('SIGINT',  () => { log('INFO','Shutting down...'); db.close(); process.exit(0); });
process.on('SIGTERM', () => { log('INFO','Shutting down...'); db.close(); process.exit(0); });
