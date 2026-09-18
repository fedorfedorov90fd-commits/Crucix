# crucix_engine_v4

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `crucix_engine_v4` — Crucix Engine v4: Ultimate Edition.
Файл: `apis/predict/crucix_engine_v4.mjs` (9221 B, 279 строк, версия —).

**English:**
The `crucix_engine_v4` module — component of Crucix predictive core.
File: `apis/predict/crucix_engine_v4.mjs` (9221 B, 279 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **core**, тип **orchestrator**. Категория: core.

**English:**
Module belongs to phase **core**, type **orchestrator**. Category: core.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе core.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase core.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/crucix_engine_v4.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/core/crucix_engine_v4.md` |
| Справка EN / Help EN | `docs/help/en/core/crucix_engine_v4.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 9221 B.

**English:**
🟢 Active. File exists, size 9221 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export class CrucixEngineV4 {`
- `export async function runFullCrucixV4Cycle(latestPath, opts = {}) {`
- `export { runCrucixExtendedV3 };`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { runCrucixExtendedV3 } from './crucix_engine_v3.mjs';`
- `import { getHookManager } from '../../plugins/hooks.mjs';`
- `import { getPluginLoader } from '../../plugins/loader.mjs';`
- `import { getPluginRegistry } from '../../plugins/registry.mjs';`
- `import { getIntegrationManager } from '../../integrations/webhook_manager.mjs';`
- `import { loadOrCreateVAPIDKeys, SubscriptionStore, notifyPush, createPushHandlers } from '../../dashboard/pwa/push.js';`
- `import { handlePluginsAPI } from './plugins_api.mjs';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | core | Фаза конвейера |
| type | string | orchestrator | Тип модуля |

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
