# simulation_engine

## 📋 ABOUT

The `simulation_engine` module — World Model + Neural ODE + Dreamer + Continuous Causal.
File: `apis/predict/v7/simulation_engine.mjs` (21218 B, 524 lines, version 7.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **U**, type **predictive**. Category: v7.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase U.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/v7/simulation_engine.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 21218 B.

---

## 📚 EXPORTS

- `export async function crucixSimulationEngine(history, options = {}) {`
- `export {`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { WorldModel, crucixWorldModel } from './world_model.mjs';`
- `import { crucixNeuralODE } from './neural_ode.mjs';`
- `import { crucixDreamer } from './dreamer.mjs';`
- `import { crucixContinuousCausal } from './continuous_causal.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 7.0.0
