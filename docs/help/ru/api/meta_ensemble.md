# meta_ensemble

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `meta_ensemble` — Online model selection.
Файл: `apis/predict/meta_ensemble.mjs` (15513 B, 416 строк, версия —).

**English:**
The `meta_ensemble` module — Online model selection.
File: `apis/predict/meta_ensemble.mjs` (15513 B, 416 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **J3**, тип **meta**. Категория: api.
Минимальная история: 20 sweep.
Timeout: 20000 ms.

**English:**
Module belongs to phase **J3**, type **meta**. Category: api.

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
| Модуль / Module | `apis/predict/meta_ensemble.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/meta_ensemble.md` |
| Справка EN / Help EN | `docs/help/en/api/meta_ensemble.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 15513 B.

**English:**
🟢 Active. File exists, size 15513 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export const meta = {`
- `export class MetaLearner {`
- `export function extractRegimeSignature(latest, history) {`
- `export const DEFAULT_MODELS = [`
- `export class MetaEnsemble {`
- `export function crucixMetaEnsemble(latest, history, modelPredictionsByEvent) {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname, resolve } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 20 | Минимум sweep для запуска |
| timeoutMs | number | 20000 | Таймаут выполнения (мс) |
| phase | string | J3 | Фаза конвейера |
| type | string | meta | Тип модуля |

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
