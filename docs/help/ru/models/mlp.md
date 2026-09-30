# mlp

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `mlp` — MLP нейросеть.
Файл: `apis/predict/models/neural.mjs` (8165 B, 275 строк, версия —).

**English:**
The `mlp` module — MLP нейросеть.
File: `apis/predict/models/neural.mjs` (8165 B, 275 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **D**, тип **predictive**. Категория: models.
Минимальная история: 30 sweep.
Timeout: 30000 ms.

MLP с обратным распространением ошибки — на чистом JS.

**English:**
Module belongs to phase **D**, type **predictive**. Category: models.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе D.
Регистрация: `apis/predict/register_coordinat_all.mjs` (имя mlp, экспорт mlp).

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase D.
Registry: `apis/predict/register_coordinat_all.mjs` (name mlp).

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/models/neural.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Паспорт фазы / Phase passport | `docs/modules/phase-D.md` |
| Справка RU / Help RU | `docs/help/ru/models/mlp.md` |
| Справка EN / Help EN | `docs/help/en/models/mlp.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 8165 B.

**English:**
🟢 Active. File exists, size 8165 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.
- `docs/modules/phase-D.md` — паспорт фазы.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export { MLP, crucixMLPAnalysis };`

---

## 📦 ИМПОРТЫ / IMPORTS

—

---

## 🧮 ТЕОРЕТИЧЕСКАЯ ОСНОВА / THEORETICAL BASIS

**Русский:**
Rumelhart, D. E., Hinton, G. E., & Williams, R. J. (1986).
"Learning representations by back-propagating errors". Nature, 323, 533-536.
Goodfellow, I., Bengio, Y., & Courville, A. (2016). "Deep Learning".
MIT Press. Главы 6-8.
Forward:  a^l = σ(W^l · a^{l-1} + b^l)
Backward: δ^L = ∇_a C ⊙ σ'(z^L)
δ^l = ((W^{l+1})ᵀ · δ^{l+1}) ⊙ σ'(z^l)
∂C/∂W^l = δ^l · (a^{l-1})ᵀ

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 30 | Минимум sweep для запуска |
| timeoutMs | number | 30000 | Таймаут выполнения (мс) |
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

Нелинейная классификация режима системы (stable/escalation/crisis)
по вектору признаков из sweep. Работает там, где линейные модели
не справляются — например, при сложных взаимодействиях признаков.
============================================================
MLP
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
