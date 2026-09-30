# automl

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `automl` — GP + Bayesian Optimization.
Файл: `apis/predict/automl.mjs` (38978 B, 1220 строк, версия 6.0.0).

**English:**
The `automl` module — GP + Bayesian Optimization.
File: `apis/predict/automl.mjs` (38978 B, 1220 lines, version 6.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **T**, тип **meta**. Категория: api.
Минимальная история: 30 sweep.
Timeout: 120000 ms.

**English:**
Module belongs to phase **T**, type **meta**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе T.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase T.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/automl.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/automl.md` |
| Справка EN / Help EN | `docs/help/en/api/automl.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 38978 B.

**English:**
🟢 Active. File exists, size 38978 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export function crucixAutoML(history, options = {}) {`
- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 30 | Минимум sweep для запуска |
| timeoutMs | number | 120000 | Таймаут выполнения (мс) |
| phase | string | T | Фаза конвейера |
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
**Версия модуля:** 6.0.0
