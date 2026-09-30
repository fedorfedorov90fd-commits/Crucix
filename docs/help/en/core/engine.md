# engine

## 📋 ABOUT

The `engine` module — component of Crucix predictive core.
File: `apis/predict/engine.mjs` (78452 B, 2001 lines, version 8.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **orchestrator**, type **orchestrator**. Category: core.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase orchestrator.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/engine.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 78452 B.

---

## 📚 EXPORTS

- `export {`
- `export default runForecastPipeline;`

---

## 📦 IMPORTS

- `import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath, pathToFileURL } from 'node:url';`
- `import { createHash } from 'node:crypto';`
- `import { updateEvent, clampShift, likelihoodFromThresholds } from './bayesian.mjs';`
- `import { GaussianNaiveBayes, sweepToFeatures } from './naivebayes.mjs';`
- `import { MarkovChain, classifyState } from './markov.mjs';`
- `import { crucixMarketScenario } from './montecarlo.mjs';`
- `import { forecastSeries, forecastVix, forecastConflicts } from './timeseries.mjs';`
- `import { ForecastTracker, brierScore, plattCalibration } from './calibration.mjs';`
- `import { CascadeGraph } from './cascade.mjs';`
- `import { HawkesProcess, sweepToHawkesEvents } from './models/hawkes.mjs';`
- `import { HMM, createCrucixHMM, sweepToObservations } from './models/hmm.mjs';`
- `import { KalmanFilter, Kalman1D } from './models/kalman.mjs';`
- `import { IsingModel } from './models/ising.mjs';`
- `import { transferEntropy, influenceMatrix } from './models/transferentropy.mjs';`
- `import { SIRModel, SEIRModel, NetworkContagion } from './models/contagion.mjs';`
- `import { GPD, GEV, extremeEventProbability } from './models/evt.mjs';`
- `import { OrnsteinUhlenbeck } from './models/ornstein.mjs';`
- `import { tailDependence, dependenceAnalysis, estimateClayton } from './models/copula.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 8.0.0
