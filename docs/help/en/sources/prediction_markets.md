# prediction_markets

## 📋 ABOUT

The `prediction_markets` module — Polymarket/Metaculus/Kalshi.
File: `apis/sources/prediction_markets.mjs` (12578 B, 372 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **F**, type **source**. Category: sources.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase F.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/sources/prediction_markets.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 12578 B.

---

## 📚 EXPORTS

- `export async function fetchPolymarket(query = null) {`
- `export async function fetchMetaculus(query = null) {`
- `export async function fetchKalshi(query = null) {`
- `export async function fetchManifold(query = null) {`
- `export function crossPlatformAnalysis(allMarkets) {`
- `export function ensembleWithCrucix(marketData, crucixForecast) {`
- `export async function fetchPredictionMarkets(query = null) {`
- `export { PLATFORMS };`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
