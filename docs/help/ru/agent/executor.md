# executor

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `executor` — Executor — безопасное выполнение плана tool-вызовов..
Файл: `apis/predict/agent/executor.mjs` (15111 B, 466 строк, версия 8.0.0).

**English:**
The `executor` module — component of Crucix predictive core.
File: `apis/predict/agent/executor.mjs` (15111 B, 466 lines, version 8.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **agent**, тип **agent**. Категория: agent.

**English:**
Module belongs to phase **agent**, type **agent**. Category: agent.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе agent.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase agent.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/agent/executor.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/agent/executor.md` |
| Справка EN / Help EN | `docs/help/en/agent/executor.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 15111 B.

**English:**
🟢 Active. File exists, size 15111 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export async function executePlan(plan, registry, options = {}) {`
- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | agent | Фаза конвейера |
| type | string | agent | Тип модуля |

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
