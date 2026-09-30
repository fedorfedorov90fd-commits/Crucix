# example_gpu

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `example_gpu` — Пример использования GPU-ускорения.
Файл: `apis/predict/webgl/example_gpu.mjs` (2136 B, 52 строк, версия —).

**English:**
The `example_gpu` module — component of Crucix predictive core.
File: `apis/predict/webgl/example_gpu.mjs` (2136 B, 52 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **webgl**, тип **math**. Категория: webgl.

**English:**
Module belongs to phase **webgl**, type **math**. Category: webgl.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе webgl.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase webgl.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/webgl/example_gpu.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/webgl/example_gpu.md` |
| Справка EN / Help EN | `docs/help/en/webgl/example_gpu.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 2136 B.

**English:**
🟢 Active. File exists, size 2136 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { main };`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { initGPU, gpuMatmul, gpuElementwise, gpuBenchmark, gpuStatus } from './gpu.mjs';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | webgl | Фаза конвейера |
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
