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
Модуль относится к фазе **T**, тип **meta**. Категория: models.
Минимальная история: 30 sweep.
Timeout: 120000 ms.

AutoML + Bayesian Optimization для прогностического слоя Crucix Часть A: шапка, утилиты, Gaussian Process, ядра, acquisition functions Часть B: BayesianOptimizer, AutoML, crucixAutoML, экспорты

**English:**
Module belongs to phase **T**, type **meta**. Category: models.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе T.
Регистрация: `apis/predict/register_coordinat_all.mjs` (имя automl, экспорт automl).

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase T.
Registry: `apis/predict/register_coordinat_all.mjs` (name automl).

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/automl.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Паспорт фазы / Phase passport | `docs/modules/phase-T.md` |
| Справка RU / Help RU | `docs/help/ru/models/automl.md` |
| Справка EN / Help EN | `docs/help/en/models/automl.md` |

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
- `docs/modules/phase-T.md` — паспорт фазы.

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

## 🧮 ТЕОРЕТИЧЕСКАЯ ОСНОВА / THEORETICAL BASIS

**Русский:**
Bayesian Optimization:
- Snoek, J., Larochelle, H., & Adams, R. P. (2012). "Practical Bayesian
Optimization of Machine Learning Algorithms". NeurIPS.
- Jones, D. R., Schonlau, M., & Welch, W. J. (1998). "Efficient Global
Optimization of Expensive Black-Box Functions". Journal of Global
Optimization.
- Brochu, E., Cora, V. M., & de Freitas, N. (2010). "A Tutorial on
Bayesian Optimization of Expensive Cost Functions". arXiv:1012.2599.
Acquisition functions:
- Mockus, J. (1978). "The application of Bayesian methods for seeking

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 30 | Минимум sweep для запуска |
| timeoutMs | number | 120000 | Таймаут выполнения (мс) |
| phase | string | T | Фаза конвейера |
| type | string | meta | Тип модуля |

---

## ⚙️ ПОТОК ВЫПОЛНЕНИЯ / EXECUTION FLOW

1. Оркестратор (engine.mjs) вызывает модуль в фазе T.
2. Модуль получает sweep и history.
3. Возвращает результат в единый snapshot.
4. При ошибке — фиксируется в forecast.failures.

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ / CHANGELOG

- 2026-09-17 — создана справка.

---

## 🚧 ЧТО НАРАСТИТЬ / ROADMAP

См. `docs/book/07-improvements.md` — раздел по фазе T.

---

## 🔍 ТЕСТЫ / TESTS

Местоположение: `tests/`. Проверить наличие тестов для модуля.

---

**Создано:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия модуля:** 6.0.0
