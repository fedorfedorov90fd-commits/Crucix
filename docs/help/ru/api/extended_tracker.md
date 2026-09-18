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
Модуль относится к фазе **Z**, тип **meta**. Категория: api.
Timeout: 5000 ms.

Расширенный трекер точности прогнозов.

**English:**
Module belongs to phase **Z**, type **meta**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе Z.
Регистрация: `apis/predict/register_coordinat_all.mjs` (имя extended_tracker, экспорт extended_tracker).

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase Z.
Registry: `apis/predict/register_coordinat_all.mjs` (name extended_tracker).

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/extended_tracker.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Паспорт фазы / Phase passport | `docs/modules/phase-Z.md` |
| Справка RU / Help RU | `docs/help/ru/api/extended_tracker.md` |
| Справка EN / Help EN | `docs/help/en/api/extended_tracker.md` |

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
- `docs/modules/phase-Z.md` — паспорт фазы.

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

## 🧮 ТЕОРЕТИЧЕСКАЯ ОСНОВА / THEORETICAL BASIS

**Русский:**
Brier, G. W. (1950). "Verification of forecasts expressed in terms of
probability". Monthly Weather Review, 78(1), 1-3.
Murphy, A. H. (1973). "A New Vector Partition of the Probability Score".
Journal of Applied Meteorology, 12(4), 595-600.
BS = Reliability - Resolution + Uncertainty
Gneiting, T., & Raftery, A. E. (2007). "Strictly Proper Scoring Rules,
Prediction, and Estimation". JASA, 102(477), 359-378.
Efron, B., & Tibshirani, R. J. (1993). "An Introduction to the Bootstrap".

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 5000 | Таймаут выполнения (мс) |
| phase | string | Z | Фаза конвейера |
| type | string | meta | Тип модуля |

---

## ⚙️ ПОТОК ВЫПОЛНЕНИЯ / EXECUTION FLOW

1. Оркестратор (engine.mjs) вызывает модуль в фазе Z.
2. Модуль получает sweep и history.
3. Возвращает результат в единый snapshot.
4. При ошибке — фиксируется в forecast.failures.

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ / CHANGELOG

- 2026-09-17 — создана справка.

---

## 🚧 ЧТО НАРАСТИТЬ / ROADMAP

См. `docs/book/07-improvements.md` — раздел по фазе Z.

---

## 🔍 ТЕСТЫ / TESTS

Местоположение: `tests/`. Проверить наличие тестов для модуля.

---

**Создано:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия модуля:** 3.0.0
