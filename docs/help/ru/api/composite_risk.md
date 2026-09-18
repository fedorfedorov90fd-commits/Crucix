# composite_risk

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `composite_risk` — Композитный индикатор риска.
Файл: `apis/predict/composite_risk.mjs` (12825 B, 379 строк, версия 1.0.1).

**English:**
The `composite_risk` module — Композитный индикатор риска.
File: `apis/predict/composite_risk.mjs` (12825 B, 379 lines, version 1.0.1).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **Z**, тип **meta**. Категория: api.
Timeout: 5000 ms.

Composite Risk Indicator — единый композитный индикатор риска.

**English:**
Module belongs to phase **Z**, type **meta**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе Z.
Регистрация: `apis/predict/register_coordinat_all.mjs` (имя composite_risk, экспорт composite_risk).

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase Z.
Registry: `apis/predict/register_coordinat_all.mjs` (name composite_risk).

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/composite_risk.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Паспорт фазы / Phase passport | `docs/modules/phase-Z.md` |
| Справка RU / Help RU | `docs/help/ru/api/composite_risk.md` |
| Справка EN / Help EN | `docs/help/en/api/composite_risk.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 12825 B.

**English:**
🟢 Active. File exists, size 12825 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.
- `docs/modules/phase-Z.md` — паспорт фазы.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { createRequire } from 'node:module';`

---

## 🧮 ТЕОРЕТИЧЕСКАЯ ОСНОВА / THEORETICAL BASIS

**Русский:**
Ансамбль с динамическими весами (Brier-based) + корректировки от
расширенных слоёв. Согласованность сигналов повышает confidence,
разногласие — понижает.

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
**Версия модуля:** 1.0.1
