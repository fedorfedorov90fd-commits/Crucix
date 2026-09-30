# reinforcement

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `reinforcement` — Reinforcement Learning для прогностического слоя Crucix..
Файл: `apis/predict/models/reinforcement.mjs` (21795 B, 726 строк, версия —).

**English:**
The `reinforcement` module — component of Crucix predictive core.
File: `apis/predict/models/reinforcement.mjs` (21795 B, 726 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **models**, тип **predictive**. Категория: models.

**English:**
Module belongs to phase **models**, type **predictive**. Category: models.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе models.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase models.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/models/reinforcement.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/models/reinforcement.md` |
| Справка EN / Help EN | `docs/help/en/models/reinforcement.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 21795 B.

**English:**
🟢 Active. File exists, size 21795 B.

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
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | models | Фаза конвейера |
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
