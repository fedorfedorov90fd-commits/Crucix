# 🧠 CRUCIX — Open Source Intelligence Terminal

![image](https://img.shields.io/badge/live-crucix.live-00d4ff?style=for-the-badge)
![image](https://img.shields.io/badge/open-live%20dashboard-0b1220?style=for-the-badge&logo=googlechrome&logoColor=white)
![image](https://img.shields.io/badge/node-22%2B-brightgreen)
![image](https://img.shields.io/badge/license-AGPLv3-blue.svg)
![image](https://img.shields.io/badge/OSINT%20sources-226-cyan)
![image](https://img.shields.io/badge/analyzers-59-purple)
![image](https://img.shields.io/badge/API%20modules-370%2B-orange)
![image](https://img.shields.io/badge/docker-ready-blue?logo=docker)
![image](https://img.shields.io/badge/Signal%20Wire-%40crucixmonitor-111111?style=for-the-badge&logo=x&logoColor=white)
![image](https://img.shields.io/badge/Ops%20Room-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)

---

## 📖 Table of Contents

1. [Description](#-description)
2. [Screenshots](#-screenshots)
3. [Quick Start](#-quick-start)
4. [What You Get](#-what-you-get)
5. [Analytics Platform](#-analytics-platform)
6. [Infrastructure Analyzer](#-infrastructure-analyzer)
7. [Router v3.1 — Mechanism A+B](#-router-v31--mechanism-ab)
8. [AI Laboratory](#-ai-laboratory)
9. [API Keys](#-api-keys)
10. [Architecture](#-architecture)
11. [Modular Server Architecture](#-modular-server-architecture)
12. [🗺️ Geopolitical Map (geo-map)](#️-geopolitical-map-geo-map)
13. [Data Sources](#-data-sources)
14. [npm Scripts](#-npm-scripts)
15. [Configuration](#-configuration)
16. [API Endpoints](#-api-endpoints)
17. [Troubleshooting](#-troubleshooting)
18. [Extensions](#-extensions)
19. [AI Chat](#-ai-chat)
20. [Contributing](#-contributing)
21. [License](#-license)

---

## 🚀 Description

**Crucix** is a platform for collecting, analyzing, and visualizing data from open sources. Designed for real-time monitoring of geopolitical, economic, military, and environmental conditions.

The architecture follows the **"Basket → AI → Map"** principle:

- **Collection** — data arrives from 226 sources into the basket (`data/basket/`)
- **Analysis** — 59 analyzers compute indices, composites, forecasts (`data/analytics/`)
- **AI** — local LLM (Ollama) generates briefs and forecasts
- **Map** — results are visualized on the geo-map (3D WebGL Globe + 2D D3 Map + Leaflet)

### Key Features

- ✅ **226 OSINT sources** — satellites, aviation, conflicts, economy, ecology
- ✅ **59 analyzers** — indices, detectors, forecasts, composites
- ✅ **370+ API modules** — all endpoints read from the basket
- ✅ **8 analytics categories** — index, detector, forecast, semantic, flow, market, specialist, space
- ✅ **3D WebGL Globe** + 2D map with 9 marker types
- ✅ **Leaflet map** with 237 layers, heatmap, and timeline
- ✅ **Infrastructure analyzer** — 114 objects, 15 endpoints
- ✅ **Auto-refresh** every 15 minutes via SSE
- ✅ **Telegram + Discord bots** with bidirectional control
- ✅ **AI analytics** via Ollama (local, no cloud)
- ✅ **Modular architecture** — easy to extend
- ✅ **Zero cloud, zero telemetry, zero subscriptions**

> **Live website:** [https://www.crucix.live/](https://www.crucix.live/)

---

## 📸 Screenshots

| | |
|-|-|
|![image](docs/dashboard.png)|![image](docs/boot.png)|
|**Main dashboard**|**Boot animation**|

| |
|-|
|![image](docs/map.png)|
|**2D map with markers**|

| |
|-|
|![image](docs/globe.png)|
|**3D WebGL Globe**|

---

## ⚡ Quick Start

### Local Run

```bash
# 1. Clone the repository
git clone https://github.com/calesthio/Crucix.git
cd Crucix

# 2. Install dependencies (Express only)
npm install

# 3. Copy .env template and add API keys (optional)
cp .env.example .env

# 4. Start the dashboard
npm run dev
```

Dashboard opens at `http://localhost:3117`

If `npm run dev` doesn't work, run directly:

```bash
node --trace-warnings server.mjs
```

### Docker

```bash
git clone https://github.com/calesthio/Crucix.git
cd Crucix
cp .env.example .env
docker compose up -d
```

---

## 🎯 What You Get

### Dashboard

- **3D WebGL Globe** (Globe.gl) with atmosphere and star field
- **2D map** (D3) with 9 marker types
- **Leaflet map** with 237 layers, heatmap, and timeline
- **Animated flight arcs** between aviation hubs
- **Region filters** (World, Americas, Europe, Middle East, Asia, Africa)
- **Real-time market data** (indices, crypto, energy, metals)

### Analytics

- **59 analyzers** — from base indices to composite risks
- **197 countries** in the characteristics reference
- **147 countries** with real Gini coefficient
- **194 countries** with World Bank macro data
- **114 critical infrastructure objects** (25 military bases, 20 NPPs, 26 ports, 15 chokepoints, 15 dams, 13 power grids)
- **8 analytics categories** in `data/analytics/`

### AI Capabilities

- **Local LLM** via Ollama
- **AI briefs** (daily, alert, summary)
- **Forecasts** via AI
- **Semantic search** over news (TF-IDF + cosine similarity)
- **Entity extraction** (NER) from text

### Integrations

- **Telegram bot** (bidirectional)
- **Discord bot** (bidirectional)
- **MCP Server** (Model Context Protocol) — access Crucix from external AI clients
- **CLI analytics** — query analyzers from terminal

---

## 📊 Analytics Platform

Crucix includes a **full analytics platform** — 59 analyzers from Party #2, split into **8 categories**.

### Analyzer Categories

| Category | Description | Count |
|---|---|---|
| **index** | Indices (country, regional) | 2 |
| **detector** | Event and anomaly detectors | 8 |
| **forecast** | Predictive models | 4 |
| **semantic** | Text semantic analysis | 6 |
| **flow** | Flows (trade, migration, resources) | 10 |
| **market** | Market indicators | 7 |
| **specialist** | Specialized (infra, nuclear, sanctions) | 21 |
| **space** | Space | 1 |
| **TOTAL** | | **59** |

### Key Analyzers

**Indices (index):**
- `country-instability` — Country Instability Index (CII). Reference implementation.
- `resilience-index` — Resilience Index (197 countries, 152 unique scores)

**Composites (specialist):**
- `strategic-risk-composite` — Strategic risk (instability + resilience deficit + infrastructure + geopolitics)
- `infrastructure-cascade` — Cascading infrastructure analysis (13 files, 15 endpoints)

**Forecasts (forecast):**
- `conflict-escalation-tracker` — Conflict escalation (6 levels)
- `ai-forecasts` — Forecasts via LLM
- `social-briefing` — Briefs via LLM (daily, alert, summary)
- `central-bank-predictor` — Central bank action predictor

**Detectors (detector):**
- `geo-convergence` — Geographic convergence
- `threat-classification` — Threat classification
- `surge-detection` — Surge detection
- `focal-point-detection` — Focal point activity
- `baseline-alerting` — Threshold alerts
- `cyber-attack-monitor` — Cyber attacks
- `snapshot-system` — State snapshots
- `pizza-index` — Activity near HQs (internal index)

**Semantics (semantic):**
- `adaptive-news-clustering` — News clustering (TF-IDF)
- `ai-news-synthesis` — AI news synthesis
- `entity-extraction` — NER
- `multi-source-corroboration` — Fact verification
- `source-credibility` — Source credibility
- `social-sentiment-analyzer` — Social sentiment

**Flows (flow):**
- `cross-stream-correlation` — Cross-stream correlation
- `route-explorer` — Alternative routes
- `supply-chain-cascade-engine` — Supply chain cascades
- `supply-chain-resilience` — Supply resilience
- `tanker-fleet-monitor` — Tanker fleet (dark ships)
- `arms-transfer-tracker` — Arms transfers
- `diplomatic-tracker` — Diplomatic activity
- `migration-flow-tracker` — Migration flows
- `signal-aggregator` — Signal aggregation
- `risk-signal-aggregator` — Risk aggregation

**Markets (market):**
- `market-composite` — Market composite (VIX, oil, gold, DXY)
- `derived-market-analytics` — Derived metrics (Gold/Oil, Copper/Gold)
- `energy-market-intelligence` — Energy markets
- `prediction-markets` — Prediction markets
- `stablecoin-monitor` — Stablecoins
- `etf-flow-analysis` — ETF flows
- `fx-reserves-monitor` — FX reserves
- `tick-data-analyzer` — Tick data

**Specialists (specialist) — continued:**
- `sanctions-pressure` — Sanctions pressure
- `political-stability-monitor` — Political stability
- `food-security-monitor` — Food security

**Space (space):**
- `satellite-analyzer` — Satellite analysis

### How Analytics Work

1. **Collection** — collectors (`scripts/collectors/`) put data into basket `data/basket/`
2. **Computation** — analyzers (`scripts/analyzers/`) read basket + references, compute indices, write to `data/analytics/{category}/`
3. **Serving** — API modules (`apis/sources/{name}-api.mjs`) read results, serve via `/api/layers/{name}`
4. **Display** — map layer (`dashboard/public/geo-map/js/layers.js`) shows the result

### Structure of `data/analytics/`

```
data/analytics/
├── _manifest.json     # registry of all analyzers
├── _catalog.json      # class catalog
├── _lineage.json      # data lineage
├── _health.json       # health status
├── _schema.json       # schema
├── index/             # indices
├── detector/          # detectors
├── forecast/          # forecasts
├── semantic/          # semantics
├── flow/              # flows
├── market/            # markets
├── specialist/        # specialists
└── space/             # space
```

### Running an Analyzer

```bash
# One analyzer
node scripts/analyzers/resilience-index.mjs

# All analyzers (manual)
for f in scripts/analyzers/*.mjs; do node "$f"; done

# Full cycle: collect → analyze → serve
node scripts/collectors/collect-worldbank.mjs
node scripts/analyzers/strategic-risk-composite.mjs
curl http://localhost:3117/api/layers/strategic-risk-composite/stats
```

---

## 🏗️ Infrastructure Analyzer

**Infrastructure Cascade** — the most complex analyzer in Crucix. Consists of **13 files** and serves **15 endpoints**.

### Files

**Block A (core):**
- `infrastructure-graph-core.mjs` — graph, haversine
- `infrastructure-propagation.mjs` — cascading propagation
- `infrastructure-pagerank-critical.mjs` — PageRank, betweenness
- `infrastructure-temporal.mjs` — temporal decay

**Block B (computation):**
- `infrastructure-vulnerability-calc.mjs` — adaptive vulnerability calculation
- `infrastructure-monte-carlo.mjs` — Monte Carlo, sensitivity
- `infrastructure-scenario-engine.mjs` — 8 scenarios (Hormuz, Taiwan, NPP...)

**Block C (monitoring):**
- `infrastructure-military-monitor.mjs` — military bases
- `infrastructure-chokepoint-monitor.mjs` — straits, canals
- `infrastructure-nuclear-monitor.mjs` — NPPs
- `infrastructure-supply-chain.mjs` — HHI concentration
- `infrastructure-cargo-anomaly.mjs` — cargo anomalies

**+ `infrastructure-api.mjs`** — HTTP handler

### Infrastructure Objects

`data/infrastructure/objects.json` — **114 objects:**

- 25 military bases (USA, Russia, China, NATO)
- 20 nuclear power plants (Zaporizhzhia, Fukushima, Bushehr, Akkuyu...)
- 26 ports (Shanghai, Singapore, Rotterdam...)
- 15 chokepoints (Hormuz, Suez, Taiwan, Bab-el-Mandeb...)
- 15 dams (Three Gorges, Itaipu, Kakhovka...)
- 13 power grids (East China, ERCOT, Ukrenergo...)

### 15 Endpoints

```
GET /api/layers/infrastructure-api                    — root
GET /api/layers/infrastructure-api/vulnerability      — vulnerability
GET /api/layers/infrastructure-api/cascade            — cascade
GET /api/layers/infrastructure-api/simulate           — simulation
GET /api/layers/infrastructure-api/critical-paths     — critical paths
GET /api/layers/infrastructure-api/pagerank           — PageRank
GET /api/layers/infrastructure-api/sensitivity        — sensitivity
GET /api/layers/infrastructure-api/featurecollection  — GeoJSON
GET /api/layers/infrastructure-api/stats              — statistics
GET /api/layers/infrastructure-api/military           — military objects
GET /api/layers/infrastructure-api/chokepoints        — chokepoints
GET /api/layers/infrastructure-api/nuclear            — NPPs
GET /api/layers/infrastructure-api/supply-chain       — supply chains
GET /api/layers/infrastructure-api/cargo-anomalies    — anomalies
GET /api/layers/infrastructure-api/scenarios          — scenarios
```

### Key Results

- **PageRank → chokepoint-taiwan** (most connected node)
- **Top bottleneck → chokepoint-malacca**
- **Vulnerability max → npp-zaporizhzhia**
- **Sensitivity → exposure** (most influential factor)
- **Scenario Taiwan-blockade → 3 nodes affected**
- **Scenario Hormuz-closure → 5 nodes affected**

---

## 🔀 Router v3.1 — Mechanism A+B

**Router** (`server/router.mjs`) — a key component. Determines which module handles a request.

### 4 Lookup Mechanisms

**1. Mechanism A (priority) — `export const route`:**

An API module declares its own prefix:
```javascript
export const route = '/api/layers/infrastructure-api';
export default handleInfrastructureAPI;
```

Router reads `module.route` on module load and registers it in `modulePrefixCache`. All subsequent requests to `/api/layers/infrastructure-api/*` are served **in microseconds** from cache.

**2. routes-api.json — exact match:**

Entry `{ path: '/api/layers/country-instability', module: 'country-instability-api' }`. Works for legacy modules.

**3. routes-api.json — wildcard:**

Entry `{ path: '/api/layers/infrastructure-api/*', module: 'infrastructure-api' }`. Works as fallback.

**4. Mechanism B — auto-prefix:**

If a file in `apis/sources/` is named `{name}-api.mjs` — automatically accessible via `/api/layers/{name}/*`. For 300+ legacy modules.

### Lookup Priority

1. `modulePrefixCache` (Mechanism A) — fastest
2. `routes-api.json (exact)` — exact match
3. `routes-api.json (wildcard)` — with `*`
4. `autoPrefixCache` (Mechanism B) — by filename

### For Developers

**New API module** — recommended to add `export const route` (Mechanism A):

```javascript
// apis/sources/my-module-api.mjs
export const route = '/api/layers/my-module';

export default async function handler(req, res) {
  // ...
}
```

**No longer need** to add a record in `routes-api.json` manually. The module registers itself.

---

## 🧪 AI Laboratory

The AI Laboratory is an environment where a local LLM (Ollama) becomes an active participant in analysis.

### Components

- **Ollama** — `http://localhost:11434`, models: llama3.1:8b, mistral:7b, phi3:3.8b
- **AI Gateway** — `apis/sources/ai-gateway.mjs`
- **RAG module** — `apis/sources/rag-module/`, port 3120
- **AI Chat** — `http://localhost:8080`

### AI Laboratory Pipeline

1. **Data collection** → `data/basket/*.json`
2. **Analyzer computation** → `data/analytics/{category}/*.json`
3. **Serving via API** → `GET /api/layers/{name}`
4. **AI forecasting** → `data/analytics/forecast/*.json`
5. **Brief generation** → `daily-briefing.mjs` via Ollama
6. **Semantic search** → RAG module on port 3120

### AI Modules

- **ai-news-synthesis** — news synthesis via LLM
- **ai-forecasts** — probabilistic forecast
- **social-briefing** — 3 brief formats (daily, alert, summary)
- **daily-briefing.mjs** — daily digest

---

## 🔑 API Keys

Crucix **runs without API keys** — only open sources are used. Project rule (12.2): no registrations, keys, or OAuth.

### Open Sources (no keys)

- **USGS Earthquakes** — earthquakes
- **NOAA SWPC** — space weather
- **OpenSky Network** — aircraft (anonymous)
- **Open-Meteo** — weather
- **Where the ISS at** — ISS
- **Launch Library 2** — space launches
- **Frankfurter** — ECB FX rates
- **Hacker News** — top news
- **mledoze/countries** — 250 countries reference
- **CISA KEV** — vulnerabilities
- **CoinGecko** — crypto
- **US Treasury** — US debt
- **ECB Data Portal** — EU macro
- **World Bank** — macro for 197 countries
- **GDELT** — news (requires browser User-Agent, pause ≥5 sec)

### If a Key Is Needed

One key (may be useful): `OLLAMA_HOST` for an external Ollama. This is local — no registration required.

---

## 🏛️ Architecture

### The "Basket → AI → Map" Principle

```
External API
    ↓
Collector (scripts/collectors/collect-*.mjs)
    ↓
Basket (data/basket/*.json)
    ↓
Analyzer (scripts/analyzers/*.mjs)
    ↓
Analytics (data/analytics/{category}/*.json)
    ↓
API module (apis/sources/*-api.mjs)
    ↓
Map (dashboard/public/geo-map/)
```

### Key Rule

**No module makes fetch calls to external APIs.** All data comes only from the basket. The only exception is collectors, which fill the basket.

### Project Structure

```
Crucix/
├── apis/sources/            # 370+ API modules
├── scripts/
│   ├── collectors/          # collectors to basket
│   └── analyzers/           # analyzers
├── data/
│   ├── basket/              # 226 data files
│   ├── analytics/           # 8 analytics categories
│   ├── infrastructure/      # 114 objects
│   ├── reference/           # references (197 countries, Gini)
│   └── geo/                 # world.geojson, country-coords
├── server/                  # server modules
│   ├── router.mjs           # router v3.1
│   ├── loader.mjs           # module loader
│   ├── modules.json         # 370+ modules
│   ├── routes-api.json      # legacy routes
│   └── server.mjs           # entry point
├── dashboard/public/        # pages and geo-map
├── docs/help/               # help files ru/en
├── ai-memory-sync/          # AI memory files
└── logs/collectors/         # collector logs
```

---

## 🧩 Modular Server Architecture

All server files are in `server/`:

- `server.mjs` — entry point (30 lines)
- `router.mjs` — API router (Mechanism A+B)
- `loader.mjs` — module loader from `modules.json`
- `api.mjs` — API routes (registry, etc.)
- `pages.mjs` — page routes
- `utils.mjs` — utilities (`sendJSON`, `sendError`)
- `config.mjs` — port, MIME types
- `static.mjs` — static file serving
- `modules.json` — API module registry (370+)
- `routes-api.json` — API routes (legacy)
- `pages.json` — page registry
- `routes-pages.json` — page routes

---

## 🗺️ Geopolitical Map (geo-map)

Main file: `dashboard/public/geo-map.html`.

Scripts in `dashboard/public/geo-map/js/`:

- `core.js` — map core
- `countries.js` — country data
- `layers.js` — **237 layers**, 16 categories
- `markers.js` — markers
- `map-controls.js` — map controls (markers / choropleth / heatmap)
- `copy-data.js` — COPY button
- `heat-timeline.js` — heatmap and timeline
- `ssi.js` — tension index
- `refresh.js` — auto-refresh
- `logger.js` — logging
- `init.js` — initialization

### How to Add a Layer

1. Create API module in `apis/sources/{id}-api.mjs` with `export const route`
2. Create analyzer in `scripts/analyzers/{id}.mjs` (if needed)
3. Add layer to `layers.js` (array `DEMO_LAYERS`)
4. Restart the server

See more in `docs/help/ru/layers/`.

---

## 📡 Data Sources

226 files in `data/basket/`. Key files:

### Geopolitics and Conflicts
- `acled.json` — armed conflicts
- `gdelt.json` — news and events
- `ucdp-latest.json` — UCDP data
- `conflict-zone.json` — conflict zones

### Military
- `military-bases.json` — military bases
- `military-exercises.json` — exercises
- `military-spending.json` — spending
- `nuclear-monitor.json` — nuclear monitoring

### Economy and Markets
- `worldbank-latest.json` — 194 countries from World Bank
- `coingecko-latest.json` — crypto
- `fred.json` — macro (ECB + Treasury + WB)
- `fx-rates.json` — FX rates (Frankfurter)
- `vix.json`, `gold.json`, `oil.json`, `dxy.json` — market indicators
- `treasury-debt.json` — US debt

### Natural Phenomena
- `earthquakes.json` — earthquakes (USGS)
- `firms.json` — fires (NASA FIRMS)
- `noaa.json` — space weather
- `open-meteo.json` — weather (10 cities)
- `wildfires.json` — wildfires

### Space
- `satellites.json` — satellites
- `iss-live.json` — ISS live
- `launches-upcoming.json` — upcoming launches
- `space-debris.json` — space debris

### Infrastructure
- `data/infrastructure/objects.json` — **114 objects**

### References
- `data/reference/country-characteristics.json` — **197 countries**
- `data/reference/gini-index.json` — **147 countries with Gini**
- `data/reference/country-aliases.json` — 152 aliases
- `data/reference/rest-countries.json` — 250 countries (mledoze)

### Technology and Cybersecurity
- `cisa-kev.json` — known exploited vulnerabilities
- `cve.json` — CVE
- `botnets.json` — botnets
- `ransomware.json` — ransomware

### Other
- `hackernews-top.json` — HN
- `cables_24.json` — submarine cables
- `pipelines_24.json` — pipelines
- `datacenters.json` — data centers

---

## 📜 npm Scripts

```bash
npm run dev              # start server (port 3117)
npm run collect          # run all collectors
npm run analyze          # run all analyzers
npm run daily-briefing   # generate daily briefing
npm run registry         # generate registry
```

---

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env`. Main variables:

- `PORT` — server port (default 3117)
- `OLLAMA_HOST` — Ollama URL (default `http://localhost:11434`)
- `TELEGRAM_BOT_TOKEN` — bot token (optional)
- `DISCORD_WEBHOOK_URL` — Discord webhook (optional)

### Important

**Crucix runs without API keys.** All sources are open. If a key is needed — it's not in the project, use alternatives.

---

## 🔌 API Endpoints

### Core

- `GET /api/registry/` — module registry
- `GET /api/geo/markers` — map markers
- `GET /api/geo/status` — status
- `GET /api/layers` — layer list

### Analytics (new)

**Indices:**
- `GET /api/layers/country-instability/stats`
- `GET /api/layers/resilience-index/stats`

**Composites:**
- `GET /api/layers/strategic-risk-composite/stats`
- `GET /api/layers/strategic-risk-composite/top?n=10`
- `GET /api/layers/strategic-risk-composite/bottom?n=10`

**Infrastructure:**
- `GET /api/layers/infrastructure-api/stats`
- `GET /api/layers/infrastructure-api/military`
- `GET /api/layers/infrastructure-api/nuclear`
- `GET /api/layers/infrastructure-api/chokepoints`
- `GET /api/layers/infrastructure-api/scenarios`
- ...and 10 more endpoints

**Markets:**
- `GET /api/layers/market-composite/score`
- `GET /api/layers/derived-market-analytics/stats`
- `GET /api/layers/energy-market-intelligence/stats`

**Forecasts:**
- `GET /api/layers/conflict-escalation-tracker/stats`
- `GET /api/layers/social-briefing/text`
- `GET /api/layers/ai-forecasts/stats`

**Detectors:**
- `GET /api/layers/geo-convergence/stats`
- `GET /api/layers/threat-classification/stats`
- `GET /api/layers/surge-detection/stats`
- `GET /api/layers/focal-point-detection/stats`

**Semantics:**
- `GET /api/layers/adaptive-news-clustering/stats`
- `GET /api/layers/ai-news-synthesis/stats`
- `GET /api/layers/entity-extraction/stats`
- `GET /api/layers/source-credibility/stats`

**Flows:**
- `GET /api/layers/cross-stream-correlation/stats`
- `GET /api/layers/route-explorer/stats`
- `GET /api/layers/tanker-fleet-monitor/stats`
- `GET /api/layers/arms-transfer-tracker/stats`

**Specialists:**
- `GET /api/layers/sanctions-pressure/stats`
- `GET /api/layers/political-stability-monitor/stats`
- `GET /api/layers/food-security-monitor/stats`

**System:**
- `GET /api/layers/mcp-server/stats`
- `GET /api/layers/crucix-doctor/stats`
- `GET /api/layers/module-registration-controller/stats`
- `GET /api/layers/watchdog/stats`

---

## 🔧 Troubleshooting

### Server Doesn't Start

- Check `node --version` — Node 22+ required
- Check `npm install`
- Check log `/tmp/crucix-server.log`

### Analyzer Doesn't Work

- `node scripts/analyzers/{name}.mjs` — check output
- `curl http://localhost:3117/api/layers/{name}/stats` — check endpoint
- Check `data/analytics/{category}/{name}.json` — was the file created

### Collector Returns 0 Data

- Check source availability: `curl {url}`
- Check log `logs/collectors/collect-{name}.log`
- Make sure there's no API key (rule 12.2)

### GDELT Returns 429

- Browser User-Agent required
- Pause ≥5 seconds between requests required
- Timeout ≥30 seconds

---

## 🧩 Extensions

### How to Create a New Analyzer

1. **Computing class** — `apis/sources/{name}.mjs`
   - `export default class {Name}`
   - Method `compute(input)` returns `{ score, components, ... }`

2. **Analyzer** — `scripts/analyzers/{name}.mjs`
   - Imports the class
   - Reads `data/basket/` and `data/reference/`
   - Writes `data/analytics/{category}/{name}.json`
   - In `_meta`: id, category, version, sources, calculator, updated_at, checksum

3. **API module** — `apis/sources/{name}-api.mjs`
   - `export const route = '/api/layers/{name}'`
   - `export default async function handler(req, res)`
   - Reads `data/analytics/{category}/{name}.json`

4. **Registration** — `server/modules.json`:
   ```json
   { "id": "{name}-api", "path": "./apis/sources/{name}-api" }
   ```

5. **Map layer** — `layers.js` (array `DEMO_LAYERS`):
   ```javascript
   { id: '{name}', name: 'Name', color: '#color', icon: '🎯', category: 'category', vizType: 'marker' }
   ```

6. **Restart the server.**

### How to Create a New Collector

1. File `scripts/collectors/collect-{name}.mjs`
2. Import from an open API (no key)
3. Save to `data/basket/{name}.json`
4. Log to `logs/collectors/collect-{name}.log`
5. Register in cron

---

## 💬 AI Chat

AI Chat runs via local Ollama.

### Installing Ollama

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Download a model
ollama pull llama3.1:8b

# 3. Start Ollama
ollama serve &

# 4. Open AI Chat
open http://localhost:3117/ai-chat
```

### Prompts

AI Chat uses analyzer data as context. The model answers questions about:
- Current geopolitical situation
- Country risks
- Market indicators
- Infrastructure threats
- Forecasts

---

## 🤝 Contributing

Welcome:

1. **New analyzers** — per the reference (class → analyzer → API → layer)
2. **New collectors** — only open APIs (no keys)
3. **New references** in `data/reference/`
4. **Improvements** to existing modules
5. **Help files in two languages** (ru + en)

### Rules

- Follow the "Basket → AI → Map" architecture
- Don't use API keys (rule 12.2)
- Write help files in ru + en
- Don't delete existing modules (rule 7.6)

---


## 🧠 Crucix Predictive Core

Since 18.09.2026 the project includes a **predictive core** — a 16-phase pipeline (A–R, S, T, U, Z) of 22 modules built on 30 scientific disciplines.

### Key Facts

- **Engine**: `apis/predict/engine.mjs` v8.0.0 — 16-phase pipeline.
- **22 modules**: Bayesian core, Naive Bayes, Markov chains, Monte Carlo, time series, Brier calibration, cascade chains, ensemble, LLM agents, Hawkes process, HMM, Kalman filter, Ising model, transfer entropy, SIR/SEIR, EVT, Ornstein-Uhlenbeck, copulas, BOCPD, Particle Filter, MLP, GCN+DQN.
- **Sources**: `apis/predict/sources/` — prediction_markets (Polymarket/Metaculus/Kalshi/Manifold), multilang (100+ languages), satellite (Sentinel-2/Landsat/SAR).
- **Knowledge graph**: `apis/knowledge/graph.mjs`.
- **New pages**: /cockpit, /agent, /hypergraph, /plugins, /realtime, /advanced, /attention, /coevolution, /crucix, /predictions_composite.
- **Plugins**: `plugins/` — loader, sandbox, hooks, registry, manifest_schema.
- **Integrations**: `integrations/` — Slack, Notion, Obsidian, RSS, Email, Webhook.
- **Observability**: `observability/` — OpenTelemetry, Prometheus, Grafana.
- **Tests**: `tests/` — 42 files (unit, property, fuzz, mutation, integration, chaos, load). Smoke test: 22/22 OK.
- **Deployment**: `docker/` — Dockerfile.engine + docker-compose.engine.yml. `k8s/` — 11 manifests.
- **Docs**: `docs/handbook/` — 800+ page handbook, `docs/help/ru` and `docs/help/en` — module references.

### Running Tests

```bash
npm run test:all-modules       # smoke test of 22 modules
npm run test:unit              # unit tests
npm run test:integration       # integration tests
npm run test:property          # property-based tests
npm run test:fuzz              # fuzz tests
npm run test:mutation          # mutation tests
```

---

## 📜 License

AGPLv3. See `LICENSE`.

---

**Crucix** — your personal intelligence center. 226 sources. 59 analyzers. One command. Zero cloud.