# linear_algebra

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `linear_algebra` — Математическое ядро: линейная алгебра на чистом JS.
Файл: `apis/predict/core/linear_algebra.mjs` (6432 B, 21 строк, версия —).

**English:**
The `linear_algebra` module — component of Crucix predictive core.
File: `apis/predict/core/linear_algebra.mjs` (6432 B, 21 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **math**, тип **math**. Категория: core.

**English:**
Module belongs to phase **math**, type **math**. Category: core.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе math.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase math.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/core/linear_algebra.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/core/linear_algebra.md` |
| Справка EN / Help EN | `docs/help/en/core/linear_algebra.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 6432 B.

**English:**
🟢 Active. File exists, size 6432 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { zeros, identity, clone, matmul, transpose, lu, solve, inverse, det, cholesky, qr, svd, jacobiEigen, pinv, lstsq, conditionNumber };`

---

## 📦 ИМПОРТЫ / IMPORTS

—

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | math | Фаза конвейера |
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
