# engine_integration_patch

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `engine_integration_patch` — =================================================================== Интеграционный патч для engine.mjs -- подключает 21 новых модулей к существующему прогностическому конвейеру Crucix..
Файл: `apis/predict/engine_integration_patch.mjs` (29897 B, 871 строк, версия —).

**English:**
The `engine_integration_patch` module — component of Crucix predictive core.
File: `apis/predict/engine_integration_patch.mjs` (29897 B, 871 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **api**, тип **predictive**. Категория: api.

**English:**
Module belongs to phase **api**, type **predictive**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе api.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase api.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/engine_integration_patch.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/engine_integration_patch.md` |
| Справка EN / Help EN | `docs/help/en/api/engine_integration_patch.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 29897 B.

**English:**
🟢 Active. File exists, size 29897 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export async function runNewModules(latest, history, existingPrediction = {}, options = {}) {`
- `export async function runForecastPipelineExtended(latest, history, options = {}) {`
- `export default runForecastPipelineExtended;`

---

## 📦 ИМПОРТЫ / IMPORTS

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

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | api | Фаза конвейера |
| type | string | predictive | Тип модуля |

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ / CHANGELOG

- 2026-09-17 — создана справка.

---

## 🚧 ЧТО НАРАСТИТЬ / ROADMAP

См. `docs/book/07-improvements.md`.

---

**Создано:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия модуля:** —
