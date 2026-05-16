# ViralShelf Local Dashboard — Setup Guide
**Server v2.0 · May 2026**

---

## What You're Setting Up

```
Your Browser (http://127.0.0.1:4317)
        ↕  WebSocket (live push)
  ViralShelf Server (Node.js)
        ├── Airtable API  (design queue, memory)
        ├── Etsy API v3   (listings, revenue, OAuth auto-refresh)
        ├── Recraft V4    (SVG generation, $0.08/SVG)
        ├── Dynamic Mockups (product mockup rendering)
        ├── Pinterest API v5 (auto-pin on approval)
        ├── DeepSeek V4 Flash (agent reasoning)
        ├── Telegram Bot  (mobile approvals + alerts)
        └── SQLite DB     (local: logs, memory, spend, designs)
```

---

## Step 1 — Prerequisites

**Check Node.js version (must be 20+):**
```cmd
node --version
```
If below v20, download from nodejs.org.

**Check your folder structure after downloading files:**
```
C:\viralshelf\
  ├── server.js
  ├── package.json
  ├── .env.example
  ├── service\
  │   ├── install.js
  │   └── uninstall.js
  ├── scripts\
  │   └── setup-telegram.js
  └── public\
      ├── viralshelf-facility.html   ← rename to index.html OR keep as-is
      ├── viralshelf-cockpit.html
      └── privacy.html
```

---

## Step 2 — Install Dependencies

Open a terminal in `C:\viralshelf\` and run:
```cmd
npm install
```

This installs: `express`, `ws`, `better-sqlite3`, `dotenv`

**If better-sqlite3 fails to build:**
```cmd
npm install --build-from-source better-sqlite3
```
You may need Windows Build Tools:
```cmd
npm install -g windows-build-tools
```

---

## Step 3 — Create Your .env File

```cmd
copy .env.example .env
```

Open `.env` in Notepad and fill in each key. See the section below for where to find each one.

### Where to get each key:

**AIRTABLE_PAT** → airtable.com → Account → Developer Hub → Personal Access Tokens → Create Token
- Scopes: `data.records:read`, `data.records:write`, `schema.bases:read`

**AIRTABLE_BASE** → Open your Airtable base → look at the URL: `airtable.com/appXXXXXX/...` → copy `appXXXXXX`

**ETSY_KEYSTRING** → developer.etsy.com → Manage Apps → Your App → Keystring

**ETSY_CLIENT_ID / ETSY_CLIENT_SECRET** → Same page as keystring

**ETSY_SHOP_ID** → Your Etsy shop URL: `etsy.com/shop/YourShopName` → use `YourShopName`

**RECRAFT_KEY** → recraft.ai → Workspace → Settings → API Keys

**DEEPSEEK_KEY** → platform.deepseek.com → API Keys → Create

**DM_KEY** → dynamicmockups.com → Account → API

**PIN_TOKEN** → developers.pinterest.com → Apps → Your App → Generate Token (scope: pins:write, boards:read)

**PIN_BOARD** → Go to your Pinterest board → look at URL: `pinterest.com/username/board-name/` → use the board ID from the API or the URL slug

**TELEGRAM_BOT_TOKEN** → Open Telegram → search @BotFather → /newbot → follow prompts → copy token

**TELEGRAM_ALLOWED_CHAT_ID** → Your ID is already pre-filled as `7117568471` (your Telegram ID from the briefing). To confirm: message @userinfobot on Telegram.

---

## Step 4 — Create Required Folders

```cmd
mkdir data
mkdir public
mkdir logs
```

Move your HTML files into `public\`:
```cmd
move viralshelf-facility.html public\index.html
move viralshelf-cockpit.html  public\cockpit.html
move privacy.html             public\privacy.html
```

(Or keep original filenames — access at `/viralshelf-facility.html`)

---

## Step 5 — First Run

```cmd
node server.js
```

You should see:
```
╔══════════════════════════════════════════╗
║  ViralShelf Dashboard Server v2.0        ║
║  http://127.0.0.1:4317                   ║
╚══════════════════════════════════════════╝
```

Open your browser to: **http://127.0.0.1:4317**

The WebSocket dot in the top-right should turn green within 2 seconds.

---

## Step 6 — Authorize Etsy (First Time Only)

Etsy requires OAuth2 authorization. Do this once:

1. With server running, open: http://127.0.0.1:4317/auth/etsy/start
2. You'll be redirected to Etsy's login page
3. Approve the permissions
4. You'll be redirected back with a success message
5. The server saves the access + refresh tokens to SQLite
6. Tokens auto-refresh every 45 minutes from now on

**After first auth, ETSY_OAUTH_TOKEN in .env is optional** — the server uses SQLite.

---

## Step 7 — Set Up Telegram

Run the setup helper:
```cmd
node scripts/setup-telegram.js
```

This will:
- Verify your bot token works
- Show you your chat ID (send `/start` to your bot first)
- Send a test message to your phone

**Available Telegram commands once running:**
- `/status` — server uptime + spend summary
- `/pending` — list designs awaiting approval
- `/approve [design-id]` — approve a design remotely
- `/reject [design-id]` — reject a design remotely
- `/spend` — 30-day API cost breakdown
- `/help` — command list

**No public URL needed** — the server polls Telegram every 3 seconds automatically. Webhook mode (via ngrok) is optional for faster response.

---

## Step 8 — Install as Windows Service (Auto-Start)

So the server starts automatically when Windows boots, run as **Administrator**:
```cmd
node service/install.js
```

To check it's running:
- Open Task Manager → Services tab → look for `ViralShelf Dashboard`
- Or: `services.msc` → find `ViralShelf Dashboard`

To remove:
```cmd
node service/uninstall.js
```

Logs are written to `C:\viralshelf\logs\server.log`

---

## Step 9 — Connect OpenClaw Agents

Your OpenClaw agents push events to the server via:
```
POST http://127.0.0.1:4317/api/broadcast
Content-Type: application/json

{
  "type": "research.found",
  "agent": "Prof. Anders",
  "level": "ok",
  "text": "Found new niche: Dental Hygienist SVG — 4,200/mo searches"
}
```

Add this as a webhook/HTTP call at the end of each agent task in OpenClaw.

---

## What Each Dashboard Tab Does

### Facility (index.html)
- **FINANCE tab** — live revenue, spend per API, net profit, break-even tracker, projected revenue
- **GALLERY tab** — all designs from SQLite, click any to open approval modal
- **DESIGN tab** — type a prompt → Serina generates an SVG live via Recraft → auto-saves to queue
  - Quick templates for Pet, Occupation, Floral, Holiday niches
  - Shows Recraft credit balance and SVG count this month
  - API health status for all 7 integrations
  - Etsy token status + re-auth link if expired
- **LOG tab** — live WebSocket feed of all agent activity
- **OPT tab** — Isabel's market + internal optimization insights

### War Room (⚡ button)
- Agents animate walking in to the conference table
- Type mission orders → all agents respond in character
- Orders are broadcast to the server and logged

### Cockpit (cockpit.html)
- All pending approvals from Airtable
- Agent memory rules
- Settings + API connection status
- Airtable credential entry (saves to localStorage)

---

## Troubleshooting

**Server won't start:**
- Check Node version: `node --version` (need 20+)
- Check .env exists and has no typos
- Check port 4317 isn't in use: `netstat -an | findstr 4317`

**WebSocket dot stays grey:**
- Server must be running before you open the browser
- Check firewall isn't blocking 127.0.0.1:4317
- Try refreshing the page

**Etsy returns 401:**
- Run the OAuth flow again: http://127.0.0.1:4317/auth/etsy/start
- Check ETSY_CLIENT_ID and ETSY_CLIENT_SECRET are correct

**Recraft returns error:**
- Check RECRAFT_KEY is set correctly
- Check you have credits: recraft.ai → Workspace → Billing

**Telegram bot not responding:**
- Run `node scripts/setup-telegram.js` to debug
- Make sure you sent /start to the bot before testing
- Check TELEGRAM_ALLOWED_CHAT_ID matches your actual chat ID

**Airtable returns 403:**
- Check your PAT has `data.records:read` and `data.records:write` scopes
- Check AIRTABLE_BASE starts with `app`

**Designs not showing in gallery:**
- The server pulls from local SQLite first
- Generate a test design via the DESIGN tab → it should appear immediately
- For Airtable designs, make sure the table is named exactly `Designs Pending Approval`

---

## API Endpoints Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Server status + env check |
| GET | /api/etsy/kpis | Revenue, orders, listing count |
| GET | /api/etsy/token-status | OAuth token expiry |
| GET | /auth/etsy/start | Begin Etsy OAuth flow |
| POST | /api/recraft/generate | Generate SVG (body: prompt, style, name, niche, autoSave) |
| GET | /api/recraft/balance | Recraft credit balance |
| POST | /api/mockups/render | Render product mockup |
| POST | /api/pinterest/pin | Create a pin |
| POST | /api/deepseek/chat | Chat completion |
| GET | /api/designs | List designs (?status=Pending) |
| POST | /api/designs | Add a design |
| PATCH | /api/designs/:id | Approve/reject a design |
| GET | /api/spend | 30-day spend by service |
| POST | /api/spend | Log a manual spend entry |
| GET | /api/memory | Agent memory entries |
| POST | /api/memory | Save a memory rule |
| GET | /api/insights | Isabel's optimization insights |
| POST | /api/insights | Add an insight |
| GET | /api/log | Recent agent log entries |
| POST | /api/broadcast | Push any event to dashboard (from OpenClaw) |
| POST | /api/telegram/webhook | Telegram webhook receiver |
| GET | /api/telegram/me | Bot info |
| GET | /api/airtable/:table | Proxy GET to Airtable |
| PATCH | /api/airtable/:table/:id | Proxy PATCH to Airtable |

---

## After Everything Works

Once you've tested and everything is green, the next priorities from your briefing are:

1. **Pinterest API approval** — reapply with viralshelf.netlify.app/privacy.html
2. **Dynamic Mockups** — set up templates and connect to Design Studio
3. **Generate next SVG batch** — Yorkie, Poodle, Nurse, Welder (use DESIGN tab)
4. **Wire OpenClaw agents** to POST to /api/broadcast after each task
5. **Etsy → Pinterest** native integration in Etsy shop settings (backup until API approves)

Come back with any error messages and we'll troubleshoot together.
