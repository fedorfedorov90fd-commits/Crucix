# continual_learning

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `continual_learning` — EWC + Synaptic Intelligence.
Файл: `apis/predict/v6/continual_learning.mjs` (23392 B, 652 строк, версия 6.0.0).

**English:**
The `continual_learning` module — EWC + Synaptic Intelligence.
File: `apis/predict/v6/continual_learning.mjs` (23392 B, 652 lines, version 6.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **S**, тип **predictive**. Категория: v6.
Минимальная история: 30 sweep.
Timeout: 90000 ms.

**English:**
Module belongs to phase **S**, type **predictive**. Category: v6.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе S.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase S.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/v6/continual_learning.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/v6/continual_learning.md` |
| Справка EN / Help EN | `docs/help/en/v6/continual_learning.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 23392 B.

**English:**
🟢 Active. File exists, size 23392 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export function crucixContinualLearning(history, options = {}) {`
- `export { EWCLearner, SynapticIntelligence };`

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
| timeoutMs | number | 90000 | Таймаут выполнения (мс) |
| phase | string | S | Фаза конвейера |
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
**Версия модуля:** 6.0.0
