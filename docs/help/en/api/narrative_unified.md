# narrative_unified

## 📋 ABOUT

The `narrative_unified` module — component of Crucix predictive core.
File: `apis/predict/narrative_unified.mjs` (11150 B, 260 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **api**, type **predictive**. Category: api.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase api.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/narrative_unified.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 11150 B.

---

## 📚 EXPORTS

- `export const meta = {`
- `export function crucixUnifiedNarrative(latest, history, options = {}) {`
- `export function classifyNarrativeThreat(originType, sirForecast, confidence) {`
- `export default crucixUnifiedNarrative;`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { readFileSync } from 'node:fs';`
- `import { crucixNarrativeAnalysis } from './narrative.mjs';`
- `import { crucixNarrativeWarfare, computeNarrativeConfidence } from './narrative_warfare.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
