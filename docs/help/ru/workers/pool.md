# pool

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `pool` — Пул Web Workers для параллельных вычислений.
Файл: `apis/predict/workers/pool.mjs` (6438 B, 228 строк, версия —).

**English:**
The `pool` module — component of Crucix predictive core.
File: `apis/predict/workers/pool.mjs` (6438 B, 228 lines, version —).

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
| Модуль / Module | `apis/predict/workers/pool.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/workers/pool.md` |
| Справка EN / Help EN | `docs/help/en/workers/pool.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 6438 B.

**English:**
🟢 Active. File exists, size 6438 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export function getWorkerPool(options = {}) {`
- `export function resetWorkerPool() {`
- `export { WorkerPool, N_CPUS, DEFAULT_POOL_SIZE };`
- `export async function parallelMonteCarlo(config, totalIterations = 10000) {`
- `export async function parallelMatrixMultiply(matrices) {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { Worker } from 'node:worker_threads';`
- `import { cpus } from 'node:os';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

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
