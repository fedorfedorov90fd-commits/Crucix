# crucix_worker

## 📋 ABOUT

The `crucix_worker` module — component of Crucix predictive core.
File: `apis/predict/workers/crucix_worker.mjs` (3579 B, 112 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **workers**, type **math**. Category: workers.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase workers.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/workers/crucix_worker.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 3579 B.

---

## 📚 EXPORTS

—

---

## 📦 IMPORTS

- `import { parentPort } from 'node:worker_threads';`
- `import { MLP } from '../models/neural.mjs';`
- `import { GradientBoosting } from '../models/gbm.mjs';`
- `import { RandomForest } from '../models/random_forest.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
