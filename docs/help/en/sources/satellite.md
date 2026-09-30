# satellite

## 📋 ABOUT

The `satellite` module — Спутниковая аналитика.
File: `apis/sources/satellite.mjs` (15304 B, 432 lines, version —).

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
| Module | `apis/sources/satellite.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 15304 B.

---

## 📚 EXPORTS

- `export async function fetchSatelliteData() {`
- `export async function fetchCopernicusImage(aoiId, satellite = 'sentinel2', dateRange = {}) {`
- `export async function fetchSentinel1SAR(aoiId, dateRange = {}) {`
- `export {`

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
