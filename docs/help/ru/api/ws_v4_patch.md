# ws_v4_patch

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `ws_v4_patch` — Патч для ws.mjs — добавление v4 endpoints.
Файл: `apis/predict/ws_v4_patch.mjs` (2187 B, 53 строк, версия —).

**English:**
The `ws_v4_patch` module — component of Crucix predictive core.
File: `apis/predict/ws_v4_patch.mjs` (2187 B, 53 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **api**, тип **predictive**. Категория: api.

**English:**
Module belongs to phase **api**, type **predictive**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе api.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase api.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/ws_v4_patch.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/ws_v4_patch.md` |
| Справка EN / Help EN | `docs/help/en/api/ws_v4_patch.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 2187 B.

**English:**
🟢 Active. File exists, size 2187 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export const WS_V4_PATCH = ``

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { handlePluginsAPI } from './plugins_api.mjs';`
- `import { loadOrCreateVAPIDKeys, SubscriptionStore, createPushHandlers } from '../../dashboard/pwa/push.js';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | api | Фаза конвейера |
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
