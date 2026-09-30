# extended_tracker

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `extended_tracker` — Brier декомпозиция, drift.
Файл: `apis/predict/extended_tracker.mjs` (18912 B, 582 строк, версия 3.0.0).

**English:**
The `extended_tracker` module — Brier декомпозиция, drift.
File: `apis/predict/extended_tracker.mjs` (18912 B, 582 lines, version 3.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **Z**, тип **meta**. Категория: core.
Timeout: 5000 ms.

**English:**
Module belongs to phase **Z**, type **meta**. Category: core.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе Z.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase Z.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/extended_tracker.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/core/extended_tracker.md` |
| Справка EN / Help EN | `docs/help/en/core/extended_tracker.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 18912 B.

**English:**
🟢 Active. File exists, size 18912 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export class ExtendedTracker {`
- `export function getExtendedTracker() {`
- `export function _resetExtendedTracker() {`
- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 5000 | Таймаут выполнения (мс) |
| phase | string | Z | Фаза конвейера |
| type | string | meta | Тип модуля |

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ / CHANGELOG

- 2026-09-17 — создана справка.

---

## 🚧 ЧТО НАРАСТИТЬ / ROADMAP

См. `docs/book/07-improvements.md`.

---

**Создано:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия модуля:** 3.0.0
