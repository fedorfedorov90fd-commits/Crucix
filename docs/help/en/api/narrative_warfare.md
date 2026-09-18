# narrative_warfare

## 📋 ABOUT

The `narrative_warfare` module — Детектор кампаний влияния.
File: `apis/predict/narrative_warfare.mjs` (16856 B, 427 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **J3**, type **predictive**. Category: api.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase J3.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/narrative_warfare.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 16856 B.

---

## 📚 EXPORTS

- `export const meta = {`
- `export const KNOWN_PROPAGANDA_SOURCES = new Set([`
- `export function isPropagandaSource(sourceUrl) {`
- `export class NarrativeWarfareDetector {`
- `export function computeNarrativeConfidence(posts) {`
- `export function crucixNarrativeWarfare(latest, history) {`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname, resolve } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
