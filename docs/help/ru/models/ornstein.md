# ornstein

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `ornstein` — Ornstein-Uhlenbeck.
Файл: `apis/predict/models/ornstein.mjs` (6296 B, 215 строк, версия —).

**English:**
The `ornstein` module — Ornstein-Uhlenbeck.
File: `apis/predict/models/ornstein.mjs` (6296 B, 215 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **C**, тип **predictive**. Категория: models.
Минимальная история: 15 sweep.
Timeout: 10000 ms.

**English:**
Module belongs to phase **C**, type **predictive**. Category: models.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе C.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase C.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/models/ornstein.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/models/ornstein.md` |
| Справка EN / Help EN | `docs/help/en/models/ornstein.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 6296 B.

**English:**
🟢 Active. File exists, size 6296 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { OrnsteinUhlenbeck, crucixOUAnalysis, normalCDF, erf };`

---

## 📦 ИМПОРТЫ / IMPORTS

—

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 15 | Минимум sweep для запуска |
| timeoutMs | number | 10000 | Таймаут выполнения (мс) |
| phase | string | C | Фаза конвейера |
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
**Версия модуля:** —
