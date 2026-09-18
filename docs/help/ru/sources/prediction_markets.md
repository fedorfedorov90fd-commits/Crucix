# prediction_markets

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `prediction_markets` — Polymarket/Metaculus/Kalshi.
Файл: `apis/sources/prediction_markets.mjs` (12578 B, 372 строк, версия —).

**English:**
The `prediction_markets` module — Polymarket/Metaculus/Kalshi.
File: `apis/sources/prediction_markets.mjs` (12578 B, 372 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **F**, тип **source**. Категория: sources.
Timeout: 15000 ms.

**English:**
Module belongs to phase **F**, type **source**. Category: sources.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе F.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase F.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/sources/prediction_markets.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/sources/prediction_markets.md` |
| Справка EN / Help EN | `docs/help/en/sources/prediction_markets.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 12578 B.

**English:**
🟢 Active. File exists, size 12578 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export async function fetchPolymarket(query = null) {`
- `export async function fetchMetaculus(query = null) {`
- `export async function fetchKalshi(query = null) {`
- `export async function fetchManifold(query = null) {`
- `export function crossPlatformAnalysis(allMarkets) {`
- `export function ensembleWithCrucix(marketData, crucixForecast) {`
- `export async function fetchPredictionMarkets(query = null) {`
- `export { PLATFORMS };`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 15000 | Таймаут выполнения (мс) |
| phase | string | F | Фаза конвейера |
| type | string | source | Тип модуля |

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
