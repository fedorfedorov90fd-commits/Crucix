# plugins_api

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `plugins_api` — REST API для управления плагинами.
Файл: `apis/predict/plugins_api.mjs` (10788 B, 368 строк, версия —).

**English:**
The `plugins_api` module — component of Crucix predictive core.
File: `apis/predict/plugins_api.mjs` (10788 B, 368 lines, version —).

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
| Модуль / Module | `apis/predict/plugins_api.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/plugins_api.md` |
| Справка EN / Help EN | `docs/help/en/api/plugins_api.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 10788 B.

**English:**
🟢 Active. File exists, size 10788 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export async function handlePluginsAPI(req, res, url) {`
- `export { PluginManager, getManager as getPluginManager };`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, cpSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { getPluginLoader } from '../../plugins/loader.mjs';`
- `import { getHookManager } from '../../plugins/hooks.mjs';`
- `import { getPluginRegistry, FEATURED_PLUGINS } from '../../plugins/registry.mjs';`

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
