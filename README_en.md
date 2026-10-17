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

1. [Overview](#-overview)
2. [Screenshots](#-screenshots)
3. [Quick Start](#-quick-start)
4. [What You Get](#-what-you-get)
5. [Analytics Platform](#-analytics-platform)
6. [Infrastructure Analyzer](#️-infrastructure-analyzer)
7. [Router v3.1 — Mechanism A+B](#-router-v31--mechanism-ab)
8. [Five Crucix Maps — Five Dimensions of Reality](#-five-crucix-maps--five-dimensions-of-reality)
9. [AI Laboratory](#-ai-laboratory)
10. [API Keys](#-api-keys)
11. [Architecture](#-architecture)
12. [Server Module Architecture](#-server-module-architecture)
13. [Polarity System & Narrative Verification](#-polarity-system--narrative-verification)
14. [Data Sources](#-data-sources)
15. [npm Scripts](#-npm-scripts)
16. [Configuration](#-configuration)
17. [API Endpoints](#-api-endpoints)
18. [Troubleshooting](#-troubleshooting)
19. [Extensions](#-extensions)
20. [AI Chat](#-ai-chat)
21. [Contributing](#-contributing)
22. [🧠 Crucix Predictive Core](#-crucix-predictive-core)
23. [📰 SmartScroll — RSS & Telegram Integration](#-smartscroll--rss--telegram-integration)
24. [License](#-license)

---

## 🚀 Overview

**Crucix** is a platform for collecting, analyzing, and visualizing data from open sources. Designed for real-time monitoring of geopolitical, economic, military, and environmental situations.

The architecture follows the **"Basket → AI → Map"** principle:

- **Collection** — data arrives from 226 sources into the basket (`data/basket/`)
- **Analysis** — 59 analyzers compute indices, composites, forecasts (`data/analytics/`)
- **AI** — local LLM (Ollama) generates briefs and forecasts
- **Map** — results are visualized on geographic maps (3D WebGL Globe + 2D D3 Map + Leaflet)

### Key Features

- ✅ **226 OSINT sources** — satellites, aviation, conflicts, economics, ecology
- ✅ **59 analyzers** — indices, detectors, forecasts, composites
- ✅ **370+ API modules** — all endpoints pull data from the basket
- ✅ **8 analytics categories** — index, detector, forecast, semantic, flow, market, specialist, space
- ✅ **5 autonomous maps** — Event, Metrics, Semantic, Forecast, Network (222 layers total)
- ✅ **3D WebGL globe** + 2D map with 9 marker types
- ✅ **Infrastructure analyzer** — 114 objects, 15 endpoints
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
|**Main dashboard**|**Boot animation**|

| |
|-|
|![image](docs/map.png)|
|**2D map with markers**|

| |
|-|
|![image](docs/globe.png)|
|**3D WebGL globe**|

---

## ⚡ Quick Start

### Local Launch

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

- **3D WebGL globe** (Globe.gl) with atmosphere and starfield
- **2D map** (D3) with 9 marker types
- **5 autonomous maps** with 222 layers total, heatmap and timeline
- **Animated flight arcs** between aviation hubs
- **Region filters** (World, Americas, Europe, Middle East, Asia, Africa)
- **Real-time market data** (indices, crypto, energy, metals)

### Analytics

- **59 analyzers** — from basic indices to composite risks
- **197 countries** in the characteristics reference
- **147 countries** with real Gini coefficient
- **194 countries** with World Bank macroeconomics
- **114 critical infrastructure objects** (25 military bases, 20 nuclear plants, 26 ports, 15 chokepoints, 15 dams, 13 power grids)
- **8 analytics categories** in `data/analytics/`

### AI Capabilities

- **Local LLM** via Ollama
- **AI briefs** (daily, alert, summary)
- **Forecasts** via AI
- **Semantic search** through news (TF-IDF + cosine similarity)
- **Entity extraction** (NER) from texts

### Integrations

- **Telegram bot** (two-way)
- **Discord bot** (two-way)
- **MCP Server** (Model Context Protocol) — access Crucix from external AI clients
- **CLI analytics** — query analyzers from terminal

---

## 📊 Analytics Platform

Crucix includes a **full analytics platform** — 59 analyzers divided into **8 categories**.

### Analyzer Categories

| Category | Description | Count |
|---|---|---|
| **index** | Indices (country, regional) | 2 |
| **detector** | Event and anomaly detectors | 8 |
| **forecast** | Predictive models | 4 |
| **semantic** | Semantic text analysis | 6 |
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
- `infrastructure-cascade` — Cascade infrastructure analysis (13 files, 15 endpoints)

**Forecasts (forecast):**
- `conflict-escalation-tracker` — Conflict escalation (6 levels)
- `ai-forecasts` — LLM-based forecasts
- `social-briefing` — LLM briefs (daily, alert, summary)
- `central-bank-predictor` — Central bank action forecasts

**Detectors (detector):**
- `geo-convergence` — Geographic convergence
- `threat-classification` — Threat classification
- `surge-detection` — Anomaly surges
- `focal-point-detection` — Focal points of activity
- `baseline-alerting` — Threshold alerts
- `cyber-attack-monitor` — Cyber attacks
- `snapshot-system` — State snapshots
- `pizza-index` — Activity near headquarters (internal index)

**Semantics (semantic):**
- `adaptive-news-clustering` — News clustering (TF-IDF)
- `ai-news-synthesis` — AI news synthesis
- `entity-extraction` — NER
- `multi-source-corroboration` — Fact checking
- `source-credibility` — Source credibility
- `social-sentiment-analyzer` — Social media sentiment

**Flows (flow):**
- `cross-stream-correlation` — Cross-correlation of data streams
- `route-explorer` — Alternative routes
- `supply-chain-cascade-engine` — Supply chain cascades
- `supply-chain-resilience` — Supply resilience
- `tanker-fleet-monitor` — Tanker fleet (dark vessels)
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

### How Analysis Works

1. **Collection** — collectors (`scripts/collectors/`) put data into the basket `data/basket/`
2. **Computation** — analyzers (`scripts/analyzers/`) read the basket + references, compute indices, write to `data/analytics/{category}/`
3. **Delivery** — API modules (`apis/sources/{name}-api.mjs`) read results, serve via `/api/layers/{name}`
4. **Display** — a layer on the map (`dashboard/public/{map}/js/layers.js`) shows the result

### `data/analytics/` Structure

```
data/analytics/
├── _manifest.json     # registry of all analyzers
├── _catalog.json      # class catalog
├── _lineage.json      # data provenance
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
```

### Running an Analyzer

```bash
# Single analyzer
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
- `infrastructure-propagation.mjs` — cascade propagation
- `infrastructure-pagerank-critical.mjs` — PageRank, betweenness
- `infrastructure-temporal.mjs` — temporal decay

**Block B (computation):**
- `infrastructure-vulnerability-calc.mjs` — adaptive vulnerability calculation
- `infrastructure-monte-carlo.mjs` — Monte Carlo, sensitivity
- `infrastructure-scenario-engine.mjs` — 8 scenarios (Hormuz, Taiwan, NPP...)

**Block C (monitoring):**
- `infrastructure-military-monitor.mjs` — military bases
- `infrastructure-chokepoint-monitor.mjs` — straits, canals
- `infrastructure-nuclear-monitor.mjs` — nuclear plants
- `infrastructure-supply-chain.mjs` — HHI concentration
- `infrastructure-cargo-anomaly.mjs` — cargo flow anomalies

**+ `infrastructure-api.mjs`** — HTTP handler

### Infrastructure Objects

`data/infrastructure/objects.json` — **114 objects:**

- 25 military bases
- 20 nuclear power plants
- 26 ports (Shanghai, Singapore, Rotterdam...)
- 15 chokepoints (Hormuz, Suez, Taiwan, Bab-el-Mandeb...)
- 15 dams (Three Gorges, Itaipu, Kakhovka...)
- 13 power grids

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
GET /api/layers/infrastructure-api/chokepoints        — straits
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
- **Taiwan blockade scenario → 3 nodes affected**
- **Hormuz closure scenario → 5 nodes affected**

---

## 🔀 Router v3.1 — Mechanism A+B

**Router** (`server/router.mjs`) — key component. Determines which module handles a request.

### 4 Lookup Mechanisms

**1. Mechanism A (priority) — `export const route`:**

API module self-declares its prefix:
```javascript
export const route = '/api/layers/infrastructure-api';
export default handleInfrastructureAPI;
```

Router reads `module.route` on load and registers in `modulePrefixCache`. All subsequent requests to `/api/layers/infrastructure-api/*` go **in microseconds** from cache.

**2. routes-api.json — exact match:**

Entry `{ path: '/api/layers/country-instability', module: 'country-instability-api' }`. Works for legacy modules.

**3. routes-api.json — wildcard:**

Entry `{ path: '/api/layers/infrastructure-api/*', module: 'infrastructure-api' }`. Works as fallback.

**4. Mechanism B — auto-prefix:**

If a file in `apis/sources/` is named `{name}-api.mjs` — automatically available via `/api/layers/{name}/*`. For 300+ legacy modules.

### Lookup Priority

1. `modulePrefixCache` (Mechanism A) — fastest
2. `routes-api.json (exact)` — exact match
3. `routes-api.json (wildcard)` — with `*` support
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

**No longer needed** to manually add an entry to `routes-api.json`. The module self-registers.

---

## 🗺️ Five Crucix Maps — Five Dimensions of Reality

Crucix consists of **5 autonomous maps**, each visualizing its own class of data. This is not an organizational convenience — it's a scientifically grounded decision based on visualization theory.

### Why Five Maps, Not One

The separation follows the principle of **Separation of Concerns** (Dijkstra, 1974) and the theory of **channel separability** (Munzner, 2014). Each data class requires its own visual encoding:

| Data class | Visual channel | Encoding | Capacity |
|---|---|---|---|
| **Events** | Position + Color | Point markers | High for localization |
| **Quantitative metrics** | Position + Color intensity | Choropleth | High for country comparison |
| **Semantics** | Position + Hue + Shape | Categorical color + shape | Medium for typology |
| **Probabilities** | Position + Color intensity + Transparency | Probability fill | Medium for uncertainty |
| **Relations** | Topology (force) + Shape | Force-directed graph | High for structure |

An attempt to combine all of this into a single map would violate the **channel separability principle** (Munzner, 2014, Table 5.3). The user would not be able to simultaneously perceive 5 different encodings without **cognitive interference** — a phenomenon where one channel distorts the perception of another (Ware, 2013, Chapter 6).

### Explanation for Non-Specialists

Imagine an airport. The control tower uses a **radar** (dots for planes), the terminal shows a **departure board** (numbers for flights), passengers read **reviews** (text with sentiment), the weather service provides a **forecast** (probabilities for storms), and the airline's route map shows a **network of connections** (lines between cities).

All five are about the same airport — but mixing them on one screen would create chaos. Each tool is designed for its own data type. Crucix maps work the same way: same world, different lenses.

- **Event Map** = radar: where did something happen right now?
- **Metrics Map** = departure board: what are the numbers for each country?
- **Semantic Map** = reviews: what is the tone of the discussion?
- **Forecast Map** = weather forecast: what is the probability of an event?
- **Network Map** = route map: who is connected to whom?

### The Five Maps

---

#### 1. Event Map (`/event-map/`)

**Purpose:** Visualize discrete events on a geographic map — rallies, attacks, incidents, disasters, cyber attacks, diplomatic events, economic events, terrorist incidents, migration crises, health emergencies, infrastructure failures, social movements.

- **Data model:** point events (lat/lng + type + severity + timestamp + attributes)
- **Visualization:** Leaflet markers with clustering, prioritization, popups with event details
- **Layers:** 84 layers in 12 categories
- **Visual channel:** Position + Color (marker type determines icon and color)
- **Distinguishing feature:** Each point is a separate event, not an aggregate. Thousands of markers per layer. Events have temporal dimension — can be filtered by time range.
- **Folder structure:** `dashboard/public/event-map/` — `index.html`, `js/` (15 files), `css/`, `data/world.geojson`, `presets/`
- **Rendering:** Leaflet + `world.geojson` for boundaries. Markers rendered via `updateMarkers()`. Marker clustering prevents overlap at high zoom.
- **Fallback:** If API returns 404 — deterministic marker generation from `countries.js` (2 markers per country, 180 total per layer). Coordinates = country center + deterministic offset.

**Layer Catalog (84 layers, 12 categories):**

| Category | Layers | Description |
|---|---|---|
| conflicts | 14 | Armed conflicts, border incidents, military clashes, ceasefire violations, artillery strikes, drone attacks, naval incidents, air defense activations, troop movements, proxy attacks, cross-border shelling, military escalations, battlefield reports, combat losses |
| protests | 10 | Mass protests, civil unrest, labor strikes, student demonstrations, opposition rallies, election protests, police crackdowns, anti-government marches, civic mobilization, revolutionary movements |
| disasters | 10 | Earthquakes, floods, wildfires, hurricanes, tsunamis, volcanic eruptions, industrial accidents, chemical spills, nuclear incidents, infrastructure collapses |
| cyber | 8 | Cyber attacks, ransomware campaigns, DDoS attacks, data breaches, supply chain compromises, critical infrastructure intrusions, state-sponsored APT campaigns, zero-day exploits |
| politics | 8 | Elections, government changes, constitutional amendments, political appointments, impeachment proceedings, referendums, party congresses, legislative crises |
| diplomacy | 8 | Diplomatic visits, treaty signings, summit meetings, ambassador recalls, diplomatic expulsions, peace negotiations, alliance formations, bilateral agreements |
| economics | 7 | Sanctions announcements, trade restrictions, currency crises, market crashes, bond defaults, sovereign rating changes, capital controls |
| terrorism | 6 | Terrorist attacks, bombing incidents, hostage situations, terror cell arrests, terror financing disruptions, insurgent operations |
| migration | 5 | Refugee flows, border crossings, migrant crises, displacement waves, asylum processing |
| health | 4 | Epidemic outbreaks, pandemic alerts, vaccination campaigns, health system failures |
| infrastructure | 2 | Power grid failures, transportation disruptions |
| social | 2 | Social media campaigns, information operations |
| **TOTAL** | **84** | |

---

#### 2. Metrics Map (`/metrics-map/`)

**Purpose:** Visualize quantitative indicators by country — economic, financial, ESG, cyber, energy, social, geopolitical, military metrics.

- **Data model:** country aggregates (ISO code + numeric value)
- **Visualization:** Choropleth (color intensity encodes value)
- **Layers:** 75 layers in 13 categories
- **Visual channel:** Position + Color intensity (choropleth)
- **Distinguishing feature:** Each country is an aggregate of a numeric indicator. 90 countries. Classification via Jenks DP, Quantile, Equal Interval, Standard Deviation, or Manual (domain-specific thresholds). GVF quality control (typically 0.90–0.93).
- **Folder structure:** `dashboard/public/metrics-map/` — `index.html`, `js/` (15 files), `css/`, `data/world.geojson`, `presets/`
- **Rendering:** Leaflet + choropleth via `applyChoropleth()`. ColorBrewer palettes (7 sequential, 4 diverging). Legend with class breaks, method, and GVF quality.
- **Fallback:** If API returns 404 — deterministic value generation per country based on `layer.id` seed and country status (critical → higher, normal → lower)

**Layer Catalog (75 layers, 13 categories):**

| Category | Layers | vizType | Key indicators |
|---|---|---|---|
| finance | 26 | 12 choropleth + 8 series + 6 marker | DXY, copper/gold, gold/oil, gold/silver, yield curve, Big Mac, uranium, HY OAS, OVX, S&P/VIX, VXX, crypto fear, WTI/Brent |
| economics | 15 | 11 choropleth + 4 series | PMI, inflation, GDP, unemployment, trade balance, consumer confidence, business optimism, consumer expectations, recession probability, debt/GDP |
| esg | 8 | 8 choropleth | Happiness, population density, refugees, urbanization, WHO health, COVID-19, HDI |
| geopolitical | 6 | 6 choropleth | Social tension, corruption, democracy index, instability, resilience, strategic risk |
| energy | 5 | 4 choropleth + 1 series | EIA, nuclear, renewable, oil/gas, WTI/Brent spread |
| health | 3 | 3 choropleth | WHO health index, COVID-19, medical infrastructure |
| social | 3 | 3 choropleth | Population displacement, refugees, phone activity |
| cyber | 2 | 1 choropleth + 1 series | CVE vulnerabilities, composite cyber threat index |
| military | 2 | 2 choropleth | Military spending, war readiness |
| other | 2 | 2 choropleth | Internet penetration, mobile connectivity |
| threats | 1 | 1 choropleth | CVE vulnerability density |
| intelligence | 1 | 1 choropleth | Behavioral patterns |
| news | 1 | 1 choropleth | Google Trends |
| **TOTAL** | **75** | 56 choropleth + 14 series + 6 marker | |

**Classification Methods (Jenks 1963, Brewer 2005):**

| Method | Formula | Application |
|---|---|---|
| Jenks DP | Minimize SDCM, O(k·n²) | Default |
| Quantile | Equal groups | When outliers present |
| Equal Interval | (max−min)/k | Smooth scales |
| Standard Dev | μ ± 0.5σ, ± 1.5σ | Normal distribution |
| Manual | Expert thresholds | ISM 50, recession 20/40/60/80 |

Quality control: GVF = (SDAM − SDCM) / SDAM > 0.7.

**ColorBrewer Palettes:**

- Sequential (7): Blues, YlOrRd, Greens, Oranges, Purples, BuPu, OrRd
- Diverging (4): RdYlGn5, RdBu5, BrBG5, PiYG5

Domain rules:
- PMI → diverging RdYlGn5, manual breaks [42, 47, 53, 58] (ISM 50 = boundary)
- Recession → sequential YlOrRd5, manual breaks [20, 40, 60, 80]
- Copper/Gold → diverging RdBu5, Jenks
- Yield Curve → diverging RdBu5, Jenks (inversion = red)

---

#### 3. Semantic Map (`/semantic-map/`)

**Purpose:** Visualize semantic text analysis — sentiment, narratives, disinformation, media tone, propaganda, info-war operations, social media dynamics, topic modeling, source credibility, cognitive biases, manipulation tactics, toxicity.

- **Data model:** sentiment scores + categorical clusters (country + sentiment class + cluster type)
- **Visualization:** Choropleth with diverging palette + categorical overlays
- **Layers:** 35 layers in 12 categories
- **Visual channel:** Position + Hue (diverging RdYlGn5 for sentiment) + Shape (Set1 categorical for clusters)
- **Distinguishing feature:** 5 sentiment classes (Cowan, 2001: 4±1 chunk). Categorical color for cluster types. Diverging palette for sentiment polarity — positive sentiment is green, negative is red, neutral is yellow.
- **Folder structure:** `dashboard/public/semantic-map/` — `index.html`, `js/` (15 files), `css/`, `data/world.geojson`, `presets/`
- **Rendering:** Leaflet + choropleth via `sentiment-adapter.js`. Diverging RdYlGn5 for sentiment, OrRd5 for credibility, Set1 (10 colors) for categorical clusters.
- **Fallback:** If API returns 404 — deterministic sentiment generation (5 classes) with sentiment-adapter

**Layer Catalog (35 layers, 12 categories):**

| Category | Layers | Description |
|---|---|---|
| sentiment | 5 | Overall sentiment, social media sentiment, news sentiment, political sentiment, economic sentiment |
| narratives | 4 | Dominant narratives, counter-narratives, narrative momentum, narrative origin |
| disinformation | 4 | Fake news detected, debunked claims, coordinated inauthentic behavior, bot activity |
| media_tone | 3 | Media tone index, editorial bias, coverage intensity |
| propaganda | 3 | State propaganda index, propaganda themes, propaganda reach |
| info_war | 3 | Info-war operations, narrative warfare, cognitive warfare |
| social_media | 3 | Social media activity, engagement patterns, viral content |
| topics | 3 | Trending topics, topic clusters, topic evolution |
| credibility | 2 | Source credibility, fact-check density |
| cognitive_biases | 2 | Confirmation bias index, availability bias index |
| manipulation | 2 | Manipulation tactics, influence operations |
| toxicity | 1 | Toxicity index |
| **TOTAL** | **35** | |

**Sentiment Classification (Cowan, 2001):**

5 classes with diverging RdYlGn5 palette:
- Strongly negative (red, class 1)
- Negative (orange, class 2)
- Neutral (yellow, class 3)
- Positive (light green, class 4)
- Strongly positive (dark green, class 5)

---

#### 4. Forecast Map (`/forecast-map/`)

**Purpose:** Visualize probabilistic forecasts — recession probability, conflict risk, economic risk, geopolitical stability, energy supply disruption, pandemic resurgence, market crash probability, sovereign default risk, currency crisis probability, trade disruption risk, cyber attack probability, migration crisis probability, food insecurity risk, water stress forecast, climate event probability, infrastructure failure probability.

- **Data model:** probability + confidence (country + probability 0–100% + model confidence 0–1)
- **Visualization:** Choropleth with **dual encoding** — color = probability class, transparency = model confidence
- **Layers:** 16 layers, all of type `probability`
- **Visual channel:** Position + Color intensity (probability) + Transparency (confidence). Dual encoding per Cressie (1993).
- **Distinguishing feature:** Unique opacity formula: `opacity = 0.4 + 0.5 × confidence` (Cressie, 1993). Manual breaks [20, 40, 60, 80] with YlOrRd5 palette. Spatial proxies for 4 forecast sources. Low-confidence forecasts are semi-transparent — high-confidence forecasts are opaque.
- **Folder structure:** `dashboard/public/forecast-map/` — `index.html`, `js/` (15 files), `css/`, `data/world.geojson`, `presets/`
- **Rendering:** Leaflet + choropleth via `forecast-adapter.js`. Dual encoding: color (probability class via manual breaks) + opacity (confidence via Cressie formula). Legend shows both probability thresholds and confidence range.
- **Fallback:** If API returns 404 — deterministic probability generation with confidence parameter (probability = base + noise(seed), confidence = 0.5 + noise(seed))

**Layer Catalog (16 layers, all probability type):**

| # | Layer ID | Forecast | Horizon |
|---|---|---|---|
| 1 | recession-probability | Recession probability (model ensemble) | 6 months |
| 2 | conflict-escalation-forecast | Conflict escalation probability | 3 months |
| 3 | sovereign-default-risk | Sovereign default probability | 12 months |
| 4 | currency-crisis-probability | Currency crisis probability | 3 months |
| 5 | trade-disruption-risk | Trade disruption probability | 6 months |
| 6 | energy-supply-risk | Energy supply disruption probability | 6 months |
| 7 | cyber-attack-probability | Major cyber attack probability | 1 month |
| 8 | pandemic-resurgence | Pandemic resurgence probability | 6 months |
| 9 | market-crash-probability | Stock market crash probability | 3 months |
| 10 | political-instability-forecast | Political instability probability | 6 months |
| 11 | migration-crisis-forecast | Migration crisis probability | 6 months |
| 12 | food-insecurity-forecast | Food insecurity probability | 6 months |
| 13 | water-stress-forecast | Water stress probability | 12 months |
| 14 | climate-event-probability | Extreme climate event probability | 12 months |
| 15 | infrastructure-failure-forecast | Critical infrastructure failure probability | 3 months |
| 16 | geopolitical-risk-forecast | Composite geopolitical risk probability | 6 months |
| **TOTAL** | **16** | | |

**Dual Encoding Explained:**

Unlike Metrics Map where color intensity encodes a single value, Forecast Map uses **two visual channels simultaneously**:

1. **Color intensity** → probability class (5 classes via manual breaks at 20, 40, 60, 80)
   - 0–20%: very low (light yellow)
   - 20–40%: low (yellow)
   - 40–60%: moderate (orange)
   - 60–80%: high (dark orange)
   - 80–100%: very high (red)

2. **Transparency** → model confidence
   - opacity = 0.4 + 0.5 × confidence
   - confidence = 0.0 → opacity = 0.4 (semi-transparent, uncertain forecast)
   - confidence = 1.0 → opacity = 0.9 (nearly opaque, confident forecast)

This dual encoding allows the user to immediately see both **what** the forecast says (color) and **how much to trust it** (opacity). A high-probability, low-confidence forecast appears as a washed-out red — visually distinct from a high-probability, high-confidence forecast which appears as a solid red.

---

#### 5. Network Map (`/network-map/`)

**Purpose:** Visualize relational graphs — cyber networks, trade flows, financial connections, migration routes, diplomatic ties, supply chains, arms transfer networks, sanctions networks, energy trade, information flow networks.

- **Data model:** graph (nodes + edges with type and weight)
- **Visualization:** SVG force-directed graph (no Leaflet, no world.geojson)
- **Layers:** 12 layers with 4 node shapes and multiple edge types
- **Visual channel:** Position (force simulation) + Shape (node type) + Edge width (relation strength)
- **Distinguishing feature:** No geographic map. Force simulation: Coulomb repulsion, Hooke attraction, Verlet integration (Barabási, 2016). Dossier panel with graph metrics (Degree, Betweenness, PageRank, Eigenvector centrality).
- **Folder structure:** `dashboard/public/network-map/` — `index.html`, `js/` (15 files), `css/`. **No `data/world.geojson`** — uses SVG, not geographic projection.
- **Rendering:** SVG force-directed graph. Force simulation with charge (Coulomb), link (Hooke), and center forces. Verlet integration for stable physics. Interactive: drag nodes, zoom, pan.
- **Fallback:** If API returns 404 — deterministic graph generation from `countries.js` (nodes = countries, edges = deterministic connections based on geographic proximity and status similarity)

**Layer Catalog (12 layers):**

| # | Layer ID | Node type | Edge type | Description |
|---|---|---|---|---|
| 1 | cyber-network | Country (Circle) | Attack (red arrow) | Cyber attack attribution networks |
| 2 | trade-network | Country (Square) | Trade flow (width = volume) | International trade relationships |
| 3 | financial-network | Country (Circle) | Capital flow (width = amount) | Financial connections and capital flows |
| 4 | migration-network | Country (Triangle) | Migration flow (width = count) | Migration routes and patterns |
| 5 | diplomatic-network | Country (Diamond) | Diplomatic tie (solid line) | Diplomatic recognition and relations |
| 6 | supply-chain-network | Country (Square) | Supply link (width = dependency) | Supply chain dependencies |
| 7 | arms-transfer-network | Country (Triangle) | Transfer (red arrow, width = volume) | Arms trade networks |
| 8 | sanctions-network | Country (Diamond) | Sanction (red dashed) | Sanctions relationship networks |
| 9 | energy-trade-network | Country (Square) | Energy flow (width = volume) | Energy trade relationships |
| 10 | info-flow-network | Country (Circle) | Info flow (blue arrow) | Information dissemination networks |
| 11 | alliance-network | Country (Diamond) | Alliance (solid thick) | Military and strategic alliances |
| 12 | intelligence-network | Country (Triangle) | Intel sharing (dashed) | Intelligence sharing relationships |
| **TOTAL** | **12** | | | |

**Node Shapes (4 types):**
- **Circle** — countries (general actors)
- **Square** — countries (economic actors: trade, supply chain, energy)
- **Triangle** — countries (human actors: migration, arms transfers, intelligence)
- **Diamond** — countries (institutional actors: diplomacy, sanctions, alliances)

**Graph Metrics (Dossier Panel):**

When a node is clicked, the dossier panel shows:
- **Degree** — number of direct connections
- **Betweenness** — how often this node lies on shortest paths between others (Freeman, 1977)
- **PageRank** — importance based on the PageRank algorithm (Page et al., 1999)
- **Eigenvector centrality** — importance based on the importance of neighbors (Bonacich, 1987)
- **Clustering coefficient** — how densely the node's neighbors are interconnected

**Force Simulation Parameters:**
- Charge strength: −300 (Coulomb repulsion)
- Link distance: 80px (Hooke attraction)
- Center force: 0.05 (gravity toward center)
- Alpha decay: 0.0228 (cooling rate)
- Verlet integration (Barabási, 2016, Chapter 4)

---

### Summary Table

| Parameter | Event Map | Metrics Map | Semantic Map | Forecast Map | Network Map |
|---|---|---|---|---|---|
| **URL** | `/event-map/` | `/metrics-map/` | `/semantic-map/` | `/forecast-map/` | `/network-map/` |
| **Layers** | 84 | 75 | 35 | 16 | 12 |
| **Categories** | 12 | 13 | 12 | 1 | 1 |
| **Data class** | Events | Metrics | Semantics | Probabilities | Relations |
| **Data model** | Point features | Country aggregates | Country + sentiment | Country + probability | Graph (nodes + edges) |
| **Visual type** | Markers | Choropleth | Choropleth + categorical | Probability fill | Force graph |
| **Leaflet** | Yes | Yes | Yes | Yes | No (SVG) |
| **world.geojson** | Yes | Yes | Yes | Yes | No |
| **Adapter** | — | series-adapter | sentiment-adapter | forecast-adapter | network-adapter |
| **Classification** | Priority | Jenks/Manual | Sentiment (5 classes) | Manual breaks | Graph metrics |
| **Color palette** | By type | ColorBrewer seq/div | RdYlGn5 + Set1 | YlOrRd5 | By node/edge type |
| **Opacity encoding** | — | — | — | 0.4 + 0.5×confidence | — |
| **Fallback** | 180 markers/layer | 90 countries | 5 sentiment classes | Probability + confidence | Generated graph |
| **JS files** | 15 | 15 | 15 | 15 | 15 |
| **Total** | **222 layers across 5 maps** | | | | |

---

### Detailed Layer Catalogs

#### Event Map — All 84 Layer IDs

**Conflicts (14):**
`armed-conflict`, `border-incident`, `military-clash`, `ceasefire-violation`, `artillery-strike`, `drone-attack`, `naval-incident`, `air-defense-activation`, `troop-movement`, `proxy-attack`, `cross-border-shelling`, `military-escalation`, `battlefield-report`, `combat-losses`

**Protests (10):**
`mass-protest`, `civil-unrest`, `labor-strike`, `student-demonstration`, `opposition-rally`, `election-protest`, `police-crackdown`, `anti-government-march`, `civic-mobilization`, `revolutionary-movement`

**Disasters (10):**
`earthquake-event`, `flood-event`, `wildfire-event`, `hurricane-event`, `tsunami-event`, `volcanic-eruption`, `industrial-accident`, `chemical-spill`, `nuclear-incident`, `infrastructure-collapse`

**Cyber (8):**
`cyber-attack`, `ransomware-campaign`, `ddos-attack`, `data-breach`, `supply-chain-compromise`, `infrastructure-intrusion`, `apt-campaign`, `zero-day-exploit`

**Politics (8):**
`election-event`, `government-change`, `constitutional-amendment`, `political-appointment`, `impeachment-proceeding`, `referendum-event`, `party-congress`, `legislative-crisis`

**Diplomacy (8):**
`diplomatic-visit`, `treaty-signing`, `summit-meeting`, `ambassador-recall`, `diplomatic-expulsion`, `peace-negotiation`, `alliance-formation`, `bilateral-agreement`

**Economics (7):**
`sanctions-announcement`, `trade-restriction`, `currency-crisis`, `market-crash`, `bond-default`, `sovereign-rating-change`, `capital-controls`

**Terrorism (6):**
`terrorist-attack`, `bombing-incident`, `hostage-situation`, `terror-cell-arrest`, `terror-financing-disruption`, `insurgent-operation`

**Migration (5):**
`refugee-flow`, `border-crossing`, `migrant-crisis`, `displacement-wave`, `asylum-processing`

**Health (4):**
`epidemic-outbreak`, `pandemic-alert`, `vaccination-campaign`, `health-system-failure`

**Infrastructure (2):**
`power-grid-failure`, `transportation-disruption`

**Social (2):**
`social-media-campaign`, `information-operation`

---

#### Metrics Map — All 75 Layer IDs

**Finance (26):**
`dxy`, `copper-gold-ratio`, `gold-oil-ratio`, `gold-silver-ratio`, `yield-curve`, `big-mac-index`, `uranium-price`, `hy-oas-spread`, `ovx-volatility`, `sp-vix-ratio`, `vxx-benchmark`, `crypto-fear-greed`, `rouble-dubai`, `wti-brent-spread`, `gold-price`, `oil-price-wti`, `oil-price-brent`, `silver-price`, `copper-price`, `platinum-price`, `palladium-price`, `natural-gas-price`, `coal-price`, `wheat-price`, `corn-price`, `soybean-price`

**Economics (15):**
`pmi-manufacturing`, `pmi-services`, `inflation-rate`, `gdp-growth`, `unemployment-rate`, `trade-balance`, `consumer-confidence`, `business-optimism`, `consumer-expectations`, `recession-probability`, `debt-to-gdp`, `interest-rate`, `central-bank-rate`, `budget-balance`, `current-account`

**ESG (8):**
`happiness-index`, `population-density`, `refugees-count`, `urbanization-rate`, `who-health-index`, `covid-19-cases`, `covid-19-deaths`, `hdi-index`

**Geopolitical (6):**
`social-tension`, `corruption-index`, `democracy-index`, `instability-index`, `resilience-index`, `strategic-risk`

**Energy (5):**
`eia-energy`, `nuclear-energy`, `renewable-energy`, `oil-gas-reserves`, `wti-brent-spread-energy`

**Health (3):**
`who-health-metrics`, `covid-19-metrics`, `medical-infrastructure`

**Social (3):**
`population-displacement`, `refugees-metrics`, `phone-activity`

**Cyber (2):**
`cve-vulnerabilities`, `composite-cyber-threat`

**Military (2):**
`military-spending`, `war-readiness`

**Other (2):**
`internet-penetration`, `mobile-connectivity`

**Threats (1):**
`cve-density`

**Intelligence (1):**
`behavioral-patterns`

**News (1):**
`google-trends`

---

#### Semantic Map — All 35 Layer IDs

**Sentiment (5):**
`overall-sentiment`, `social-media-sentiment`, `news-sentiment`, `political-sentiment`, `economic-sentiment`

**Narratives (4):**
`dominant-narratives`, `counter-narratives`, `narrative-momentum`, `narrative-origin`

**Disinformation (4):**
`fake-news-detected`, `debunked-claims`, `coordinated-inauthentic`, `bot-activity`

**Media Tone (3):**
`media-tone-index`, `editorial-bias`, `coverage-intensity`

**Propaganda (3):**
`state-propaganda-index`, `propaganda-themes`, `propaganda-reach`

**Info War (3):**
`info-war-operations`, `narrative-warfare`, `cognitive-warfare`

**Social Media (3):**
`social-media-activity`, `engagement-patterns`, `viral-content`

**Topics (3):**
`trending-topics`, `topic-clusters`, `topic-evolution`

**Credibility (2):**
`source-credibility`, `fact-check-density`

**Cognitive Biases (2):**
`confirmation-bias-index`, `availability-bias-index`

**Manipulation (2):**
`manipulation-tactics`, `influence-operations`

**Toxicity (1):**
`toxicity-index`

---

#### Forecast Map — All 16 Layer IDs

`recession-probability`, `conflict-escalation-forecast`, `sovereign-default-risk`, `currency-crisis-probability`, `trade-disruption-risk`, `energy-supply-risk`, `cyber-attack-probability`, `pandemic-resurgence`, `market-crash-probability`, `political-instability-forecast`, `migration-crisis-forecast`, `food-insecurity-forecast`, `water-stress-forecast`, `climate-event-probability`, `infrastructure-failure-forecast`, `geopolitical-risk-forecast`

---

#### Network Map — All 12 Layer IDs

`cyber-network`, `trade-network`, `financial-network`, `migration-network`, `diplomatic-network`, `supply-chain-network`, `arms-transfer-network`, `sanctions-network`, `energy-trade-network`, `info-flow-network`, `alliance-network`, `intelligence-network`

---

### Scientific References

The separation of Crucix into 5 maps is grounded in the following scientific literature:

| Reference | Field | Relevance |
|---|---|---|
| Dijkstra, 1974 | Computer Science | Separation of Concerns — each module handles one concern |
| Munzner, 2014 | Visualization | Channel separability — visual channels must be separable to avoid interference (Table 5.3) |
| Ware, 2013 | Perception | Cognitive interference — overlapping channels reduce reading accuracy by 40–60% (Chapter 6) |
| Nygard, 2007 | Software Architecture | Bulkhead pattern — isolate failure domains to prevent cascading failures |
| Jenks, 1963 | Cartography | Natural breaks classification — minimize variance within classes |
| Brewer, 2005 | Cartography | ColorBrewer — perceptually uniform color palettes for choropleth maps |
| Cowan, 2001 | Sentiment Analysis | 5-class sentiment model — discrete categories with ordinal properties |
| Cressie, 1993 | Spatial Statistics | Dual encoding — color + transparency for probability and confidence |
| Barabási, 2016 | Network Science | Force-directed layout — physics-based graph visualization |
| Freeman, 1977 | Network Science | Betweenness centrality — node importance via shortest paths |
| Page et al., 1999 | Network Science | PageRank — node importance via link analysis |
| Bonacich, 1987 | Network Science | Eigenvector centrality — importance via neighbor importance |


### How Each Map Works: End-to-End Workflow

#### Event Map Workflow

When a user clicks a layer button (e.g., "Armed Conflicts"):

1. `layers.js` calls `loadLayer('armed-conflict')`
2. `event-map.js` intercepts the call
3. `fetch('/api/layers/armed-conflict')` — API request
4. If API returns 200:
   - Data contains an array of events with lat/lng, type, severity, timestamp
   - `updateMarkers()` places a Leaflet marker for each event
   - Markers are clustered to prevent overlap at low zoom
   - Popup shows event details: type, location, date, severity, description
5. If API returns 404 (fallback):
   - `renderFallback()` generates 180 markers (2 per country × 90 countries)
   - Position = country center + deterministic offset
   - Marker type and color from layer definition
   - Severity = random with seed based on `layer.id`
6. Layer button gets `active` class
7. Log: `[EventMap] Loaded layer 'armed-conflict': 180 markers`

#### Metrics Map Workflow

When a user clicks a layer button (e.g., "PMI Manufacturing"):

1. `layers.js` calls `loadLayer('pmi-manufacturing')`
2. `metrics-map.js` intercepts the call via `MetricsMap.interceptLoad()`
3. `vizType === 'choropleth'` → `loadChoroplethLayer(layer)`
4. `fetch('/api/layers/pmi-manufacturing/featurecollection')` — API request
5. If API returns 200:
   - Data contains GeoJSON FeatureCollection with country polygons + PMI values
   - `applyChoropleth()` colors each country based on its value
   - Classification: manual breaks [42, 47, 53, 58] (ISM 50 = boundary)
   - Palette: RdYlGn5 (diverging: red = contraction, green = expansion)
   - Legend shows breaks, method, and GVF
6. If API returns 404 (fallback):
   - `renderFallback()` generates deterministic values per country
   - For PMI: base = 50 + noise(seed, status) — critical countries get lower values
   - Jenks classification (or manual for PMI)
   - `applyChoropleth()` colors countries
   - GVF logged (typically 0.90–0.93)
7. For `vizType === 'series'`: `SeriesAdapter.convert()` transforms series data to choropleth via spatial proxy
8. For `vizType === 'marker'`: `renderMarkerFallback()` generates 180 markers
9. Log: `[Choropleth] method=manual, breaks=[42,47,53,58], GVF=0.9199`

#### Semantic Map Workflow

When a user clicks a layer button (e.g., "Overall Sentiment"):

1. `layers.js` calls `loadLayer('overall-sentiment')`
2. Semantic Map orchestrator intercepts the call
3. `fetch('/api/layers/overall-sentiment/featurecollection')` — API request
4. If API returns 200:
   - Data contains country + sentiment class (1–5) + confidence
   - `sentiment-adapter.js` converts sentiment to choropleth features
   - Classification: 5 classes (Cowan 2001) with RdYlGn5 palette
   - Legend shows sentiment classes: strongly negative → strongly positive
5. If API returns 404 (fallback):
   - Deterministic sentiment generation per country (5 classes)
   - Sentiment-adapter converts to choropleth
   - Palette: RdYlGn5 (red = negative, yellow = neutral, green = positive)
6. For categorical layers (narratives, topics): Set1 palette (10 distinct colors)
7. Log: `[Semantic] method=sentiment, classes=5, palette=RdYlGn5`

#### Forecast Map Workflow

When a user clicks a layer button (e.g., "Recession Probability"):

1. `layers.js` calls `loadLayer('recession-probability')`
2. Forecast Map orchestrator intercepts the call
3. `fetch('/api/layers/recession-probability/featurecollection')` — API request
4. If API returns 200:
   - Data contains country + probability (0–100%) + confidence (0–1)
   - `forecast-adapter.js` converts to choropleth features with dual encoding
   - Color: manual breaks [20, 40, 60, 80] with YlOrRd5 palette (5 classes)
   - Opacity: `0.4 + 0.5 × confidence` (Cressie 1993)
   - Legend shows both probability thresholds and confidence range
5. If API returns 404 (fallback):
   - `probability = base + noise(seed)` (range 0–100)
   - `confidence = 0.5 + noise(seed)` (range 0–1)
   - Dual encoding applied
6. Log: `[Forecast] probability=recession, breaks=[20,40,60,80], opacity=0.4+0.5×conf`

#### Network Map Workflow

When a user clicks a layer button (e.g., "Trade Network"):

1. `layers.js` calls `loadLayer('trade-network')`
2. Network Map orchestrator intercepts the call
3. `fetch('/api/layers/trade-network')` — API request
4. If API returns 200:
   - Data contains nodes (countries) and edges (trade relationships)
   - Force simulation initializes: charge = −300, link distance = 80px
   - SVG `<circle>` / `<rect>` / `<polygon>` for nodes (shape = type)
   - SVG `<line>` for edges (width = trade volume, color = direction)
   - Verlet integration runs until alpha decays below threshold
   - Dossier panel shows graph metrics on node click
5. If API returns 404 (fallback):
   - Deterministic graph: nodes = 90 countries, edges = connections based on geographic proximity
   - Force simulation runs as above
6. Log: `[Network] layer=trade-network, nodes=90, edges=245, alpha=0.0228`

### Inter-Map Contracts

Maps communicate through two contracts only:

**1. Navigation (HTML links):**
Each map's `index.html` contains `<a href="/metrics-map/">`, `<a href="/event-map/">`, etc. These are pure HTML — no JavaScript coupling. Clicking a link loads a fresh page with a clean JavaScript context.

**2. Manifest declaration:**
Each map's `manifest.json` declares:
```json
{
  "mapType": "metrics",
  "layers": 75,
  "local_cross_map": 0,
  "failure_domain": 1,
  "dependencies": []
}
```

The `dependencies` array is always empty. `local_cross_map: 0` means zero cross-map dependencies. `failure_domain: 1` means this map's failure affects only itself.

**What maps do NOT share:**
- No shared JavaScript files (each map has its own `core.js`, `layers.js`, etc.)
- No shared CSS files (each map has its own `{map-name}.css`)
- No shared data files (each map has its own `world.geojson` copy)
- No shared configuration (each map has its own `maps-config.js`, `presets.json`)
- No shared state (each page load is a fresh JavaScript context)

### Performance Characteristics by Map

| Map | Render bottleneck | Typical DOM elements | Memory | Main thread load |
|---|---|---|---|---|
| Event Map | Marker clustering | 180–5000 markers | Low–Medium | DOM updates |
| Metrics Map | Choropleth coloring | 90 polygons | Low | Classification math (Jenks O(k·n²)) |
| Semantic Map | Categorical rendering | 90 polygons + legend | Low | Sentiment adapter |
| Forecast Map | Dual encoding | 90 polygons with opacity | Low | Color + opacity computation |
| Network Map | Force simulation | 90 nodes + 245 edges (SVG) | Medium | Physics ticks (Verlet) |

### What Fallback Means in Practice

Each map is designed to work **even when the API server is down**. This is a core design principle — a map that shows nothing when the API is unavailable is useless in a crisis.

**Fallback mechanism:**
1. User clicks a layer button
2. `fetch('/api/layers/{id}')` is sent
3. If the server responds → real data is used
4. If the server is down (404, 500, network error) → fallback kicks in:
   - A **deterministic** generator creates synthetic data using the `layer.id` as a random seed
   - The seed ensures the same layer always produces the same fallback data
   - Country status (critical/normal) influences the generated values
   - The result looks realistic — not random noise, but structured synthetic data
5. The map renders the fallback data as if it were real
6. The user sees a populated map, not a blank screen
7. A log entry notes: `[Fallback] layer=xxx, reason=404, generated=true`

This means every Crucix map is fully functional in **air-gapped environments** — no internet, no API, no data. The fallback provides a working demo of every layer's visualization.


### Maps File Structure (Unified Template)

Each map follows the same file structure (except Network Map which omits `world.geojson`):

```
dashboard/public/{map-name}/
├── index.html              # entry point, 15-18 local scripts
├── manifest.json           # passport (mapType, layers, cross_map: 0, failure_domain: 1)
├── {MAP}-MANIFEST.md       # full state description
├── ARCHITECTURE.md         # technical specification, DAG loading
├── AUTONOMY-CHARTER.md      # R1–R6 autonomy charter
├── css/
│   └── {map-name}.css      # single CSS (dark theme + map-specific legend)
├── js/                     # 15 files, load order is critical
│   ├── core.js             # language, notifications, globals
│   ├── countries.js        # ALL_COUNTRIES array
│   ├── layers.js           # layer definitions (this map only)
│   ├── maps-config.js      # classification methods, palettes
│   ├── {adapter}.js        # data adapter (series/sentiment/forecast/network)
│   ├── map-controls.js     # Leaflet init, classification, legend
│   ├── markers.js          # marker rendering (Event Map only)
│   ├── {map-name}-map.js   # orchestrator (decision tree)
│   ├── copy-data.js        # snapshot button
│   ├── heat-timeline.js    # heatmap and timeline
│   ├── ssi.js              # Strategic Stress Index
│   ├── refresh.js          # auto-refresh
│   ├── cii.js              # Country Instability Index
│   ├── logger.js           # logging panel
│   └── init.js             # initialization
├── data/
│   └── world.geojson       # local copy of country boundaries (not in Network Map)
├── presets/
│   └── presets.json        # preset configurations
├── _archive/               # deprecated files (never deleted, per rule 19)
└── backups/                # automatic backups
```

### Maps Initialization Sequence

When a user opens a map URL (e.g., `http://localhost:3117/metrics-map/`):

1. Browser loads `index.html`
2. Inline `<script>` sets `window.CrucixMap = { mapType: 'metrics' }`
3. 15 JavaScript files load in strict DAG order (S01–S16)
4. Each file logs its readiness: `LAYERS.JS ready (75 layers, version 1.1)`
5. `init.js` calls `loadData()` → `loadCountryBoundaries()` → orchestrator `.init()`
6. `loadCountryBoundaries()` fetches `data/world.geojson` (local, not remote)
7. Country boundaries are rendered on the Leaflet map
8. Layer panel is populated from `layers.js`
9. Map is ready — user can click layer buttons

If any step fails, the map degrades gracefully:
- Missing `world.geojson` → empty map with error notification
- API 404 → fallback data (deterministic, per layer)
- JavaScript error → logged to panel, map continues with remaining functionality

### Maps Dashboard Integration

The 5 maps are accessible from the main dashboard at `http://localhost:3117/`:

- Navigation menu links to all 5 maps
- Each map opens in its own page (no iframes, no embedded maps)
- The main dashboard shows aggregated statistics across all 5 maps
- Switching between maps is a full page reload — clean JavaScript context

This ensures:
- No shared state between maps
- No memory leaks from one map affecting another
- No CSS conflicts between maps
- Each map can be developed, tested, and deployed independently


### Why the Maps Cannot Be Combined

#### Argument 1: Cognitive Interference (Ware, 2013)

Visual channels interfere when they encode different data types on the same surface. Color intensity (choropleth) and point position (markers) compete for visual attention. Research shows that users cannot accurately read values from a choropleth when markers are overlaid — the eye is drawn to the markers and misses the color gradient. Combining 5 different encodings would make all 5 unreadable.

The concept of **cognitive interference** comes from visual perception research. When the brain processes multiple visual channels simultaneously, channels that are not separable (in the sense of Munzner, 2014) begin to interfere with each other. The result is that accuracy of reading values from any single channel drops significantly — sometimes by 40–60% compared to isolated viewing (Ware, 2013, Chapter 6, Figure 6.8).

#### Argument 2: Data Model Incompatibility

Each map operates on a fundamentally different data model:

- **Event Map:** point features (lat/lng + event attributes) — GeoJSON FeatureCollection with Point geometry
- **Metrics Map:** polygon features (country + numeric value) — GeoJSON FeatureCollection with Polygon geometry, choropleth
- **Semantic Map:** polygon features (country + categorical class) — GeoJSON FeatureCollection with Polygon geometry, categorical encoding
- **Forecast Map:** polygon features (country + probability + confidence) — GeoJSON FeatureCollection with dual encoding
- **Network Map:** graph (nodes + edges, no geographic coordinates) — JSON with adjacency structure, no GeoJSON

These data models are not interchangeable. A graph cannot be rendered as a choropleth — nodes have no polygon geometry. A choropleth cannot be rendered as markers without losing the aggregate meaning — a country is an area, not a point. A point event cannot be aggregated into a country value without losing the event-level detail.

#### Argument 3: Separation of Concerns (Dijkstra, 1974)

Each map has its own:
- `layers.js` with its own layer definitions (84 / 75 / 35 / 16 / 12 — zero overlap)
- `maps-config.js` with its own classification methods and color palettes
- `*-adapter.js` with its own data transformation logic (series-adapter, sentiment-adapter, forecast-adapter, network-adapter)
- CSS with its own visual style (dark theme for all, but different legend styles, different panel layouts)
- Fallback logic adapted to its data type (markers vs. choropleth vs. probability vs. graph)
- `manifest.json` with its own metadata (mapType, layers, cross_map: 0, failure_domain: 1)

Combining them would create a monolith with:
- 222 layers in a single `layers.js` file — unmaintainable
- 4 different adapter types in a single file — each with different I/O contracts
- 5 different rendering pipelines in a single `map-controls.js` — a switch statement with 5 branches, each requiring its own setup, fallback, and error handling
- A single CSS file trying to style 5 different UI paradigms

The Bulkhead pattern (Nygard, 2007) ensures that a failure in one map does not affect the other four. If Event Map's marker clustering crashes, Metrics Map's choropleth continues to work. If Network Map's force simulation enters an infinite loop, the other 4 maps are unaffected.

#### Argument 4: Performance

Each map has different performance characteristics:

- **Event Map** can render thousands of markers — this requires marker clustering, DOM management, and virtualization. The main thread is busy with DOM updates.
- **Metrics Map** renders 90 country polygons — this requires color interpolation, legend management, and classification computation (Jenks DP is O(k·n²)). The main thread is busy with math.
- **Semantic Map** renders 90 country polygons with categorical overlays — similar to Metrics Map but with additional categorical rendering logic.
- **Forecast Map** renders 90 country polygons with dual encoding — requires both color interpolation and opacity computation per country.
- **Network Map** runs a force simulation — requires continuous physics calculations (Coulomb, Hooke, Verlet). The main thread is busy with physics ticks.

Running all five simultaneously on a single page would:
- Overwhelm the browser's main thread with competing computations
- Create excessive DOM elements (markers + polygons + SVG nodes)
- Cause layout thrashing from competing style recalculations
- Result in janky, unresponsive UI

Separation into 5 pages means each page has its own render loop, its own memory budget, and its own failure domain. The browser can garbage-collect one map's memory when the user navigates to another.

### Principle of Autonomy (R1–R6)

Each map follows 6 rules of full isolation:

**R1: Zero cross-map dependencies.**
No `<script>`, `<link>`, or `fetch` goes outside its own folder.
Verification: `grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'` → 0 results.

**R2: Local geojson.**
`world.geojson` is stored locally in `data/` within each map's folder (except Network Map, which uses SVG). No fetch to a shared geojson file.

**R3: Self-contained layers.**
`layers.js` contains only that map's layers. Zero layers from other maps. A layer in Event Map must not appear in Metrics Map, and vice versa.

**R4: Self-contained configuration.**
`maps-config.js` and `presets.json` are specific to that map only. No shared configuration files across maps.

**R5: Manifest declares isolation.**
`manifest.json` declares:
- `local_cross_map: 0` — zero cross-map dependencies
- `failure_domain: 1` — this map's failure affects only itself

**R6: Failure isolation.**
A crash in one map does not affect the other four maps. If a JavaScript error occurs in Event Map, the user can still navigate to Metrics Map, Semantic Map, Forecast Map, and Network Map without any issues.

### DAG Loading Sequence

Each map has its own directed acyclic graph (DAG) of script loading. The order is critical — violating it causes `window.CrucixMap` to be undefined and the entire map to crash.

Example DAG (Metrics Map, 16 steps):

| Step | File | What it does | Depends on |
|---|---|---|---|
| S01 | inline `<script>` | `window.CrucixMap = {mapType:'metrics'}` | — |
| S02 | `js/core.js` | Language, notifications, global variables | CrucixMap |
| S03 | `js/countries.js` | `ALL_COUNTRIES[90]` | — |
| S04 | `js/layers.js` | `allLayers[75]` + layer panel | — |
| S05 | `js/maps-config.js` | `MAP_TYPES`, `COLOR_SCHEMES`, `LAYER_CLASSIFICATION` | allLayers |
| S06 | `js/series-adapter.js` | `SeriesAdapter.convert()` — 14 modules | maps-config |
| S07 | `js/map-controls.js` | Leaflet init, Jenks DP, ColorBrewer, GVF, legend | Leaflet, countries |
| S08 | `js/markers.js` | `generateAllMarkers`, `updateMarkers`, `renderLayerPanel` | allLayers, map |
| S09 | `js/metrics-map.js` | `MetricsMap.init()` — orchestrator | series-adapter, map-controls |
| S10 | `js/copy-data.js` | `copyAllData` — snapshot (~500 KB) | — |
| S11 | `js/heat-timeline.js` | `toggleHeat`, `toggleTimeline` | map |
| S12 | `js/ssi.js` | `calculateSSI`, `updateLegend` | countries |
| S13 | `js/refresh.js` | `startAutoRefresh`, `refreshMapData` | — |
| S14 | `js/cii.js` | `updateCII` with fallback | countries, map-controls |
| S15 | `js/logger.js` | `CrucixLogger` (log panel) | — |
| S16 | `js/init.js` | `loadData` → `loadCountryBoundaries` → `MetricsMap.init()` | all above |

Each map has a similar DAG, adapted to its specific adapter and orchestrator.

### Inter-Map Navigation

Maps are connected through **navigation links only** — not through code dependencies. Each map's `index.html` contains navigation `<a href>` links to the other 4 maps. These are pure HTML links — no `<script>` includes from other maps, no shared JavaScript modules.

This means:
- A user on Event Map can click a link to go to Metrics Map
- The link opens a new page load — a completely fresh JavaScript context
- No shared state, no shared memory, no shared variables
- Each map boots from scratch, loads its own scripts, initializes its own map

### How to Add a New Map

1. Create a folder `dashboard/public/{new-map}/`
2. Copy the file structure from Metrics Map as a template (20 files: index.html, manifest.json, 15 JS files, 1 CSS, 1 geojson, 1 presets.json)
3. Adapt `layers.js` — define new layers with appropriate `vizType` (marker, choropleth, series, probability, graph)
4. Adapt `maps-config.js` — set classification methods and palettes for the new layer types
5. Create a specific adapter if the data model differs from choropleth (e.g., `sentiment-adapter.js`, `forecast-adapter.js`, `network-adapter.js`)
6. Copy `world.geojson` to `data/` (unless the map is graph-based, in which case skip geojson and use SVG)
7. Create `manifest.json` with `mapType`, `layers`, `cross_map: 0`, `failure_domain: 1`
8. Create `AUTONOMY-CHARTER.md` documenting R1–R6 compliance
9. Verify autonomy: `grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'` must return 0
10. Add the map to the main dashboard navigation

### Verification Checklist (All 5 Maps)

```bash
cd dashboard/public

# 1. Structure: each map has index.html and manifest.json
for map in event-map metrics-map semantic-map network-map forecast-map; do
    echo "=== $map ==="
    ls -la "$map/index.html" "$map/manifest.json" 2>/dev/null || echo "  (missing)"
done

# 2. Autonomy: zero cross-map dependencies
for map in event-map metrics-map semantic-map network-map forecast-map; do
    echo -n "$map: "
    grep -rn '\.\./' "$map/js/"*.js 2>/dev/null | grep -v 'AUTONOMY\|manifest' | wc -l
done

# 3. Layer counts
for map in event-map metrics-map semantic-map network-map forecast-map; do
    echo -n "$map layers: "
    grep -c 'id:' "$map/js/layers.js" 2>/dev/null || echo "N/A"
done

# 4. world.geojson (except network-map)
for map in event-map metrics-map semantic-map forecast-map; do
    echo -n "$map geojson: "
    ls -la "$map/data/world.geojson" 2>/dev/null | awk '{print $5}' || echo "MISSING"
done
```

Expected results:
- Event Map: 84 layers, 0 cross-map dependencies, geojson present
- Metrics Map: 75 layers, 0 cross-map dependencies, geojson present
- Semantic Map: 35 layers, 0 cross-map dependencies, geojson present
- Forecast Map: 16 layers, 0 cross-map dependencies, geojson present
- Network Map: 12 layers, 0 cross-map dependencies, no geojson (SVG-based)

---

## 🧪 AI Laboratory

The AI Lab is an environment where a local LLM (Ollama) becomes an active participant in analysis.

### Components

- **Ollama** — `http://localhost:11434`, models: llama3.1:8b, mistral:7b, phi3:3.8b
- **AI Gateway** — `apis/sources/ai-gateway.mjs`
- **RAG module** — `apis/sources/rag-module/`, port 3120
- **AI Chat** — `http://localhost:8080`

### AI Lab Pipeline

1. **Data collection** → `data/basket/*.json`
2. **Analyzer computation** → `data/analytics/{category}/*.json`
3. **API delivery** → `GET /api/layers/{name}`
4. **AI forecasting** → `data/analytics/forecast/*.json`
5. **Brief generation** → `daily-briefing.mjs` via Ollama
6. **Semantic search** → RAG module on port 3120

### AI Modules

- **ai-news-synthesis** — news synthesis via LLM
- **ai-forecasts** — probabilistic forecasting
- **social-briefing** — 3 brief formats (daily, alert, summary)
- **daily-briefing.mjs** — daily digest

---

## 🔑 API Keys

Crucix **works without API keys** — only open sources are used. Project rule (12.2): no registrations, keys, or OAuth.

### Open Sources (no keys)

- **USGS Earthquakes** — earthquakes
- **NOAA SWPC** — space weather
- **OpenSky Network** — aircraft (anonymous)
- **Open-Meteo** — weather
- **Where the ISS at** — ISS
- **Launch Library 2** — space launches
- **Frankfurter** — ECB exchange rates
- **Hacker News** — top stories
- **mledoze/countries** — 250-country reference
- **CISA KEV** — vulnerabilities
- **CoinGecko** — crypto
- **US Treasury** — US debt
- **ECB Data Portal** — EU macro
- **World Bank** — macro for 197 countries
- **GDELT** — news (requires browser User-Agent, ≥5s pause)

### If a Key Is Still Needed

One key (may be useful): `OLLAMA_HOST` for external Ollama. This is local — no registration needed.

---

## 🏛️ Architecture

### "Basket → AI → Map" Principle

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
Map (dashboard/public/{map}/)
```

### Key Rule

**No module makes fetch calls to external APIs.** All data comes only from the basket. The only exception is collectors, which fill the basket.

### Project Structure

```
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
├── dashboard/public/        # pages and 5 maps
│   ├── event-map/           # 84 layers
│   ├── metrics-map/         # 75 layers
│   ├── semantic-map/        # 35 layers
│   ├── forecast-map/        # 16 layers
│   └── network-map/         # 12 layers
├── docs/help/               # docs ru/en
├── ai-memory-sync/          # AI memory files
└── logs/collectors/         # collector logs
```

---

## 🧩 Server Module Architecture

All server files in `server/`:

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

## 🧭 Polarity System & Narrative Verification

**Version:** 1.0 · **Added:** 22–23.09.2026

### What It Is

A system that **computes geopolitical polarity from data** and **verifies Russian and Western narratives on a given topic**. Not propaganda — comparative framing analysis on observed data.

**Key principle:** the pole is **computed**, not defined by a list. If data changes — the pole changes automatically.

### Components

| File | Type | Purpose |
|------|------|---------|
| `apis/sources/pole-tracker-api.mjs` | API | Computes country polarity from 8 basket indicators |
| `apis/sources/narrative-splitter-api.mjs` | API | Verifies Russian and Western narratives on a topic |
| `apis/sources/source-camps.json` | Config | Source mapping and country baseline by poles |
| `dashboard/public/pole-map.html` | Page | Pole map: countries, confidence, vectors |
| `dashboard/public/narrative-arena.html` | Page | Narrative verification: Russia / West / Divergences |
| `scripts/snapshot-rsshub.mjs` | Script | News history accumulation (systemd timer) |

### Pages

- **🌐 Pole Map** — [http://localhost:3117/pole-map](http://localhost:3117/pole-map)
  Shows three poles (russian / western / non_aligned) with countries, polarity index, vectors (sanctions, info-war, military presence), basket status.

- **⚡ Narrative Arena** — [http://localhost:3117/narrative-arena](http://localhost:3117/narrative-arena)
  Three columns: Russian narrative / Western narrative / Divergences. Presets: sanctions, Ukraine, energy transition, conflict, gas.

### API Endpoints

```bash
# All poles
curl http://localhost:3117/api/layers/pole-tracker

# Single country detail
curl "http://localhost:3117/api/layers/pole-tracker?country=russia"

# Narrative verification by topic
curl -G http://localhost:3117/api/layers/narrative-splitter \
    --data-urlencode "topic=Ukraine" \
    --data-urlencode "limit=10"

# Detailed output
curl "http://localhost:3117/api/layers/narrative-splitter?topic=sanctions&detail=true"
```

### What the Terms Mean

| Term | Meaning |
|------|---------|
| **silence** | One side writes (N>0), the other is silent (0). Strongest signal of omission |
| **framing_gap** | Both sides write, but with different framing |
| **double_standard** | Coverage imbalance >3x in one direction |
| **polarity_index** | 0..1: 0 = unipolar world, 1 = maximum polarity |
| **confidence** | 0..0.98: confidence in country classification |
| **basis** | Classification source: `baseline_plus_data` / `data_driven` / `weak_signals` / `no_data` |

### History Accumulation

Script `scripts/snapshot-rsshub.mjs` runs via **systemd timer every hour at :02**:

- Updates `data/basket/rsshub.json` via `collect-rsshub.mjs`
- Copies a snapshot to `data/analytics/rss-history/rsshub-<timestamp>.json`
- Maintains an index `index.json`
- Trims the archive to 168 snapshots (7 days)

```bash
# Timer management
systemctl --user status crucix-rsshub-snapshot.timer
systemctl --user list-timers crucix-rsshub-snapshot.timer
tail -20 logs/rss-history/systemd.log

# Manual run
node scripts/snapshot-rsshub.mjs
```

**Why:** after a week, 84,000 items accumulate — enough for real co-occurrence analysis of topics (threat inflation, selective framing).

### References

Full references for each page and module:
- `data/help/ru/pole-tracker-api.txt` — polarity module API
- `data/help/ru/narrative-splitter-api.txt` — verification module API
- `data/help/ru/pole-map.txt` — pole map page
- `data/help/ru/narrative-arena.txt` — narrative arena page
- `data/help/ru/CRUCIX_POLARITY_OVERVIEW.txt` — system overview

### How to Extend

**Add a source to a pole:**
Edit `apis/sources/source-camps.json` → `media_sources.{pole}.sources`. Mapping is by substring in lowercase.

**Add an indicator:**
Edit `apis/sources/source-camps.json` → `indicators.basket_files`. Then add reading in `computeCountryVector()` in `pole-tracker-api.mjs`.

**Add a country to baseline:**
Edit `apis/sources/source-camps.json` → `pole_cores.{pole}.core` (or `baseline_satellites`, `affiliated`).

### Principles

1. **The pole is computed, not defined.** Data changes — the pole changes.
2. **Comparison is symmetric.** The system shows divergences on both the Russian and Western sides.
3. **The method is transparent.** Anyone can open the basket file and see which records the classification is based on.
4. **This is a tool, not a verdict.** The system doesn't say "who's right" — it shows where sides diverge.

---

## 📡 Data Sources

226 files in `data/basket/`. Key sources:

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

### Economics and Markets
- `worldbank-latest.json` — 194 countries World Bank
- `coingecko-latest.json` — crypto
- `fred.json` — macro (ECB + Treasury + WB)
- `fx-rates.json` — exchange rates (Frankfurter)
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
- `cisa-kev.json` — known vulnerabilities
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
npm run daily-briefing   # generate daily brief
npm run registry         # generate registry
```

---

## ⚙️ Configuration

### Environment Variables

Copy `.env.example` to `.env`. Key variables:

- `PORT` — server port (default 3117)
- `OLLAMA_HOST` — Ollama URL (default `http://localhost:11434`)
- `TELEGRAM_BOT_TOKEN` — bot token (optional)
- `DISCORD_WEBHOOK_URL` — Discord webhook (optional)

### Important

**Crucix works without API keys.** All sources are open. If a key is needed — it's not in the project, use alternatives.

---

## 🔌 API Endpoints

### Core

- `GET /api/registry/` — module registry
- `GET /api/geo/markers` — map markers
- `GET /api/geo/status` — status
- `GET /api/layers` — layer list

### Analytical (new)

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

### Server Won't Start

- Check `node --version` — Node 22+ required
- Check `npm install`
- Check log `/tmp/crucix-server.log`

### Analyzer Not Working

- `node scripts/analyzers/{name}.mjs` — check output
- `curl http://localhost:3117/api/layers/{name}/stats` — check endpoint
- Check `data/analytics/{category}/{name}.json` — file created?

### Collector Returns 0 Data

- Check source availability: `curl {url}`
- Check log `logs/collectors/collect-{name}.log`
- Ensure no API key needed (rule 12.2)

### GDELT Returns 429

- Browser User-Agent required
- Pause ≥5 seconds between requests
- Timeout ≥30 seconds

### Map Not Loading

- Check browser console (F12) for errors
- Verify the map folder exists in `dashboard/public/{map}/`
- Check autonomy: `grep -rn '\.\./' index.html js/*.js | grep -v 'AUTONOMY\|manifest'` — should return 0
- Verify `data/world.geojson` exists (except Network Map)
- Check script load order in `index.html`

---

## 🧩 Extensions

### How to Create a New Analyzer

1. **Calculator class** — `apis/sources/{name}.mjs`
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
   { id: '{name}', name: 'Layer Name', color: '#color', icon: '🎯', category: 'category', vizType: 'marker' }
   ```

6. **Restart server.**

### How to Create a New Collector

1. File `scripts/collectors/collect-{name}.mjs`
2. Import from open API (no key)
3. Save to `data/basket/{name}.json`
4. Log to `logs/collectors/collect-{name}.log`
5. Register in cron

---

## 💬 AI Chat

AI chat works via local Ollama.

### Installing Ollama

```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a model
ollama pull llama3.1:8b

# 3. Start Ollama
ollama serve &

# 4. Open AI chat
open http://localhost:3117/ai-chat
```

### Prompts

AI chat uses analyzer data as context. The model answers questions about:
- Current geopolitical situation
- Country risks
- Market indicators
- Infrastructure threats
- Forecasts

---

## 🤝 Contributing

Welcome contributions:

1. **New analyzers** — following the reference pattern (class → analyzer → API → layer)
2. **New collectors** — open APIs only (no keys)
3. **New references** in `data/reference/`
4. **Improvements to existing modules**
5. **Bilingual docs** (ru + en)

### Rules

- Follow the "Basket → AI → Map" architecture
- No API keys (rule 12.2)
- Write docs in ru + en
- Don't delete existing modules (rule 7.6)
- Respect map autonomy (R1–R6) — each map is fully isolated
- Don't add cross-map dependencies — a layer in one map must not reference files from another map

---

## 🧠 Crucix Predictive Core

Since 18.09.2026, the project includes a **predictive core** — a 16-phase pipeline (A–R, S, T, U, Z) of 22 modules working across 30 scientific disciplines.

### Key Points

- **Engine** `apis/predict/engine.mjs` v8.0.0 — 16-phase pipeline.
- **22 modules** of the predictive core: Bayesian kernel, naive Bayes, Markov chains, Monte Carlo, time series, Brier calibration, cascade chains, ensemble, LLM agents, Hawkes process, HMM, Kalman filter, Ising model, entropy transfer, SIR/SEIR, EVT, Ornstein-Uhlenbeck, copulas, BOCPD, Particle Filter, MLP, GCN+DQN.
- **Sources**: `apis/predict/sources/` — prediction_markets (Polymarket/Metaculus/Kalshi/Manifold), multilang (100+ languages), satellite (Sentinel-2/Landsat/SAR).
- **Knowledge graph**: `apis/knowledge/graph.mjs`.
- **New pages**: /cockpit, /agent, /hypergraph, /plugins, /realtime, /advanced, /attention, /coevolution, /crucix, /predictions_composite.
- **Plugins**: `plugins/` — loader, sandbox, hooks, registry, manifest_schema.
- **Integrations**: `integrations/` — Slack, Notion, Obsidian, RSS, Email, Webhook.
- **Observability**: `observability/` — OpenTelemetry, Prometheus, Grafana.
- **Tests**: `tests/` — 42 files (unit, property, fuzz, mutation, integration, chaos, load). Smoke test: 22/22 OK.
- **Deployment**: `docker/` — Dockerfile.engine + docker-compose.engine.yml. `k8s/` — 11 manifests.
- **Documentation**: `docs/handbook/` — 800+ page book, `docs/help/ru` and `docs/help/en` — reference docs.

### Running Tests

```bash
npm run test:all-modules       # smoke test 22 modules
npm run test:unit              # unit tests
npm run test:integration       # integration tests
npm run test:property          # property-based
npm run test:fuzz              # fuzz tests
npm run test:mutation          # mutation tests
```

---

## 📰 SmartScroll — RSS & Telegram Integration

Since 24.09.2026, the project includes **SmartScroll 1.0.0** — a toolkit for collecting, deduplicating, clustering, and summarizing news feeds from RSS and Telegram. The result — stories, timelines, and summaries embedded in the Crucix knowledge graph.

### Key Points

- **Toolkit**: `apis/sources/smartscroll*` — 16 modules, 3 modes (external / local / auto).
- **Collectors**: RSS 2.0 + Atom and public Telegram channels via `t.me/s/` — no API keys or tokens.
- **Deduplication**: 4 levels — content hash, entity signature, Jaccard shingles, TF-IDF cosine.
- **Clustering**: inverted index by entities — candidate search in O(1) instead of O(N).
- **Summarization**: extractive (TF-IDF + MMR) + abstractive via local Ollama with automatic fallback.
- **HTTP server**: 8 endpoints on port `3157` (variable `SMARTSCROLL_HTTP_PORT`).
- **Metrics**: time per cycle stage (collect, normalize, dedup, cluster, summarize, store).
- **Resilience**: rate limiter (token bucket) and circuit breaker in external adapter.
- **Date validation**: filter events older than 10 years and future events beyond 24 hours.

### Toolkit Composition

```
apis/sources/smartscroll-interface.mjs         — shared interface (contract v3)
apis/sources/smartscroll.mjs                    — external adapter with rate limiter and circuit breaker
apis/sources/smartscroll-local/index.mjs        — source factory (external / local / auto)
apis/sources/smartscroll-local/engine.mjs       — cycle core with per-stage metrics
apis/sources/smartscroll-local/processing/     — normalization, dedup, clustering, summary, timeline
apis/sources/smartscroll-local/storage/        — file-based JSON story storage
apis/entity-model/story-layer.mjs              — entity model: story-to-knowledge-graph mapping
apis/ingest/event-ingestion-api.mjs             — SmartScroll HTTP server
scripts/collectors/lib/rss-collector.mjs       — RSS 2.0 + Atom with date validation
scripts/collectors/lib/telegram-collector.mjs   — public Telegram channel reader
scripts/collectors/collect-smartscroll.mjs      — toolkit collector (writes to basket)
config/smartscroll.json                         — toolkit configuration
test/smartscroll/                               — 6 test files (unit + integration)
```

### HTTP Endpoints

```
GET  /health                     — source and graph status
GET  /metrics                    — performance metrics by stage
GET  /stats                      — story and event summary
GET  /stories?limit=N&since=ISO  — story list
GET  /stories/:id                — story details
GET  /stories/:id/timeline       — story timeline
POST /run                        — ingest stories into graph
POST /collect                    — full collection cycle from sources
```

### Launch

```bash
# Run collector
cd Crucix && node scripts/collectors/collect-smartscroll.mjs

# Run SmartScroll HTTP server
cd Crucix && SMARTSCROLL_HTTP_PORT=3157 node apis/ingest/event-ingestion-api.mjs

# Run tests
cd Crucix && node test/smartscroll/run-all.mjs
```

### Metrics

- Working modes: 3 (external / local / auto)
- Collectors: 2 (RSS, Telegram)
- Deduplication levels: 4
- Clustering weights: 3 (entities 0.5, title 0.3, body 0.2)
- Summarization methods: 2 (extractive + abstractive)
- Entity model node types: 3 (Story, TimelineEvent, Entity)
- Edge types: 4 (contains, mentions, related_to, evolves_into)
- HTTP endpoints: 8
- Tests: 51 (30 unit + 21 integration)

### Documentation

Detailed documentation for each module:

- **Russian**: [`docs/help/ru/modules/smartscroll/`](docs/help/ru/modules/smartscroll/INDEX.md) — 17 files, table of contents + 16 module reference files.
- **English**: [`docs/help/en/modules/smartscroll/`](docs/help/en/modules/smartscroll/INDEX.md) — 17 files, table of contents + 16 module reference files.
- **Toolkit manifest**: [`MANIFEST-smartscroll.md`](MANIFEST-smartscroll.md).

Each reference file contains: purpose, location, methods, algorithms, relationships with other modules, examples.

---

## 📜 License

AGPLv3. See `LICENSE`.

---

**Crucix** — your personal analytics center. 226 sources. 59 analyzers. 5 maps. One command. No cloud.
