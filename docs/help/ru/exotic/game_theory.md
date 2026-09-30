# game_theory

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `game_theory` — Game Theory для геополитики.
Файл: `apis/predict/exotic/game_theory.mjs` (4242 B, 10 строк, версия —).

**English:**
The `game_theory` module — component of Crucix predictive core.
File: `apis/predict/exotic/game_theory.mjs` (4242 B, 10 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **exotic**, тип **predictive**. Категория: exotic.

**English:**
Module belongs to phase **exotic**, type **predictive**. Category: exotic.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе exotic.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase exotic.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/exotic/game_theory.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/exotic/game_theory.md` |
| Справка EN / Help EN | `docs/help/en/exotic/game_theory.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 4242 B.

**English:**
🟢 Active. File exists, size 4242 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { findNashEquilibria, mixedNash2x2, evolutionarilyStableStrategy, prisonersDilemmaTournament, crucixGameTheory };`

---

## 📦 ИМПОРТЫ / IMPORTS

—

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | exotic | Фаза конвейера |
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
