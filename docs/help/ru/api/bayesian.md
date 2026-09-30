# bayesian

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `bayesian` — Байесовское обновление с evidence.
Файл: `apis/predict/bayesian.mjs` (8780 B, 215 строк, версия —).

**English:**
The `bayesian` module — Байесовское обновление с evidence.
File: `apis/predict/bayesian.mjs` (8780 B, 215 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **B**, тип **predictive**. Категория: api.
Минимальная история: 5 sweep.
Timeout: 5000 ms.

**English:**
Module belongs to phase **B**, type **predictive**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе B.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase B.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/bayesian.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/bayesian.md` |
| Справка EN / Help EN | `docs/help/en/api/bayesian.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 8780 B.

**English:**
🟢 Active. File exists, size 8780 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

—

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 5 | Минимум sweep для запуска |
| timeoutMs | number | 5000 | Таймаут выполнения (мс) |
| phase | string | B | Фаза конвейера |
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
