# regime_shift

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `regime_shift` — Детектор смены режима.
Файл: `apis/predict/regime_shift.mjs` (10661 B, 354 строк, версия —).

**English:**
The `regime_shift` module — Детектор смены режима.
File: `apis/predict/regime_shift.mjs` (10661 B, 354 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **E**, тип **predictive**. Категория: api.
Минимальная история: 20 sweep.
Timeout: 20000 ms.

**English:**
Module belongs to phase **E**, type **predictive**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе E.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase E.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/regime_shift.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/regime_shift.md` |
| Справка EN / Help EN | `docs/help/en/api/regime_shift.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 10661 B.

**English:**
🟢 Active. File exists, size 10661 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 20 | Минимум sweep для запуска |
| timeoutMs | number | 20000 | Таймаут выполнения (мс) |
| phase | string | E | Фаза конвейера |
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
