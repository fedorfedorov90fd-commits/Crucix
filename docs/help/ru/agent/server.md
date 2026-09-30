# server

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `server` — HTTP + WebSocket сервер для AI Agent Crucix..
Файл: `apis/predict/agent/server.mjs` (18350 B, 557 строк, версия 8.0.0).

**English:**
The `server` module — component of Crucix predictive core.
File: `apis/predict/agent/server.mjs` (18350 B, 557 lines, version 8.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **agent**, тип **agent**. Категория: agent.

**English:**
Module belongs to phase **agent**, type **agent**. Category: agent.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе agent.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase agent.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/agent/server.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/agent/server.md` |
| Справка EN / Help EN | `docs/help/en/agent/server.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 18350 B.

**English:**
🟢 Active. File exists, size 18350 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { AgentServer };`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { createServer } from 'node:http';`
- `import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { createHash } from 'node:crypto';`
- `import { Planner } from './planner.mjs';`
- `import { ToolRegistry, loadHistory } from './tool_registry.mjs';`
- `import { narrate } from './narrator.mjs';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | agent | Фаза конвейера |
| type | string | agent | Тип модуля |

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ / CHANGELOG

- 2026-09-17 — создана справка.

---

## 🚧 ЧТО НАРАСТИТЬ / ROADMAP

См. `docs/book/07-improvements.md`.

---

**Создано:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия модуля:** 8.0.0
