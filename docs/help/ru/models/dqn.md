# dqn

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `dqn` — Deep Q-Network.
Файл: `apis/predict/models/reinforcement.mjs` (21795 B, 726 строк, версия —).

**English:**
The `dqn` module — Deep Q-Network.
File: `apis/predict/models/reinforcement.mjs` (21795 B, 726 lines, version —).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **D**, тип **meta**. Категория: models.
Минимальная история: 10 sweep.
Timeout: 20000 ms.

Reinforcement Learning для прогностического слоя Crucix.

**English:**
Module belongs to phase **D**, type **meta**. Category: models.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе D.
Регистрация: `apis/predict/register_coordinat_all.mjs` (имя dqn, экспорт dqn).

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase D.
Registry: `apis/predict/register_coordinat_all.mjs` (name dqn).

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/models/reinforcement.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Паспорт фазы / Phase passport | `docs/modules/phase-D.md` |
| Справка RU / Help RU | `docs/help/ru/models/dqn.md` |
| Справка EN / Help EN | `docs/help/en/models/dqn.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 21795 B.

**English:**
🟢 Active. File exists, size 21795 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.
- `docs/modules/phase-D.md` — паспорт фазы.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export {`

---

## 📦 ИМПОРТЫ / IMPORTS

—

---

## 🧮 ТЕОРЕТИЧЕСКАЯ ОСНОВА / THEORETICAL BASIS

**Русский:**
Sutton & Barto (2018). "Reinforcement Learning: An Introduction" (2nd ed.).
Mnih et al. (2015). "Human-level control through deep RL". Nature, 518.
Williams (1992). "Simple statistical gradient-following algorithms".
Schulman et al. (2017). "Proximal Policy Optimization". arXiv:1707.06347.

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 10 | Минимум sweep для запуска |
| timeoutMs | number | 20000 | Таймаут выполнения (мс) |
| phase | string | D | Фаза конвейера |
| type | string | meta | Тип модуля |

---

## ⚙️ ПОТОК ВЫПОЛНЕНИЯ / EXECUTION FLOW

1. Оркестратор (engine.mjs) вызывает модуль в фазе D.
2. Модуль получает sweep и history.
3. Возвращает результат в единый snapshot.
4. При ошибке — фиксируется в forecast.failures.

---

## 📊 ПРИМЕНЕНИЕ В CRUCIX / APPLICATION IN CRUCIX

Оптимизация политики алертов. Агент учится, когда отправлять алерт,
когда молчать. Состояние — метрики sweep. Действия — 0=silent,
1=normal_alert, 2=critical_alert. Награда — за корректные срабатывания.
============================================================
Replay Buffer
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
