# engine_coordinat

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `engine_coordinat` — Оркестратор прогностических модулей Crucix Координация: загрузка данных -> параллельный запуск -> ансамблирование -> публикация engine_coordinat не знает о транспорте (WASM/WebGL/WS) — только о модулях и данных..
Файл: `apis/predict/engine_coordinat.mjs` (18221 B, 551 строк, версия 1.0.0).

**English:**
The `engine_coordinat` module — component of Crucix predictive core.
File: `apis/predict/engine_coordinat.mjs` (18221 B, 551 lines, version 1.0.0).

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
| Модуль / Module | `apis/predict/engine_coordinat.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/engine_coordinat.md` |
| Справка EN / Help EN | `docs/help/en/api/engine_coordinat.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 18221 B.

**English:**
🟢 Active. File exists, size 18221 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export function createForecastEngine(options) {`
- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { createHash } from 'node:crypto';`

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
**Версия модуля:** 1.0.0
