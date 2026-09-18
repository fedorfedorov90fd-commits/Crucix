# simulation_engine

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `simulation_engine` — World Model + Neural ODE + Dreamer + Continuous Causal.
Файл: `apis/predict/v7/simulation_engine.mjs` (21218 B, 524 строк, версия 7.0.0).

**English:**
The `simulation_engine` module — World Model + Neural ODE + Dreamer + Continuous Causal.
File: `apis/predict/v7/simulation_engine.mjs` (21218 B, 524 lines, version 7.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **U**, тип **predictive**. Категория: v7.
Минимальная история: 30 sweep.
Timeout: 180000 ms.

**English:**
Module belongs to phase **U**, type **predictive**. Category: v7.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе U.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase U.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/v7/simulation_engine.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/v7/simulation_engine.md` |
| Справка EN / Help EN | `docs/help/en/v7/simulation_engine.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 21218 B.

**English:**
🟢 Active. File exists, size 21218 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export async function crucixSimulationEngine(history, options = {}) {`
- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { WorldModel, crucixWorldModel } from './world_model.mjs';`
- `import { crucixNeuralODE } from './neural_ode.mjs';`
- `import { crucixDreamer } from './dreamer.mjs';`
- `import { crucixContinuousCausal } from './continuous_causal.mjs';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 30 | Минимум sweep для запуска |
| timeoutMs | number | 180000 | Таймаут выполнения (мс) |
| phase | string | U | Фаза конвейера |
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
**Версия модуля:** 7.0.0
