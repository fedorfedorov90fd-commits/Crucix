# evt

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `evt` — Extreme Value Theory.
Файл: `apis/predict/models/evt.mjs` (7846 B, 264 строк, версия —).

**English:**
The `evt` module — Extreme Value Theory.
File: `apis/predict/models/evt.mjs` (7846 B, 264 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **C**, тип **predictive**. Категория: models.
Минимальная история: 20 sweep.
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
| Модуль / Module | `apis/predict/models/evt.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/models/evt.md` |
| Справка EN / Help EN | `docs/help/en/models/evt.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 7846 B.

**English:**
🟢 Active. File exists, size 7846 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { GPD, GEV, extremeEventProbability, crucixEVTAnalysis };`

---

## 📦 ИМПОРТЫ / IMPORTS

—

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 20 | Минимум sweep для запуска |
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
