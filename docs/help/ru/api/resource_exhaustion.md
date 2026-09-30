# resource_exhaustion

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `resource_exhaustion` — Истощение ресурсов.
Файл: `apis/predict/resource_exhaustion.mjs` (16081 B, 418 строк, версия —).

**English:**
The `resource_exhaustion` module — Истощение ресурсов.
File: `apis/predict/resource_exhaustion.mjs` (16081 B, 418 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **J3**, тип **predictive**. Категория: api.
Минимальная история: 10 sweep.
Timeout: 20000 ms.

**English:**
Module belongs to phase **J3**, type **predictive**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе J3.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase J3.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/resource_exhaustion.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/resource_exhaustion.md` |
| Справка EN / Help EN | `docs/help/en/api/resource_exhaustion.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 16081 B.

**English:**
🟢 Active. File exists, size 16081 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export const meta = {`
- `export class MilitaryExhaustionModel {`
- `export class EconomicExhaustionModel {`
- `export function crucixResourceExhaustion(latest, history) {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname, resolve } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 10 | Минимум sweep для запуска |
| timeoutMs | number | 20000 | Таймаут выполнения (мс) |
| phase | string | J3 | Фаза конвейера |
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
