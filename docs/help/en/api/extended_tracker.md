# extended_tracker

## 📋 ABOUT

The `extended_tracker` module — Brier декомпозиция, drift.
File: `apis/predict/extended_tracker.mjs` (18912 B, 582 lines, version 3.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **Z**, type **meta**. Category: api.
Timeout: 5000 ms.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase Z.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/extended_tracker.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |
| Phase passport | `docs/modules/phase-Z.md` |
| Help RU | `docs/help/ru/api/extended_tracker.md` |
| Help EN | `docs/help/en/api/extended_tracker.md` |

---

## 📊 STATUS

🟢 Active. File exists, size 18912 B.

---

## 🔗 RELATED MODULES

- `apis/predict/engine.mjs` — main orchestrator.
- `apis/predict/register_coordinat_all.mjs` — module registry.
- `docs/modules/phase-Z.md` — phase passport.

---

## 📚 EXPORTS

- `export class ExtendedTracker {`
- `export function getExtendedTracker() {`
- `export function _resetExtendedTracker() {`
- `export {`

---

## 📦 IMPORTS

- `import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 🧮 THEORETICAL BASIS

Brier, G. W. (1950). "Verification of forecasts expressed in terms of
probability". Monthly Weather Review, 78(1), 1-3.
Murphy, A. H. (1973). "A New Vector Partition of the Probability Score".
Journal of Applied Meteorology, 12(4), 595-600.
BS = Reliability - Resolution + Uncertainty
Gneiting, T., & Raftery, A. E. (2007). "Strictly Proper Scoring Rules,
Prediction, and Estimation". JASA, 102(477), 359-378.
Efron, B., & Tibshirani, R. J. (1993). "An Introduction to the Bootstrap".

---

## 📈 PARAMETERS

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| minHistory | number | 0 | Minimum sweeps to run |
| timeoutMs | number | 5000 | Timeout in ms |
| phase | string | Z | Pipeline phase |
| type | string | meta | Module type |

---

## ⚙️ EXECUTION FLOW

1. Orchestrator (engine.mjs) calls module at phase Z.
2. Module receives sweep and history.
3. Returns result into unified snapshot.
4. On error — recorded in forecast.failures.

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

## 🚧 ROADMAP

See `docs/book/07-improvements.md` — section for phase Z.

---

## 🔍 TESTS

Location: `tests/`. Check for module tests.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 3.0.0
