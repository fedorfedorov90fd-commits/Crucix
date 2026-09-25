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
13. [🧭 Polarity and Narrative Comparison System](#-polarity-and-narrative-comparison-system)
14. [Data Sources](#-data-sources)
15. [npm Scripts](#-npm-scripts)
16. [Configuration](#-configuration)
17. [API Endpoints](#-api-endpoints)
18. [Troubleshooting](#-troubleshooting)
19. [Extensions](#-extensions)
20. [AI Chat](#-ai-chat)
21. [Contributing](#-contributing)
22. [🧠 Crucix Predictive Core](#-crucix-predictive-core)
23. [📰 SmartScroll — RSS and Telegram Integration](#-smartscroll--rss-and-telegram-integration)
24. [License](#-license)

## 🚀 Description

**Crucix** is a platform for collecting, analyzing, and visualizing open source data. It is designed for real-time monitoring of geopolitical, economic, military, and environmental situations.

The architecture follows the principle **"Basket → AI → Map"**:

- **Collection** — data arrives from 226 sources into the basket (`data/basket/`)
- **Analysis** — 59 analyzers compute indices, composites, forecasts (`data/analytics/`)
- **AI** — local LLM (Ollama) generates briefs and forecasts
- **Map** — results are visualized on the geo-map (3D WebGL Globe + 2D D3 Map + Leaflet)

### Key Features

- ✅ **226 OSINT sources** — satellites, aviation, conflicts, economy, ecology
- ✅ **59 analyzers** — indices, detectors, forecasts, composites
- ✅ **370+ API modules** — all endpoints read data from the basket
- ✅ **8 analytics categories** — index, detector, forecast, semantic, flow, market, specialist, space
- ✅ **3D WebGL Globe** + 2D map with 9 marker types
- ✅ **Leaflet map** with 237 layers, heat map, and timeline
- ✅ **Infrastructure Analyzer** — 114 objects, 15 endpoints
- ✅ **Auto-refresh** every 15 minutes via SSE
- ✅ **Telegram + Discord bots** with two-way control
- ✅ **AI analytics** via Ollama (local, no cloud)
- ✅ **Modular architecture** — easy to extend
- ✅ **Zero cloud, zero telemetry, zero subscriptions**

> **Live website:** [https://www.crucix.live/](https://www.crucix.live/)

---

## 📸 Screenshots

| | |
|-|-|
|![image](docs/dashboard.png)|![image](docs/boot.png)|
|**Main dashboard**|**Loading animation**|

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

# 3. Copy .env template and add API keys
cp .env.example .env

# 4. Start the dashboard
npm run dev
The dashboard opens at http://localhost:3117

If npm run dev does not work, run directly:

bash
node --trace-warnings server.mjs
Docker
bash
git clone https://github.com/calesthio/Crucix.git
cd Crucix
cp .env.example .env
docker compose up -d
🎯 What You Get
Dashboard
3D WebGL Globe (Globe.gl) with atmosphere and star field

2D map (D3) with 9 marker types

Leaflet map with 237 layers, heat map, and timeline

Animated flight arcs between aviation hubs

Region filters (World, Americas, Europe, Middle East, Asia, Africa)

Real-time market data (indices, crypto, energy, metals)

Analytics
59 analyzers — from base indices to composite risks

197 countries in the characteristics reference

147 countries with real Gini coefficient

194 countries with World Bank macroeconomics

114 critical infrastructure objects (25 military bases, 20 nuclear plants, 26 ports, 15 chokepoints, 15 dams, 13 power grids)

8 analytics categories in data/analytics/

AI Capabilities
Local LLM via Ollama

AI briefs (daily, alert, summary)

Forecasts via AI

Semantic search across news (TF-IDF + cosine similarity)

Entity extraction (NER) from texts

Integrations
Telegram bot (two-way)

Discord bot (two-way)

MCP Server (Model Context Protocol) — access to Crucix from external AI clients

CLI analytics — query analyzers from the terminal

📊 Analytics Platform
Crucix includes a full analytics platform — 59 analyzers from batch №2, split into 8 categories.

Analyzer Categories
Category	Description	Count
index	Indices (country, regional)	2
detector	Event and anomaly detectors	8
forecast	Forecast models	4
semantic	Semantic text analysis	6
flow	Flows (trade, migration, resources)	10
market	Market indicators	7
specialist	Specialized (infra, nuclear, sanctions)	21
space	Space	1
TOTAL		59
Key Analyzers
Indices (index):

country-instability — Country Instability Index (CII). Reference implementation.

resilience-index — Resilience Index (197 countries, 152 unique scores)

Composites (specialist):

strategic-risk-composite — Strategic risk (instability + resilience deficit + infrastructure + geopolitics)

infrastructure-cascade — Infrastructure cascade analysis (13 files, 15 endpoints)

Forecasts (forecast):

conflict-escalation-tracker — Conflict escalation (6 levels)

ai-forecasts — Forecasts via LLM

social-briefing — Briefs via LLM (daily, alert, summary)

central-bank-predictor — Central bank action forecast

Detectors (detector):

geo-convergence — Geographic convergence

threat-classification — Threat classification

surge-detection — Anomaly surges

focal-point-detection — Focal points of activity

baseline-alerting — Threshold alerts

cyber-attack-monitor — Cyber attacks

snapshot-system — State snapshots

pizza-index — Activity near headquarters (internal index)

Semantics (semantic):

adaptive-news-clustering — News clustering (TF-IDF)

ai-news-synthesis — AI news synthesis

entity-extraction — NER

multi-source-corroboration — Fact verification

source-credibility — Source credibility

social-sentiment-analyzer — Social sentiment

Flows (flow):

cross-stream-correlation — Cross-stream correlation

route-explorer — Alternative routes

supply-chain-cascade-engine — Supply chain cascades

supply-chain-resilience — Supply resilience

tanker-fleet-monitor — Tanker fleet (dark vessels)

arms-transfer-tracker — Arms transfers

diplomatic-tracker — Diplomatic activity

migration-flow-tracker — Migration flows

signal-aggregator — Signal aggregation

risk-signal-aggregator — Risk aggregation

Markets (market):

market-composite — Market composite (VIX, oil, gold, DXY)

derived-market-analytics — Derived metrics (Gold/Oil, Copper/Gold)

energy-market-intelligence — Energy markets

prediction-markets — Prediction markets

stablecoin-monitor — Stablecoins

etf-flow-analysis — ETF flows

fx-reserves-monitor — FX reserves

tick-data-analyzer — Tick data

Specialists (specialist) — continued:

sanctions-pressure — Sanctions pressure

political-stability-monitor — Political stability

food-security-monitor — Food security

Space (space):

satellite-analyzer — Satellite analysis

How Analytics Work
Collection — collectors (scripts/collectors/) put data into the basket data/basket/

Computation — analyzers (scripts/analyzers/) read the basket + references, compute indices, write to data/analytics/{category}/

Serving — API modules (apis/sources/{name}-api.mjs) read results, serve via /api/layers/{name}

Display — map layer (dashboard/public/geo-map/js/layers.js) shows the result

Structure of data/analytics/
text
data/analytics/
├── _manifest.json     # registry of all analyzers
├── _catalog.json      # class catalog
├── _lineage.json      # data lineage
├── _health.json       # status
├── _schema.json       # schema
├── index/             # indices
├── detector/          # detectors
├── forecast/          # forecasts
├── semantic/          # semantics
├── flow/              # flows
├── market/            # markets
├── specialist/        # specialists
└── space/             # space
Running an Analyzer
bash
# One analyzer
node scripts/analyzers/resilience-index.mjs

# All analyzers (manual)
for f in scripts/analyzers/*.mjs; do node "$f"; done

# Full cycle: collect → analyze → serve
node scripts/collectors/collect-worldbank.mjs
node scripts/analyzers/strategic-risk-composite.mjs
curl http://localhost:3117/api/layers/strategic-risk-composite/stats
🏗️ Infrastructure Analyzer
Infrastructure Cascade is the most complex analyzer in Crucix. It consists of 13 files and serves 15 endpoints.

Files
Block A (core):

infrastructure-graph-core.mjs — graph, haversine

infrastructure-propagation.mjs — cascade propagation

infrastructure-pagerank-critical.mjs — PageRank, betweenness

infrastructure-temporal.mjs — temporal decay

Block B (computation):

infrastructure-vulnerability-calc.mjs — adaptive vulnerability calculation

infrastructure-monte-carlo.mjs — Monte Carlo, sensitivity

infrastructure-scenario-engine.mjs — 8 scenarios (Hormuz, Taiwan, NPP...)

Block C (monitoring):

infrastructure-military-monitor.mjs — military bases

infrastructure-chokepoint-monitor.mjs — straits, canals

infrastructure-nuclear-monitor.mjs — nuclear plants

infrastructure-supply-chain.mjs — HHI concentration

infrastructure-cargo-anomaly.mjs — cargo anomalies

+ infrastructure-api.mjs — HTTP handler

Infrastructure Objects
data/infrastructure/objects.json — 114 objects:

25 military bases (US, Russia, China, NATO)

20 nuclear plants (Zaporizhzhia, Fukushima, Bushehr, Akkuyu...)

26 ports (Shanghai, Singapore, Rotterdam...)

15 chokepoints (Hormuz, Suez, Taiwan, Bab-el-Mandeb...)

15 dams (Three Gorges, Itaipu, Kakhovka...)

13 power grids (East China, ERCOT, Ukrenergo...)

15 Endpoints
text
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
GET /api/layers/infrastructure-api/chokepoints        — straits
GET /api/layers/infrastructure-api/nuclear            — nuclear plants
GET /api/layers/infrastructure-api/supply-chain       — supply chains
GET /api/layers/infrastructure-api/cargo-anomalies    — anomalies
GET /api/layers/infrastructure-api/scenarios          — scenarios
Key Results
PageRank → chokepoint-taiwan (most connected node)

Top bottleneck → chokepoint-malacca

Vulnerability max → npp-zaporizhzhia

Sensitivity → exposure (most influential factor)

Taiwan-blockade scenario → 3 nodes affected

Hormuz-closure scenario → 5 nodes affected

🔀 Router v3.1 — Mechanism A+B
Router (server/router.mjs) is a key component. It determines which module handles a request.

4 Lookup Mechanisms
1. Mechanism A (priority) — export const route:

An API module declares its own prefix:

javascript
export const route = '/api/layers/infrastructure-api';
export default handleInfrastructureAPI;
Router reads module.route when loading the module and registers it in modulePrefixCache. All subsequent requests to /api/layers/infrastructure-api/* go through the cache in microseconds.

2. routes-api.json — exact match:

Entry { path: '/api/layers/country-instability', module: 'country-instability-api' }. Works for legacy modules.

3. routes-api.json — wildcard:

Entry { path: '/api/layers/infrastructure-api/*', module: 'infrastructure-api' }. Works as fallback.

4. Mechanism B — auto-prefix:

If a file in apis/sources/ is named {name}-api.mjs — it is automatically available via /api/layers/{name}/*. For 300+ legacy modules.

Lookup Priority
modulePrefixCache (Mechanism A) — fastest

routes-api.json (exact) — exact match

routes-api.json (wildcard) — with *

autoPrefixCache (Mechanism B) — by filename

For Developers
New API module — recommended to add export const route (Mechanism A):

javascript
// apis/sources/my-module-api.mjs
export const route = '/api/layers/my-module';

export default async function handler(req, res) {
  // ...
}
No longer needed to add an entry to routes-api.json manually. The module registers itself.

🧪 AI Laboratory
The AI Laboratory is an environment where the local LLM (Ollama) becomes an active participant in analysis.

Components
Ollama — http://localhost:11434, models: llama3.1:8b, mistral:7b, phi3:3.8b

AI Gateway — apis/sources/ai-gateway.mjs

RAG module — apis/sources/rag-module/, port 3120

AI Chat — http://localhost:8080

AI Laboratory Pipeline
Data collection → data/basket/*.json

Analyzer computation → data/analytics/{category}/*.json

API serving → GET /api/layers/{name}

AI forecasting → data/analytics/forecast/*.json

Brief generation → daily-briefing.mjs via Ollama

Semantic search → RAG module on port 3120

AI Modules
ai-news-synthesis — news synthesis via LLM

ai-forecasts — probabilistic forecast

social-briefing — 3 brief formats (daily, alert, summary)

daily-briefing.mjs — daily digest

🔑 API Keys
Crucix works without API keys — only open sources are used. Project rule (12.2): no registrations, keys, OAuth.

Open Sources (no keys)
USGS Earthquakes — earthquakes

NOAA SWPC — space weather

OpenSky Network — aircraft (anonymous)

Open-Meteo — weather

Where the ISS at — ISS

Launch Library 2 — space launches

Frankfurter — ECB FX rates

Hacker News — top news

mledoze/countries — 250-country reference

CISA KEV — vulnerabilities

CoinGecko — crypto

US Treasury — US debt

ECB Data Portal — EU macro

World Bank — macro for 197 countries

GDELT — news (requires browser User-Agent, pause ≥5 sec)

If a Key Is Needed
One key (may be useful): OLLAMA_HOST for external Ollama. This is local — no registration required.

🏛️ Architecture
The "Basket → AI → Map" Principle
text
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
Key Rule
No module fetches from external APIs. All data comes only from the basket. The only exception is collectors that fill the basket.

Project Structure
text
Crucix/
├── apis/sources/            # 370+ API modules
├── scripts/
│   ├── collectors/          # collectors into basket
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
├── docs/help/               # ru/en help
├── ai-memory-sync/          # AI memory files
└── logs/collectors/         # collector logs
🧩 Modular Server Architecture
All server files are in server/:

server.mjs — entry point (30 lines)

router.mjs — API router (Mechanism A+B)

loader.mjs — module loader from modules.json

api.mjs — API routes (registry, etc.)

pages.mjs — page routes

utils.mjs — utilities (sendJSON, sendError)

config.mjs — port, MIME types

static.mjs — static serving

modules.json — API module registry (370+)

routes-api.json — API routes (legacy)

pages.json — page registry

routes-pages.json — page routes

🗺️ Geopolitical Map (geo-map)
Main file: dashboard/public/geo-map.html.

Scripts in dashboard/public/geo-map/js/:

core.js — map core

countries.js — country data

layers.js — 237 layers, 16 categories

markers.js — markers

map-controls.js — map control (markers / choropleth / heatmap)

copy-data.js — COPY button

heat-timeline.js — heat map and timeline

ssi.js — stress index

refresh.js — auto-refresh

logger.js — logging

init.js — initialization

How to Add a Layer
Create an API module in apis/sources/{id}-api.mjs with export const route

Create an analyzer in scripts/analyzers/{id}.mjs (if needed)

Add the layer to layers.js (array DEMO_LAYERS)

Restart the server

More details — in docs/help/ru/layers/.

🧭 Polarity and Narrative Comparison System
Version: 1.0 · Added: 22–23.09.2026

What it is
A system that computes geopolitical polarity from data and compares Russian and Western narratives on a given topic. Not propaganda — comparative framing analysis on observable data.

Key principle: the pole is computed, not assigned by a list. If data changes — the pole changes automatically.

Components
File	Type	Purpose
apis/sources/pole-tracker-api.mjs	API	Computes country polarity from 8 basket indicators
apis/sources/narrative-splitter-api.mjs	API	Compares Russian and Western narratives by topic
apis/sources/source-camps.json	Config	Source mapping and country baselines by pole
dashboard/public/pole-map.html	Page	Pole map: countries, confidence, vectors
dashboard/public/narrative-arena.html	Page	Narrative comparison: Russia / West / Divergences
scripts/snapshot-rsshub.mjs	Script	News history accumulation (systemd timer)
Pages
🌐 Pole Map — http://localhost:3117/pole-map
Shows three poles (russian / western / non_aligned) with countries, polarity index, vectors (sanctions, info-war, military presence), basket status.

⚡ Compare Narratives — http://localhost:3117/narrative-arena
Three columns: Russian narrative / Western narrative / divergences. Presets: sanctions, Ukraine, energy transition, conflict, gas.

API endpoints
bash
# All poles
curl http://localhost:3117/api/layers/pole-tracker

# One country in detail
curl "http://localhost:3117/api/layers/pole-tracker?country=russia"

# Narrative comparison by topic
curl -G http://localhost:3117/api/layers/narrative-splitter \
    --data-urlencode "topic=Ukraine" \
    --data-urlencode "limit=10"

# Detailed output
curl "http://localhost:3117/api/layers/narrative-splitter?topic=sanctions&detail=true"
Terms
Term	Meaning
silence	One side writes (N>0), the other is silent (0). Strongest signal of silencing
framing_gap	Both sides write, but with different framing
double_standard	Coverage imbalance >3x in one direction
polarity_index	0..1: 0 = unipolar world, 1 = maximum polarity
confidence	0..0.98: confidence in country classification
basis	Classification source: baseline_plus_data / data_driven / weak_signals / no_data
History accumulation
Script scripts/snapshot-rsshub.mjs runs on a systemd timer every hour at minute 02:

Refreshes data/basket/rsshub.json via collect-rsshub.mjs

Copies the snapshot to data/analytics/rss-history/rsshub-<timestamp>.json

Maintains the index index.json

Trims the archive to 168 snapshots (7 days)

bash
# Timer management
systemctl --user status crucix-rsshub-snapshot.timer
systemctl --user list-timers crucix-rsshub-snapshot.timer
tail -20 logs/rss-history/systemd.log

# Manual run
node scripts/snapshot-rsshub.mjs
Why: after a week, 84,000 items will accumulate — enough for real co-occurrence analysis of topics (threat inflation, selective framing).

Help files
Full help for each page and module:

data/help/ru/pole-tracker-api.txt — polarity module API

data/help/ru/narrative-splitter-api.txt — comparison module API

data/help/ru/pole-map.txt — pole map page

data/help/ru/narrative-arena.txt — narrative comparison page

data/help/ru/CRUCIX_POLARITY_OVERVIEW.txt — system overview

How to extend
Add a source to a pole:
Edit apis/sources/source-camps.json → media_sources.{pole}.sources. Mapping — by substring in lowercase.

Add an indicator:
Edit apis/sources/source-camps.json → indicators.basket_files. Then add reading in computeCountryVector() in pole-tracker-api.mjs.

Add a country to baseline:
Edit apis/sources/source-camps.json → pole_cores.{pole}.core (or baseline_satellites, affiliated).

Principles
The pole is computed, not assigned. Data changes — the pole changes.

Comparison is symmetric. The system shows divergences on both the Russian and Western sides.

The method is transparent. Anyone can open a basket file and see which records the classification is based on.

This is a tool, not a verdict. The system does not say "who is right" — it shows where the sides diverge.

📡 Data Sources
226 files in data/basket/. Key ones:

Geopolitics and Conflicts
acled.json — armed conflicts

gdelt.json — news and events

ucdp-latest.json — UCDP data

conflict-zone.json — conflict zones

Military
military-bases.json — military bases

military-exercises.json — exercises

military-spending.json — spending

nuclear-monitor.json — nuclear monitoring

Economy and Markets
worldbank-latest.json — 194 World Bank countries

coingecko-latest.json — crypto

fred.json — macro (ECB + Treasury + WB)

fx-rates.json — FX rates (Frankfurter)

vix.json, gold.json, oil.json, dxy.json — market indicators

treasury-debt.json — US debt

Natural Phenomena
earthquakes.json — earthquakes (USGS)

firms.json — fires (NASA FIRMS)

noaa.json — space weather

open-meteo.json — weather (10 cities)

wildfires.json — wildfires

Space
satellites.json — satellites

iss-live.json — ISS live

launches-upcoming.json — upcoming launches

space-debris.json — space debris

Infrastructure
data/infrastructure/objects.json — 114 objects

References
data/reference/country-characteristics.json — 197 countries

data/reference/gini-index.json — 147 countries with Gini

data/reference/country-aliases.json — 152 aliases

data/reference/rest-countries.json — 250 countries (mledoze)

Technology and Cybersecurity
cisa-kev.json — known vulnerabilities

cve.json — CVE

botnets.json — botnets

ransomware.json — ransomware

Other
hackernews-top.json — HN

cables_24.json — submarine cables

pipelines_24.json — pipelines

datacenters.json — data centers

📜 npm Scripts
bash
npm run dev              # start server (port 3117)
npm run collect          # run all collectors
npm run analyze          # run all analyzers
npm run daily-briefing   # generate daily brief
npm run registry         # generate registry
⚙️ Configuration
Environment Variables
Copy .env.example to .env. Key variables:

PORT — server port (default 3117)

OLLAMA_HOST — Ollama URL (default http://localhost:11434)

TELEGRAM_BOT_TOKEN — bot token (optional)

DISCORD_WEBHOOK_URL — Discord webhook (optional)

Important
Crucix works without API keys. All sources are open. If a key is needed — it is not in the project, use alternatives.

🔌 API Endpoints
Core
GET /api/registry/ — module registry

GET /api/geo/markers — map markers

GET /api/geo/status — status

GET /api/layers — layer list

Analytics (new)
Indices:

GET /api/layers/country-instability/stats

GET /api/layers/resilience-index/stats

Composites:

GET /api/layers/strategic-risk-composite/stats

GET /api/layers/strategic-risk-composite/top?n=10

GET /api/layers/strategic-risk-composite/bottom?n=10

Infrastructure:

GET /api/layers/infrastructure-api/stats

GET /api/layers/infrastructure-api/military

GET /api/layers/infrastructure-api/nuclear

GET /api/layers/infrastructure-api/chokepoints

GET /api/layers/infrastructure-api/scenarios

...and 10 more endpoints

Markets:

GET /api/layers/market-composite/score

GET /api/layers/derived-market-analytics/stats

GET /api/layers/energy-market-intelligence/stats

Forecasts:

GET /api/layers/conflict-escalation-tracker/stats

GET /api/layers/social-briefing/text

GET /api/layers/ai-forecasts/stats

Detectors:

GET /api/layers/geo-convergence/stats

GET /api/layers/threat-classification/stats

GET /api/layers/surge-detection/stats

GET /api/layers/focal-point-detection/stats

Semantics:

GET /api/layers/adaptive-news-clustering/stats

GET /api/layers/ai-news-synthesis/stats

GET /api/layers/entity-extraction/stats

GET /api/layers/source-credibility/stats

Flows:

GET /api/layers/cross-stream-correlation/stats

GET /api/layers/route-explorer/stats

GET /api/layers/tanker-fleet-monitor/stats

GET /api/layers/arms-transfer-tracker/stats

Specialists:

GET /api/layers/sanctions-pressure/stats

GET /api/layers/political-stability-monitor/stats

GET /api/layers/food-security-monitor/stats

System:

GET /api/layers/mcp-server/stats

GET /api/layers/crucix-doctor/stats

GET /api/layers/module-registration-controller/stats

GET /api/layers/watchdog/stats

🔧 Troubleshooting
Server Doesn't Start
Check node --version — Node 22+ required

Check npm install

Check log /tmp/crucix-server.log

Analyzer Doesn't Work
node scripts/analyzers/{name}.mjs — check output

curl http://localhost:3117/api/layers/{name}/stats — check endpoint

Check data/analytics/{category}/{name}.json — file created

Collector Returns 0 Data
Check source availability: curl {url}

Check log logs/collectors/collect-{name}.log

Ensure no API key is required (rule 12.2)

GDELT Returns 429
Browser User-Agent required

Pause ≥5 seconds between requests required

Timeout ≥30 seconds

🧩 Extensions
How to Create a New Analyzer
Calculator class — apis/sources/{name}.mjs

export default class {Name}

Method compute(input) returns { score, components, ... }

Analyzer — scripts/analyzers/{name}.mjs

Imports the class

Reads data/basket/ and data/reference/

Writes data/analytics/{category}/{name}.json

In _meta: id, category, version, sources, calculator, updated_at, checksum

API module — apis/sources/{name}-api.mjs

export const route = '/api/layers/{name}'

export default async function handler(req, res)

Reads data/analytics/{category}/{name}.json

Registration — server/modules.json:

json
{ "id": "{name}-api", "path": "./apis/sources/{name}-api" }
Map layer — layers.js (array DEMO_LAYERS):

javascript
{ id: '{name}', name: 'Title', color: '#color', icon: '🎯', category: 'category', vizType: 'marker' }
Restart the server.

How to Create a New Collector
File scripts/collectors/collect-{name}.mjs

Import from an open API (no key)

Save to data/basket/{name}.json

Log to logs/collectors/collect-{name}.log

Register in cron

💬 AI Chat
AI Chat works via local Ollama.

Installing Ollama
bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Download a model
ollama pull llama3.1:8b

# 3. Start Ollama
ollama serve &

# 4. Open AI Chat
open http://localhost:3117/ai-chat
Prompts
AI Chat uses analyzer data as context. The model answers questions about:

Current geopolitical situation

Country risks

Market indicators

Infrastructure threats

Forecasts

🤝 Contributing
Welcome:

New analyzers — by the reference (class → analyzer → API → layer)

New collectors — open APIs only (no keys)

New references in data/reference/

Improvements to existing modules

Help files in two languages (ru + en)

Rules
Follow the "Basket → AI → Map" architecture

Do not use API keys (rule 12.2)

Write help in ru + en

Do not delete existing modules (rule 7.6)

🧠 Crucix Predictive Core
Since 18.09.2026 the project has integrated a predictive core — a 16-phase pipeline (A–R, S, T, U, Z) of 22 modules operating on 30 scientific disciplines.

Key Facts
Engine apis/predict/engine.mjs v8.0.0 — 16-phase pipeline.

22 modules of the predictive core: Bayesian core, naive Bayes, Markov chains, Monte Carlo, time series, Brier calibration, cascade chains, ensemble, LLM agents, Hawkes process, HMM, Kalman filter, Ising, transfer entropy, SIR/SEIR, EVT, Ornstein-Uhlenbeck, copulas, BOCPD, Particle Filter, MLP, GCN+DQN.

Sources: apis/predict/sources/ — prediction_markets (Polymarket/Metaculus/Kalshi/Manifold), multilang (100+ languages), satellite (Sentinel-2/Landsat/SAR).

Knowledge graph: apis/knowledge/graph.mjs.

New pages: /cockpit, /agent, /hypergraph, /plugins, /realtime, /advanced, /attention, /coevolution, /crucix, /predictions_composite.

Plugins: plugins/ — loader, sandbox, hooks, registry, manifest_schema.

Integrations: integrations/ — Slack, Notion, Obsidian, RSS, Email, Webhook.

Observability: observability/ — OpenTelemetry, Prometheus, Grafana.

Tests: tests/ — 42 files (unit, property, fuzz, mutation, integration, chaos, load). Smoke test: 22/22 OK.

Deployment: docker/ — Dockerfile.engine + docker-compose.engine.yml. k8s/ — 11 manifests.

Documentation: docs/handbook/ — 800+ page book, docs/help/ru and docs/help/en — help files.

Running Tests
bash
npm run test:all-modules       # smoke test of 22 modules
npm run test:unit              # unit tests
npm run test:integration       # integration
npm run test:property          # property-based
npm run test:fuzz              # fuzz tests
npm run test:mutation          # mutation
📰 SmartScroll — RSS and Telegram Integration
Since 24.09.2026 the project has integrated SmartScroll 1.0.0 — a package for collecting, deduplicating, clustering, and summarizing news streams from RSS and Telegram. The output — stories, timelines, and summaries embedded into the Crucix knowledge graph.

Key Facts
Package: apis/sources/smartscroll* — 16 modules, 3 operating modes (external / local / auto).

Collectors: RSS 2.0 + Atom and public Telegram channels via t.me/s/ — without API keys and tokens.

Deduplication: 4 levels — content hash, entity signature, Jaccard shingles, TF-IDF cosine.

Clustering: inverted index on entities — candidate lookup in O(1) instead of O(N).

Summarization: extractive (TF-IDF + MMR) + abstractive via local Ollama with automatic fallback.

HTTP server: 8 endpoints on port 3157 (variable SMARTSCROLL_HTTP_PORT).

Metrics: time per cycle stage (collect, normalize, dedup, cluster, summarize, store).

Resilience: rate limiter (token bucket) and circuit breaker in the external adapter.

Date validation: rejects events older than 10 years and future events more than 24 hours ahead.

Package Contents
text
apis/sources/smartscroll-interface.mjs         — common interface (contract v3)
apis/sources/smartscroll.mjs                    — external adapter with rate limiter and circuit breaker
apis/sources/smartscroll-local/index.mjs        — source factory (external / local / auto)
apis/sources/smartscroll-local/engine.mjs       — cycle core with per-stage metrics
apis/sources/smartscroll-local/processing/     — normalization, dedup, clustering, summary, timeline
apis/sources/smartscroll-local/storage/        — JSON file storage for stories
apis/entity-model/story-layer.mjs               — entity model: mapping stories into knowledge graph
apis/ingest/event-ingestion-api.mjs             — SmartScroll HTTP server
scripts/collectors/lib/rss-collector.mjs        — RSS 2.0 + Atom with date validation
scripts/collectors/lib/telegram-collector.mjs   — public Telegram channels reader
scripts/collectors/collect-smartscroll.mjs      — package collector (writes to basket)
config/smartscroll.json                         — package configuration
test/smartscroll/                               — 6 test files (unit + integration)
HTTP Endpoints
text
GET  /health                     — source and graph state
GET  /metrics                    — per-stage performance metrics
GET  /stats                      — stories and events summary
GET  /stories?limit=N&since=ISO  — list of stories
GET  /stories/:id                — story details
GET  /stories/:id/timeline       — story timeline
POST /run                        — ingestion of stories into graph
POST /collect                    — full collection cycle from sources
Running
bash
# Run the collector
cd /home/ta8_/Рабочий\ стол/Crucix && node scripts/collectors/collect-smartscroll.mjs

# Run the SmartScroll HTTP server
cd /home/ta8_/Рабочий\ стол/Crucix && SMARTSCROLL_HTTP_PORT=3157 node apis/ingest/event-ingestion-api.mjs

# Run tests
cd /home/ta8_/Рабочий\ стол/Crucix && node test/smartscroll/run-all.mjs
Metrics
Operating modes: 3 (external / local / auto)

Collectors: 2 (RSS, Telegram)

Deduplication levels: 4

Clustering weights: 3 (entities 0.5, title 0.3, body 0.2)

Summarization methods: 2 (extractive + abstractive)

Entity model node types: 3 (Story, TimelineEvent, Entity)

Edge types: 4 (contains, mentions, related_to, evolves_into)

HTTP endpoints: 8

Tests: 51 (30 unit + 21 integration)

Documentation
Detailed documentation for each module:

Russian: docs/help/ru/modules/smartscroll/ — 17 files, table of contents + 16 module reference files.

English: docs/help/en/modules/smartscroll/ — 17 files, table of contents + 16 module reference files.

Package manifest: MANIFEST-smartscroll.md.

Each help file contains: purpose, location, methods, algorithms, relations with other modules, examples.

📜 License
AGPLv3. See LICENSE.
