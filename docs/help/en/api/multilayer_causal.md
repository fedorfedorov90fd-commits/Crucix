# multilayer_causal

## 📋 ABOUT

The `multilayer_causal` module — 4-слойный причинный DAG.
File: `apis/predict/multilayer_causal.mjs` (19340 B, 374 lines, version —).

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
| Module | `apis/predict/multilayer_causal.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 19340 B.

---

## 📚 EXPORTS

- `export const meta = {`
- `export const LAYERS = {`
- `export const NODE_DEFINITIONS = {`
- `export const CAUSAL_EDGES = [`
- `export class MultiLayerCausalGraph {`
- `export function crucixMultiLayerCausal(latest, history) {`

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
