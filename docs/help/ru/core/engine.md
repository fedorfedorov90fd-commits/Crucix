# engine

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `engine` — Единый оркестратор прогностического конвейера Crucix..
Файл: `apis/predict/engine.mjs` (78452 B, 2001 строк, версия 8.0.0).

**English:**
The `engine` module — component of Crucix predictive core.
File: `apis/predict/engine.mjs` (78452 B, 2001 lines, version 8.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **orchestrator**, тип **orchestrator**. Категория: core.

**English:**
Module belongs to phase **orchestrator**, type **orchestrator**. Category: core.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе orchestrator.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase orchestrator.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/engine.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/core/engine.md` |
| Справка EN / Help EN | `docs/help/en/core/engine.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 78452 B.

**English:**
🟢 Active. File exists, size 78452 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export {`
- `export default runForecastPipeline;`

---

## 📦 ИМПОРТЫ / IMPORTS

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

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | orchestrator | Фаза конвейера |
| type | string | orchestrator | Тип модуля |

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ / CHANGELOG

- 2026-09-17 — создана справка.

---

## 🚧 ЧТО НАРАСТИТЬ / ROADMAP

См. `docs/book/07-improvements.md`.

---

**Создано:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия модуля:** 8.0.0
