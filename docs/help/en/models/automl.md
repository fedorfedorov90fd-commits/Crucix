# automl

## 📋 ABOUT

The `automl` module — GP + Bayesian Optimization.
File: `apis/predict/automl.mjs` (38978 B, 1220 lines, version 6.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **T**, type **meta**. Category: models.
Minimum history: 30 sweep.
Timeout: 120000 ms.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase T.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/automl.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |
| Phase passport | `docs/modules/phase-T.md` |
| Help RU | `docs/help/ru/models/automl.md` |
| Help EN | `docs/help/en/models/automl.md` |

---

## 📊 STATUS

🟢 Active. File exists, size 38978 B.

---

## 🔗 RELATED MODULES

- `apis/predict/engine.mjs` — main orchestrator.
- `apis/predict/register_coordinat_all.mjs` — module registry.
- `docs/modules/phase-T.md` — phase passport.

---

## 📚 EXPORTS

- `export function crucixAutoML(history, options = {}) {`
- `export {`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 🧮 THEORETICAL BASIS

Bayesian Optimization:
- Snoek, J., Larochelle, H., & Adams, R. P. (2012). "Practical Bayesian
Optimization of Machine Learning Algorithms". NeurIPS.
- Jones, D. R., Schonlau, M., & Welch, W. J. (1998). "Efficient Global
Optimization of Expensive Black-Box Functions". Journal of Global
Optimization.
- Brochu, E., Cora, V. M., & de Freitas, N. (2010). "A Tutorial on
Bayesian Optimization of Expensive Cost Functions". arXiv:1012.2599.
Acquisition functions:
- Mockus, J. (1978). "The application of Bayesian methods for seeking

---

## 📈 PARAMETERS

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| minHistory | number | 30 | Minimum sweeps to run |
| timeoutMs | number | 120000 | Timeout in ms |
| phase | string | T | Pipeline phase |
| type | string | meta | Module type |

---

## ⚙️ EXECUTION FLOW

1. Orchestrator (engine.mjs) calls module at phase T.
2. Module receives sweep and history.
3. Returns result into unified snapshot.
4. On error — recorded in forecast.failures.

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

## 🚧 ROADMAP

See `docs/book/07-improvements.md` — section for phase T.

---

## 🔍 TESTS

Location: `tests/`. Check for module tests.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 6.0.0
