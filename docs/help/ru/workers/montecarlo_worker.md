# montecarlo_worker

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `montecarlo_worker` — Web Worker для параллельного Monte Carlo и матричных операций.
Файл: `apis/predict/workers/montecarlo_worker.mjs` (3311 B, 117 строк, версия —).

**English:**
The `montecarlo_worker` module — component of Crucix predictive core.
File: `apis/predict/workers/montecarlo_worker.mjs` (3311 B, 117 lines, version —).

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
| Модуль / Module | `apis/predict/workers/montecarlo_worker.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/workers/montecarlo_worker.md` |
| Справка EN / Help EN | `docs/help/en/workers/montecarlo_worker.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 3311 B.

**English:**
🟢 Active. File exists, size 3311 B.

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
