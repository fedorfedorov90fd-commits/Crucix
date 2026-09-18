# gcn

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `gcn` — Graph Convolutional Network.
Файл: `apis/predict/models/graph_neural.mjs` (7536 B, 253 строк, версия —).

**English:**
The `gcn` module — Graph Convolutional Network.
File: `apis/predict/models/graph_neural.mjs` (7536 B, 253 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **D**, тип **predictive**. Категория: models.
Минимальная история: 5 sweep.
Timeout: 20000 ms.

Graph Convolutional Network — нейросеть на графе событий.

**English:**
Module belongs to phase **D**, type **predictive**. Category: models.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе D.
Регистрация: `apis/predict/register_coordinat_all.mjs` (имя gcn, экспорт gcn).

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase D.
Registry: `apis/predict/register_coordinat_all.mjs` (name gcn).

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/models/graph_neural.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Паспорт фазы / Phase passport | `docs/modules/phase-D.md` |
| Справка RU / Help RU | `docs/help/ru/models/gcn.md` |
| Справка EN / Help EN | `docs/help/en/models/gcn.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 7536 B.

**English:**
🟢 Active. File exists, size 7536 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.
- `docs/modules/phase-D.md` — паспорт фазы.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { GCN, crucixGCNAnalysis };`

---

## 📦 ИМПОРТЫ / IMPORTS

—

---

## 🧮 ТЕОРЕТИЧЕСКАЯ ОСНОВА / THEORETICAL BASIS

**Русский:**
Kipf, T. N., & Welling, M. (2017). "Semi-Supervised Classification with
Graph Convolutional Networks". ICLR. arXiv:1609.02907.
Hamilton, W. L., Ying, R., & Leskovec, J. (2017). "Inductive
Representation Learning on Large Graphs". NeurIPS.
GCN-слой: H' = σ(D̂^{−1/2} · Â · D̂^{−1/2} · H · W)
где Â = A + I (adjacency + self-loop),
D̂ — матрица степеней.
Каждый узел агрегирует информацию от соседей через нормализованную
матрицу смежности. K слоёв = K-хоповая окрестность.

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 5 | Минимум sweep для запуска |
| timeoutMs | number | 20000 | Таймаут выполнения (мс) |
| phase | string | D | Фаза конвейера |
| type | string | predictive | Тип модуля |

---

## ⚙️ ПОТОК ВЫПОЛНЕНИЯ / EXECUTION FLOW

1. Оркестратор (engine.mjs) вызывает модуль в фазе D.
2. Модуль получает sweep и history.
3. Возвращает результат в единый snapshot.
4. При ошибке — фиксируется в forecast.failures.

---

## 📊 ПРИМЕНЕНИЕ В CRUCIX / APPLICATION IN CRUCIX

Узлы = события/страны/акторы. Каждый узел имеет признаки (интенсивность,
тип, время). GCN прогнозирует класс каждого узла (low/medium/high impact)
с учётом связей между узлами.
============================================================
Матричные утилиты
============================================================

---

## 📝 ИСТОРИЯ ИЗМЕНЕНИЙ / CHANGELOG

- 2026-09-17 — создана справка.

---

## 🚧 ЧТО НАРАСТИТЬ / ROADMAP

См. `docs/book/07-improvements.md` — раздел по фазе D.

---

## 🔍 ТЕСТЫ / TESTS

Местоположение: `tests/`. Проверить наличие тестов для модуля.

---

**Создано:** 2026-09-17
**Актуально на:** 2026-09-17
**Версия модуля:** —
