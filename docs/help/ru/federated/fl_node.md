# fl_node

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `fl_node` — Federated Learning Node: HTTP-сервер + клиент.
Файл: `apis/predict/federated/fl_node.mjs` (6096 B, 30 строк, версия —).

**English:**
The `fl_node` module — component of Crucix predictive core.
File: `apis/predict/federated/fl_node.mjs` (6096 B, 30 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **federated**, тип **predictive**. Категория: federated.

**English:**
Module belongs to phase **federated**, type **predictive**. Category: federated.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе federated.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase federated.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/federated/fl_node.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/federated/fl_node.md` |
| Справка EN / Help EN | `docs/help/en/federated/fl_node.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 6096 B.

**English:**
🟢 Active. File exists, size 6096 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { FLNode, readBody };`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { createServer } from 'node:http';`
- `import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { MLP } from '../models/neural.mjs';`
- `import { FederatedClient, FederatedServer, federatedAveraging } from './fl_protocol.mjs';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 0 | Таймаут выполнения (мс) |
| phase | string | federated | Фаза конвейера |
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
