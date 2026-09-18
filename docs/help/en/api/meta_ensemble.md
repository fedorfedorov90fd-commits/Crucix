# meta_ensemble

## 📋 ABOUT

The `meta_ensemble` module — Online model selection.
File: `apis/predict/meta_ensemble.mjs` (15513 B, 416 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **J3**, type **meta**. Category: api.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase J3.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/meta_ensemble.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 15513 B.

---

## 📚 EXPORTS

- `export const meta = {`
- `export class MetaLearner {`
- `export function extractRegimeSignature(latest, history) {`
- `export const DEFAULT_MODELS = [`
- `export class MetaEnsemble {`
- `export function crucixMetaEnsemble(latest, history, modelPredictionsByEvent) {`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname, resolve } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
