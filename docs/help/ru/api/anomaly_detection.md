# anomaly_detection

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `anomaly_detection` — IsolationForest/LOF/Mahalanobis/SVM/DBSCAN.
Файл: `apis/predict/anomaly_detection.mjs` (23363 B, 788 строк, версия 6.0.0).

**English:**
The `anomaly_detection` module — IsolationForest/LOF/Mahalanobis/SVM/DBSCAN.
File: `apis/predict/anomaly_detection.mjs` (23363 B, 788 lines, version 6.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **T**, тип **predictive**. Категория: api.
Минимальная история: 20 sweep.
Timeout: 60000 ms.

**English:**
Module belongs to phase **T**, type **predictive**. Category: api.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе T.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase T.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/anomaly_detection.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/api/anomaly_detection.md` |
| Справка EN / Help EN | `docs/help/en/api/anomaly_detection.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 23363 B.

**English:**
🟢 Active. File exists, size 23363 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export function crucixAnomalyDetection(history, options = {}) {`
- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 20 | Минимум sweep для запуска |
| timeoutMs | number | 60000 | Таймаут выполнения (мс) |
| phase | string | T | Фаза конвейера |
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
**Версия модуля:** 6.0.0
