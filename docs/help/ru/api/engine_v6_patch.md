# engine_v6_patch

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `engine_v6_patch` — Engine v6.0 + каталог Integration Patch.
Файл: `apis/predict/engine_v6_patch.mjs` (26040 B, 772 строк, версия 1.0.0).

**English:**
The `engine_v6_patch` module — component of Crucix predictive core.
File: `apis/predict/engine_v6_patch.mjs` (26040 B, 772 lines, version 1.0.0).

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
| Модуль / Module | `apis/predict/engine_v6_patch.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/engine_v6_patch.md` |
| Справка EN / Help EN | `docs/help/en/api/engine_v6_patch.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 26040 B.

**English:**
🟢 Active. File exists, size 26040 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export async function runV6Phase(history, options = {}) {`
- `export async function runCatalogPhase(history, options = {}) {`
- `export function applyV6ToSnapshot(snapshot, v6Phase, catalogPhase) {`
- `export async function runNewPhases(history, options = {}) {`
- `export function healthcheck() {`
- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

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
