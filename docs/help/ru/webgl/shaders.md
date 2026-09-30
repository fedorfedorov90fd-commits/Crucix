# shaders

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `shaders` — GLSL шейдеры для GPU-вычислений Работают в браузере (WebGL) и в Node.js (headless-gl).
Файл: `apis/predict/webgl/shaders.mjs` (4827 B, 223 строк, версия —).

**English:**
The `shaders` module — component of Crucix predictive core.
File: `apis/predict/webgl/shaders.mjs` (4827 B, 223 lines, version —).

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
| Модуль / Module | `apis/predict/webgl/shaders.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/webgl/shaders.md` |
| Справка EN / Help EN | `docs/help/en/webgl/shaders.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 4827 B.

**English:**
🟢 Active. File exists, size 4827 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export const VERTEX_SHADER = ``
- `export const MATMUL_FRAGMENT = ``
- `export const ELEMENTWISE_FRAGMENT = ``
- `export const ACTIVATION_FRAGMENT = ``
- `export const SOFTMAX_FRAGMENT = ``
- `export const AXPY_FRAGMENT = ``
- `export const ADAM_FRAGMENT = ``
- `export const SHADER_SOURCES = {`

---

## 📦 ИМПОРТЫ / IMPORTS

—

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
