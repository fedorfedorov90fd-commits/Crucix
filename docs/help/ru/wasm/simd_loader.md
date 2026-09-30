# simd_loader

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `simd_loader` — Загрузчик SIMD-WASM с многоуровневым fallback: 1. SIMD WASM (быстрее всего, 3-4x над скалярным) 2. Скалярный WASM (5-10x над JS) 3. Чистый JS (всегда работает).
Файл: `apis/predict/wasm/simd_loader.mjs` (7668 B, 257 строк, версия —).

**English:**
The `simd_loader` module — component of Crucix predictive core.
File: `apis/predict/wasm/simd_loader.mjs` (7668 B, 257 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **wasm**, тип **math**. Категория: wasm.

**English:**
Module belongs to phase **wasm**, type **math**. Category: wasm.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе wasm.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase wasm.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/wasm/simd_loader.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/wasm/simd_loader.md` |
| Справка EN / Help EN | `docs/help/en/wasm/simd_loader.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 7668 B.

**English:**
🟢 Active. File exists, size 7668 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export async function initSIMD() {`
- `export function dotProduct(a, b) {`
- `export function matrixMultiply(A, B) {`
- `export function l2Norm(x) {`
- `export function relu(x) {`
- `export function add(a, b) {`
- `export function scalarMultiply(x, scalar) {`
- `export function maxValue(x) {`
- `export function simdStatus() {`
- `export function benchmarkAll(n = 100) {`
- `export const SIMD_INFO = {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { readFileSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | wasm | Фаза конвейера |
| type | string | math | Тип модуля |

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
