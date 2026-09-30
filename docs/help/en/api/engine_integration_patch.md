# engine_integration_patch

## 📋 ABOUT

The `engine_integration_patch` module — component of Crucix predictive core.
File: `apis/predict/engine_integration_patch.mjs` (29897 B, 871 lines, version —).

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
| Module | `apis/predict/engine_integration_patch.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 29897 B.

---

## 📚 EXPORTS

- `export async function runNewModules(latest, history, existingPrediction = {}, options = {}) {`
- `export async function runForecastPipelineExtended(latest, history, options = {}) {`
- `export default runForecastPipelineExtended;`

---

## 📦 IMPORTS

- `import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { HawkesProcess, sweepToHawkesEvents } from './models/hawkes.mjs';`
- `import { HMM, createCrucixHMM, sweepToObservations } from './models/hmm.mjs';`
- `import { KalmanFilter, Kalman1D } from './models/kalman.mjs';`
- `import { IsingModel } from './models/ising.mjs';`
- `import { transferEntropy, influenceMatrix } from './models/transferentropy.mjs';`
- `import { SIRModel, SEIRModel, NetworkContagion } from './models/contagion.mjs';`
- `import { GPD, GEV, extremeEventProbability } from './models/evt.mjs';`
- `import { OrnsteinUhlenbeck } from './models/ornstein.mjs';`
- `import { tailDependence, dependenceAnalysis, estimateClayton } from './models/copula.mjs';`
- `import { BOCPD, GaussianConjugate } from './models/bocpd.mjs';`
- `import { ParticleFilter } from './models/particle.mjs';`
- `import { MLP } from './models/neural.mjs';`
- `import { GCN } from './models/graph_neural.mjs';`
- `import { DQN } from './models/reinforcement.mjs';`
- `import { hybridForecast, checkPythonService } from './python_bridge.mjs';`
- `import { permutationImportance, counterfactualExplanation, decomposeUncertainty, buildReasoningChain } from './explainability.mjs';`
- `import { publishPrediction, publishBrierUpdate } from './ws.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
