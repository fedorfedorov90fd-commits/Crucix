# montecarlo

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `montecarlo` — Монте-Карло симуляция рыночных сценариев.
Файл: `apis/predict/montecarlo.mjs` (13026 B, 385 строк, версия —).

**English:**
The `montecarlo` module — Монте-Карло симуляция рыночных сценариев.
File: `apis/predict/montecarlo.mjs` (13026 B, 385 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **B**, тип **predictive**. Категория: api.
Минимальная история: 10 sweep.
Timeout: 30000 ms.

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
| Модуль / Module | `apis/predict/montecarlo.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/montecarlo.md` |
| Справка EN / Help EN | `docs/help/en/api/montecarlo.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 13026 B.

**English:**
🟢 Active. File exists, size 13026 B.

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
| minHistory | number | 10 | Минимум sweep для запуска |
| timeoutMs | number | 30000 | Таймаут выполнения (мс) |
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
