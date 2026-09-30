# knowledge_graph

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `knowledge_graph` — Граф знаний.
Файл: `apis/knowledge/graph.mjs` (12921 B, 384 строк, версия 2.0.0).

**English:**
The `knowledge_graph` module — Граф знаний.
File: `apis/knowledge/graph.mjs` (12921 B, 384 lines, version 2.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **G**, тип **meta**. Категория: sources.
Timeout: 10000 ms.

Граф знаний Crucix (knowledge graph). Синтез из knowledge/graph.mjs и entity_model/graph.mjs.

**English:**
Module belongs to phase **G**, type **meta**. Category: sources.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе G.
Регистрация: `apis/predict/register_coordinat_all.mjs` (имя knowledge_graph, экспорт knowledge_graph).

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase G.
Registry: `apis/predict/register_coordinat_all.mjs` (name knowledge_graph).

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/knowledge/graph.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Паспорт фазы / Phase passport | `docs/modules/phase-G.md` |
| Справка RU / Help RU | `docs/help/ru/sources/knowledge_graph.md` |
| Справка EN / Help EN | `docs/help/en/sources/knowledge_graph.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 12921 B.

**English:**
🟢 Active. File exists, size 12921 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.
- `docs/modules/phase-G.md` — паспорт фазы.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 🧮 ТЕОРЕТИЧЕСКАЯ ОСНОВА / THEORETICAL BASIS

**Русский:**
Hogan, A. et al. (2021). "Knowledge Graphs". ACM Computing Surveys,
54(4), 1-37.
Ji, S., Pan, S., Cambria, E., Marttinen, P., & Yu, P. S. (2021).
"A Survey on Knowledge Graphs". IEEE TNNLS, 33(2), 494-514.

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 0 | Минимум sweep для запуска |
| timeoutMs | number | 10000 | Таймаут выполнения (мс) |
| phase | string | G | Фаза конвейера |
| type | string | meta | Тип модуля |

---

## ⚙️ ПОТОК ВЫПОЛНЕНИЯ / EXECUTION FLOW

1. Оркестратор (engine.mjs) вызывает модуль в фазе G.
2. Модуль получает sweep и history.
3. Возвращает результат в единый snapshot.
4. При ошибке — фиксируется в forecast.failures.

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ / CHANGELOG

- 2026-09-17 — создана справка.

---

## 🚧 ЧТО НАРАСТИТЬ / ROADMAP

См. `docs/book/07-improvements.md` — раздел по фазе G.

---

## 🔍 ТЕСТЫ / TESTS

Местоположение: `tests/`. Проверить наличие тестов для модуля.

---

**Создано:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия модуля:** 2.0.0
