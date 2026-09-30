# crucix_worker

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `crucix_worker` — Worker для запуска тяжёлых Crucix-модулей параллельно (AutoML, GNN, Diffusion, Transformer training).
Файл: `apis/predict/workers/crucix_worker.mjs` (3579 B, 112 строк, версия —).

**English:**
The `crucix_worker` module — component of Crucix predictive core.
File: `apis/predict/workers/crucix_worker.mjs` (3579 B, 112 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **workers**, тип **math**. Категория: workers.

**English:**
Module belongs to phase **workers**, type **math**. Category: workers.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе workers.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase workers.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/workers/crucix_worker.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/workers/crucix_worker.md` |
| Справка EN / Help EN | `docs/help/en/workers/crucix_worker.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 3579 B.

**English:**
🟢 Active. File exists, size 3579 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

—

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { parentPort } from 'node:worker_threads';`
- `import { MLP } from '../models/neural.mjs';`
- `import { GradientBoosting } from '../models/gbm.mjs';`
- `import { RandomForest } from '../models/random_forest.mjs';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | workers | Фаза конвейера |
| type | string | math | Тип модуля |

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
