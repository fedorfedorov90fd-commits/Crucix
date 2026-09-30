# ================================================================================ SERVER ORCHESTRATION MECHANISM — CRUCIX

DATE: 2026-08-24 VERSION: 1.0 STATUS: ACTUAL

================================================================================

1.  OVERALL CONCEPT
    ============================================================================
    ===

SERVER.MJS is NOT JUST AN HTTP SERVER. It is the MAIN ORCHESTRATOR of the
entire system.

When server.mjs starts, the following happens:
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STARTING SERVER.MJS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. HTTP SERVER (port 3117)                                                │
│     └── Serving static files (HTML, CSS, JS)                              │ │
    └── Handling API requests (200+ endpoints)                            │ │  
                                                                          │ │ 
2\. INITIAL DATA COLLECTION (once at startup)                             │ │   
 ├── NOTAM collector                                                    │ │    
├── GPS jamming collector                                              │ │    
├── VIX collector                                                      │ │    
├── Yield Curve collector                                              │ │    
├── Gold/Oil Ratio collector                                           │ │    
├── BDI collector                                                      │ │    
├── Uranium collector                                                  │ │    
└── ... and all others (26 collectors)                                │ │      
                                                                      │ │  3.
SCHEDULER (automatic updates)                                         │ │    
├── Every 30 minutes → critical data update                           │ │     │
  (NOTAM, GPS, VIX, Gold/Oil, BDI, Uranium)                        │ │     └──
Every 6 hours → deep update (all 26 collectors)                  │ │           
                                                                 │
└─────────────────────────────────────────────────────────────────────────────┘

# ================================================================================ 2. WHY THIS APPROACH (PROFESSIONAL STANDARD)

Principle                 | Justification
───────────────────────────|───────────────────────────────────────────────────
Single entry point        | One command starts EVERYTHING. No manual actions.
Orchestration, not launch | Server manages all processes, not just waits.
Automatic updates         | Data is always fresh. User sees up-to-date picture.
Clean shutdown            | When server stops, all processes terminate cleanly.
Logging                   | Every action is logged for debugging.

# ================================================================================ 3. CODE STRUCTURE IN SERVER.MJS

┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. IMPORTS                                                                 │
│    ├── http, fs, path, url                                                │ │
   ├── child_process (for running collectors)                             │ │  
 └── ALL API modules (200+)                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. LOGGER                                                                  │
│    └── log(message, type) function — unified log format                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. COLLECTOR LAUNCH AT STARTUP                                             │
│    ├── runCollector(name) — runs a single collector                       │ │
   └── runInitialCollectors() — runs ALL collectors                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. SCHEDULER                                                               │
│    ├── startScheduler() — starts update intervals                         │ │
   │   ├── 30 minutes: critical collectors                                │ │  
 │   └── 6 hours: all collectors                                        │ │   
└── stopScheduler() — stops all intervals                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. ALL EXISTING MODULES AND ROUTES (UNCHANGED)                            │ │
   ├── Safe module loading (safeImport)                                   │ │  
 ├── MIME types                                                         │ │   
├── PAGE_ROUTES (all 150+ pages)                                       │ │   
├── API routes (all 200+ endpoints)                                    │ │   
└── Main request handler                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ 6. STARTUP                                                                 │
│    ├── server.listen(PORT, callback)                                      │ │
   │   ├── Print startup information                                      │ │  
 │   ├── runInitialCollectors() — INITIAL COLLECTION                   │ │    │
  └── startScheduler() — SCHEDULER                                   │ │    └──
SIGINT, SIGTERM, uncaughtException handlers                        │
└─────────────────────────────────────────────────────────────────────────────┘

# ================================================================================ 4. LIST OF COLLECTORS THAT RUN AUTOMATICALLY

4.1. CRITICAL COLLECTORS (run at startup and every 30 minutes)
────────────────────────────────────────────────────────────────────────────────
# Collector                    | Purpose

───|─────────────────────────────|────────────────────────────────────────────
1  collect-notam.mjs             | Airspace closures 2  collect-gps-jamming.mjs
      | GPS jamming 3  collect-vix.mjs               | VIX fear index 4 
collect-gold-oil-ratio.mjs    | Gold/Oil ratio 5  collect-bdi.mjs              
| Baltic Dry Index 6  collect-uranium.mjs           | Uranium price
────────────────────────────────────────────────────────────────────────────────
4.2. ALL COLLECTORS (run at startup and every 6 hours)
────────────────────────────────────────────────────────────────────────────────
# Collector                    | Purpose

───|─────────────────────────────|────────────────────────────────────────────
1  collect-notam.mjs             | Airspace closures 2  collect-gps-jamming.mjs
      | GPS jamming 3  collect-google-trends.mjs     | Google Trends 4 
collect-vix.mjs               | VIX fear index 5  collect-yield-curve.mjs      
| Yield curve 6  collect-gold-oil-ratio.mjs    | Gold/Oil ratio 7 
collect-copper-gold.mjs       | Copper/Gold ratio 8  collect-bdi.mjs           
   | Baltic Dry Index 9  collect-uranium.mjs           | Uranium price 10
collect-viirs.mjs             | Night lights (VIIRS) 11 collect-inflation.mjs  
      | Inflation 12 collect-unemployment.mjs      | Unemployment 13
collect-pmi.mjs               | PMI 14 collect-recession.mjs         |
Recession 15 collect-happiness.mjs         | Happiness index 16
collect-gold-silver.mjs       | Gold/Silver ratio 17 collect-oil-gas.mjs       
   | Oil/Gas ratio 18 collect-big-mac.mjs           | Big Mac index 19
collect-dxy.mjs               | Dollar index 20 collect-tips.mjs              |
Real rates (TIPS) 21 collect-ovx.mjs               | Oil volatility 22
collect-hy-spread.mjs         | Corporate spreads 23
collect-war-preparation.mjs   | War preparation 24
collect-consumer-confidence.mjs| Consumer confidence 25
collect-nuclear-monitor.mjs   | Nuclear monitoring 26 collect-social-unrest.mjs
    | Social unrest
────────────────────────────────────────────────────────────────────────────────
# ================================================================================ 5. LOGGING

All events are written to console with unified format:

\[2026-08-24T12:00:00.000Z] \[INFO] 🔄 Running collector: vix...
\[2026-08-24T12:00:00.000Z] \[OK] \[vix] Data saved \[2026-08-24T12:00:01.000Z]
\[INFO] 🔄 Running collector: notam... \[2026-08-24T12:00:02.000Z] \[OK]
\[notam] Data saved

LOG TYPES:
────────────────────────────────────────────────────────────────────────────────
 \[START]  → Process started \[DONE]   → Process completed successfully \[OK]  
  → Operation completed \[INFO]   → Informational message \[WARN]   → Warning
(not critical) \[ERROR]  → Error (requires attention) \[REQ]    → HTTP request
────────────────────────────────────────────────────────────────────────────────
# ================================================================================ 6. SHUTDOWN

When server stops (Ctrl+C or SIGTERM):

1.  Scheduler stops (all intervals are cleared)
2.  HTTP server closes
3.  All processes terminate cleanly

No "hanging" processes remain.

# ================================================================================ 7. MANAGEMENT COMMANDS

7.1. START SERVER (ENTIRE SYSTEM)
────────────────────────────────────────────────────────────────────────────────
 cd "/home/ta8_/Рабочий стол/Crucix" node server.mjs
────────────────────────────────────────────────────────────────────────────────
7.2. STOP SERVER
────────────────────────────────────────────────────────────────────────────────
 Ctrl+C

# OR

pkill -f "node server.mjs"
────────────────────────────────────────────────────────────────────────────────
7.3. CHECK IF SERVER IS RUNNING
────────────────────────────────────────────────────────────────────────────────
 ps aux | grep "node server.mjs" | grep -v grep

# OR

curl http://localhost:3117/api/vix/
────────────────────────────────────────────────────────────────────────────────
7.4. VIEW LOGS
────────────────────────────────────────────────────────────────────────────────
# Logs are printed to console

# To save to file:

node server.mjs > logs/server.log 2>\&1
────────────────────────────────────────────────────────────────────────────────
7.5. AUTO-START ON SYSTEM BOOT (cron)
────────────────────────────────────────────────────────────────────────────────
 crontab -e

# Add line:

@reboot cd "/home/ta8_/Рабочий стол/Crucix" && node server.mjs >
logs/server.log 2>\&1 &
────────────────────────────────────────────────────────────────────────────────
# ================================================================================ 8. VERIFICATION

8.1. CHECK HTTP SERVER
────────────────────────────────────────────────────────────────────────────────
 curl http://localhost:3117/

# Should return HTML of the main page


─────────────────────────────────────────────────────────────────────────────────

8.2. CHECK API
────────────────────────────────────────────────────────────────────────────────
 curl http://localhost:3117/api/vix/

# Should return JSON with VIX data


─────────────────────────────────────────────────────────────────────────────────

8.3. CHECK COLLECTORS (data in basket)
────────────────────────────────────────────────────────────────────────────────
 ls -la data/basket/*.json

# Should have files with current data


─────────────────────────────────────────────────────────────────────────────────

8.4. CHECK DASHBOARDS
────────────────────────────────────────────────────────────────────────────────
# Open in browser:

http://localhost:3117/dashboard-financial.html
http://localhost:3117/dashboard-economic.html
http://localhost:3117/dashboard-military.html

# ... and all other 16 dashboards


─────────────────────────────────────────────────────────────────────────────────

# ================================================================================ 9. FREQUENTLY ASKED QUESTIONS

Q: Do I need to run collectors manually? A: NO. All collectors start
automatically when the server starts and update on schedule.

Q: What if data is not updating? A: Check if server is running: ps aux | grep
"node server.mjs" If server is running — check logs for errors.

Q: How to add a new collector to automatic startup? A: Add its name to
criticalCollectors or allCollectors array in runInitialCollectors() function.

Q: How to change update interval? A: Change values in startScheduler() function:

- 30 * 60 * 1000 → 30 minutes
- 6 * 60 * 60 * 1000 → 6 hours

Q: What to do on EADDRINUSE error (port is busy)? A: Stop the old process:
pkill -f "node server.mjs" Then start again.

# ================================================================================ 10. SYSTEM WORKFLOW DIAGRAM

┌─────────────────────────────────────────────────────────────────────────────┐
│                      USER                                                  │
│                           │                                                 
│ │                           ▼                                                
 │ │              ┌─────────────────────┐                                      
 │ │              │  node server.mjs    │                                      
 │ │              └─────────────────────┘                                      
 │ │                           │                                               
  │ │                           ▼                                              
   │ │         ┌─────────────────────────────────────┐                         
  │ │         │         ORCHESTRATOR                │                          
 │ │         ├─────────────────────────────────────┤                           
│ │         │  HTTP Server  │ Collectors  │ Cron  │                           
│ │         └─────────────────────────────────────┘                           
│ │                           │                                                
 │ │         ┌─────────────────┼─────────────────┐                             
│ │         ▼                 ▼                 ▼                             
│ │  ┌───────────┐    ┌───────────┐    ┌───────────┐                          │
│  │  API      │    │  Basket   │    │  Fresh    │                          │ │
 │  (200+)   │    │  (data)   │    │  Data     │                          │ │ 
└───────────┘    └───────────┘    └───────────┘                          │ │   
     │                 │                 │                              │ │    
    └─────────────────┼─────────────────┘                              │ │     
                     ▼                                                  │ │    
         ┌─────────────────────┐                                        │ │    
         │  16 DASHBOARDS      │                                        │ │    
         │  (all data present) │                                        │ │    
         └─────────────────────┘                                        │ │    
                      │                                                  │ │   
                       ▼                                                  │ │  
           ┌─────────────────────┐                                        │ │  
           │     USER            │                                        │ │  
           │  sees up-to-date    │                                        │ │  
           │     picture         │                                        │ │  
           └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘

# ================================================================================ 11. INVOLVED FILES

File                          | Purpose
──────────────────────────────|─────────────────────────────────────────────────
server.mjs                    | Main orchestrator (ENTIRE MECHANISM)
scripts/collect-*.mjs         | Data collectors (78 files) data/basket/*.json   
        | Data basket (86 files) dashboard/public/*.html       | Interface
pages (150+) logs/server.log               | Log file (optional)

# ================================================================================ 12. CHANGE HISTORY

DATE       | VERSION | CHANGE
───────────|────────|───────────────────────────────────────────────────────────
2026-08-24 | 1.0    | Document created. Orchestration mechanism described. |   
    | Full collector list added. |        | Management commands added.

# ================================================================================ END OF DOCUMENT

