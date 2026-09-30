# anomaly_detection

## 📋 ABOUT

The `anomaly_detection` module — IsolationForest/LOF/Mahalanobis/SVM/DBSCAN.
File: `apis/predict/models/anomaly_detection.mjs` (29341 B, 931 lines, version 6.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **T**, type **predictive**. Category: models.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase T.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/models/anomaly_detection.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 29341 B.

---

## 📚 EXPORTS

- `export function crucixAnomalyDetection(history, options = {}) {`
- `export {`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 6.0.0
