================================================================================
SERVER ORCHESTRATION MECHANISM — CRUCIX
================================================================================
DATE: 2026-08-24
VERSION: 1.0
STATUS: CURRENT

================================================================================

OVERALL CONCEPT
================================================================================

SERVER.MJS IS NOT JUST AN HTTP SERVER. It is the PRIMARY ORCHESTRATOR of the entire system.

When server.mjs starts, the following occurs:
┌─────────────────────────────────────────────────────────────────────────────┐
│ STARTING SERVER.MJS │
├─────────────────────────────────────────────────────────────────────────────┤
│ │
│ 1. HTTP SERVER (port 3117) │
│ └── Serving static files (HTML, CSS, JS) │
│ └── Handling API requests (200+ endpoints) │
│ │
│ 2. INITIAL DATA COLLECTION (once at startup) │
│ ├── NOTAM collector │
│ ├── GPS jamming collector │
│ ├── VIX collector │
│ ├── Yield curve collector │
│ ├── Gold/Oil ratio collector │
│ ├── BDI collector │
│ ├── Uranium collector │
│ └── ... and all others (26 collectors) │
│ │
│ 3. SCHEDULER (automatic updates) │
│ ├── Every 30 minutes → critical data update │
│ │ (NOTAM, GPS, VIX, Gold/Oil, BDI, Uranium) │
│ └── Every 6 hours → deep update (all 26 collectors) │
│ │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================

RATIONALE (PROFESSIONAL STANDARD)
================================================================================

Principle | Justification
───────────────────────────|───────────────────────────────────────────────────
Single entry point | One command starts EVERYTHING. Manual actions excluded.
Orchestration, not just run| Server manages all processes, not just waits.
Automatic updates | Data is always current. User sees fresh picture.
Clean shutdown | When server stops, all processes terminate cleanly.
Logging | Every action is logged for debugging.

================================================================================

CODE STRUCTURE IN SERVER.MJS
================================================================================

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. IMPORTS │
│ ├── http, fs, path, url │
│ ├── child_process (for running collectors) │
│ └── ALL API modules (200+) │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. LOGGER │
│ └── Function log(message, type) — unified log format │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. START COLLECTORS ON STARTUP │
│ ├── runCollector(name) — runs one collector │
│ └── runInitialCollectors() — runs ALL collectors │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. SCHEDULER │
│ ├── startScheduler() — starts update intervals │
│ │ ├── 30 minutes: critical collectors │
│ │ └── 6 hours: all collectors │
│ └── stopScheduler() — stops all intervals │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. ALL EXISTING MODULES AND ROUTES (UNCHANGED) │
│ ├── Safe module loading (safeImport) │
│ ├── MIME types │
│ ├── PAGE_ROUTES (all 150+ pages) │
│ ├── API routes (all 200+ endpoints) │
│ └── Main request handler │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. STARTUP │
│ ├── server.listen(PORT, callback) │
│ │ ├── Output startup info │
│ │ ├── runInitialCollectors() — INITIAL COLLECTION │
│ │ └── startScheduler() — SCHEDULER │
│ └── SIGINT, SIGTERM, uncaughtException handlers │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================

COLLECTORS RUN AUTOMATICALLY
================================================================================

4.1. CRITICAL COLLECTORS (startup and every 30 minutes)
─────────────────────────────────────────────────────────────────────────────────

Collector | Purpose
───|─────────────────────────────|────────────────────────────────────────────
1 collect-notam.mjs | Airspace closures
2 collect-gps-jamming.mjs | GPS jamming
3 collect-vix.mjs | VIX Fear Index
4 collect-gold-oil-ratio.mjs | Gold/Oil ratio
5 collect-bdi.mjs | Baltic Dry Index
6 collect-uranium.mjs | Uranium price
─────────────────────────────────────────────────────────────────────────────────

4.2. ALL COLLECTORS (startup and every 6 hours)
─────────────────────────────────────────────────────────────────────────────────

Collector | Purpose
───|─────────────────────────────|────────────────────────────────────────────
1 collect-notam.mjs | Airspace closures
2 collect-gps-jamming.mjs | GPS jamming
3 collect-google-trends.mjs | Google Trends
4 collect-vix.mjs | VIX Fear Index
5 collect-yield-curve.mjs | Yield curve
6 collect-gold-oil-ratio.mjs | Gold/Oil ratio
7 collect-copper-gold.mjs | Copper/Gold
8 collect-bdi.mjs | Baltic Dry Index
9 collect-uranium.mjs | Uranium
10 collect-viirs.mjs | Night lights (VIIRS)
11 collect-inflation.mjs | Inflation
12 collect-unemployment.mjs | Unemployment
13 collect-pmi.mjs | PMI
14 collect-recession.mjs | Recession
15 collect-happiness.mjs | Happiness Index
16 collect-gold-silver.mjs | Gold/Silver
17 collect-oil-gas.mjs | Oil/Gas
18 collect-big-mac.mjs | Big Mac Index
19 collect-dxy.mjs | Dollar Index
20 collect-tips.mjs | Real rates (TIPS)
21 collect-ovx.mjs | Oil volatility
22 collect-hy-spread.mjs | Corporate spreads
23 collect-war-preparation.mjs | War preparation
24 collect-consumer-confidence.mjs| Consumer confidence
25 collect-nuclear-monitor.mjs | Nuclear monitoring
26 collect-social-unrest.mjs | Social unrest
─────────────────────────────────────────────────────────────────────────────────

================================================================================

LOGGING
================================================================================

All events are logged to console in unified format:

[2026-08-24T12:00:00.000Z] [INFO] 🔄 Starting collector: vix...
[2026-08-24T12:00:00.000Z] [OK] [vix] Data saved
[2026-08-24T12:00:01.000Z] [INFO] 🔄 Starting collector: notam...
[2026-08-24T12:00:02.000Z] [OK] [notam] Data saved

LOG TYPES:
─────────────────────────────────────────────────────────────────────────────────
[START] → Process started
[DONE] → Process completed successfully
[OK] → Operation completed
[INFO] → Information message
[WARN] → Warning (non-critical)
[ERROR] → Error (requires attention)
[REQ] → HTTP request
─────────────────────────────────────────────────────────────────────────────────

================================================================================

SYSTEM SHUTDOWN
================================================================================

When server stops (Ctrl+C or SIGTERM):

Scheduler stops (all intervals cleared)

HTTP server closes

All processes terminate cleanly

No "orphaned" processes remain.

================================================================================

MANAGEMENT COMMANDS
================================================================================

7.1. START SERVER (ENTIRE SYSTEM)
─────────────────────────────────────────────────────────────────────────────────
cd "/home/ta8_/Рабочий стол/Crucix"
node server.mjs
─────────────────────────────────────────────────────────────────────────────────

7.2. STOP SERVER
─────────────────────────────────────────────────────────────────────────────────
Ctrl+C

OR
pkill -f "node server.mjs"
─────────────────────────────────────────────────────────────────────────────────

7.3. CHECK SERVER STATUS
─────────────────────────────────────────────────────────────────────────────────
ps aux | grep "node server.mjs" | grep -v grep

OR
curl http://localhost:3117/api/vix/
─────────────────────────────────────────────────────────────────────────────────

7.4. VIEW LOGS
─────────────────────────────────────────────────────────────────────────────────

Logs output to console
To save to file:
node server.mjs > logs/server.log 2>&1
─────────────────────────────────────────────────────────────────────────────────

7.5. AUTO-START ON SYSTEM BOOT (cron)
─────────────────────────────────────────────────────────────────────────────────
crontab -e

Add line:
@reboot cd "/home/ta8_/Рабочий стол/Crucix" && node server.mjs > logs/server.log 2>&1 &
─────────────────────────────────────────────────────────────────────────────────

================================================================================

HEALTH CHECKS
================================================================================

8.1. CHECK HTTP SERVER
─────────────────────────────────────────────────────────────────────────────────
curl http://localhost:3117/

Should return HTML of the main page
─────────────────────────────────────────────────────────────────────────────────

8.2. CHECK API
─────────────────────────────────────────────────────────────────────────────────
curl http://localhost:3117/api/vix/

Should return JSON with VIX data
─────────────────────────────────────────────────────────────────────────────────

8.3. CHECK COLLECTORS (data in basket)
─────────────────────────────────────────────────────────────────────────────────
ls -la data/basket/*.json

Should contain files with current data
─────────────────────────────────────────────────────────────────────────────────

8.4. CHECK DASHBOARDS
─────────────────────────────────────────────────────────────────────────────────

Open in browser:
http://localhost:3117/dashboard-financial.html
http://localhost:3117/dashboard-economic.html
http://localhost:3117/dashboard-military.html

... and all other 16 dashboards
─────────────────────────────────────────────────────────────────────────────────

================================================================================

FREQUENTLY ASKED QUESTIONS
================================================================================

Q: Do I need to run collectors manually?
A: NO. All collectors start automatically when the server starts and update on schedule.

Q: What if data doesn't update?
A: Check that the server is running:
ps aux | grep "node server.mjs"
If running, check logs for errors.

Q: How to add a new collector to automatic startup?
A: Add its name to the criticalCollectors or allCollectors array in runInitialCollectors().

Q: How to change the update interval?
A: Change values in startScheduler():

30 * 60 * 1000 → 30 minutes

6 * 60 * 60 * 1000 → 6 hours

Q: What to do on EADDRINUSE error (port busy)?
A: Stop the old process:
pkill -f "node server.mjs"
Then start again.

================================================================================

SYSTEM DIAGRAM
================================================================================

┌─────────────────────────────────────────────────────────────────────────────┐
│ USER │
│ │ │
│ ▼ │
│ ┌─────────────────────┐ │
│ │ node server.mjs │ │
│ └─────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────────────────────┐ │
│ │ ORCHESTRATOR │ │
│ ├─────────────────────────────────────┤ │
│ │ HTTP Server │ Collectors │ Cron │ │
│ └─────────────────────────────────────┘ │
│ │ │
│ ┌─────────────────┼─────────────────┐ │
│ ▼ ▼ ▼ │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ │
│ │ API │ │ Basket │ │ Current │ │
│ │ (200+) │ │ (basket) │ │ Data │ │
│ └───────────┘ └───────────┘ └───────────┘ │
│ │ │ │ │
│ └─────────────────┼─────────────────┘ │
│ ▼ │
│ ┌─────────────────────┐ │
│ │ 16 DASHBOARDS │ │
│ │ (all data present) │ ││ └─────────────────────┘ │
│ │ │
│ ▼ │
│ ┌─────────────────────┐ │
│ │ USER │ │
│ │ sees current │ │
│ │ picture │ │
│ └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

================================================================================

FILES INVOLVED
================================================================================

File | Purpose
──────────────────────────────|─────────────────────────────────────────────────
server.mjs | Main orchestrator (ENTIRE MECHANISM)
scripts/collect-.mjs | Data collectors (78 files)
data/basket/.json | Data basket (86 files)
dashboard/public/*.html | Interface pages (150+)
logs/server.log | Log file (optional)

================================================================================

CHANGE HISTORY
================================================================================

DATE | VERSION | CHANGE
───────────|─────────|───────────────────────────────────────────────────────────
2026-08-24 | 1.0 | Document created. Orchestration mechanism described.
| | Full collector list added.
| | Management commands added.

================================================================================
END OF DOCUMENT
================================================================================
