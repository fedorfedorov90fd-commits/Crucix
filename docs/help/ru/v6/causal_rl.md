# causal_rl

## 📋 О МОДУЛЕ / ABOUT

**Русский:**
Модуль `causal_rl` — Causal RL.
Файл: `apis/predict/v6/causal_rl.mjs` (22130 B, 637 строк, версия 6.0.0).

**English:**
The `causal_rl` module — Causal RL.
File: `apis/predict/v6/causal_rl.mjs` (22130 B, 637 lines, version 6.0.0).

---

## 🎯 НАЗНАЧЕНИЕ / PURPOSE

**Русский:**
Модуль относится к фазе **S**, тип **predictive**. Категория: v6.
Минимальная история: 20 sweep.
Timeout: 120000 ms.

**English:**
Module belongs to phase **S**, type **predictive**. Category: v6.

---

## 🚀 КАК ИСПОЛЬЗОВАТЬ / HOW TO USE

**Русский:**
Модуль вызывается оркестратором `apis/predict/engine.mjs` в фазе S.
Регистрация: `apis/predict/register_coordinat_all.mjs`.

**English:**
Module is called by orchestrator `apis/predict/engine.mjs` at phase S.

---

## 📍 МЕСТОПОЛОЖЕНИЕ / LOCATION

| Файл / File | Путь / Path |
|-------------|-------------|
| Модуль / Module | `apis/predict/v6/causal_rl.mjs` |
| Оркестратор / Orchestrator | `apis/predict/engine.mjs` |
| Реестр / Registry | `apis/predict/register_coordinat_all.mjs` |
| Справка RU / Help RU | `docs/help/ru/v6/causal_rl.md` |
| Справка EN / Help EN | `docs/help/en/v6/causal_rl.md` |

---

## 📊 СТАТУС / STATUS

**Русский:**
🟢 Активен. Файл найден, размер 22130 B.

**English:**
🟢 Active. File exists, size 22130 B.

---

## 🔗 СВЯЗАННЫЕ МОДУЛИ / RELATED MODULES

- `apis/predict/engine.mjs` — главный оркестратор.
- `apis/predict/register_coordinat_all.mjs` — реестр модулей.

---

## 📚 ЭКСПОРТЫ / EXPORTS

- `export function crucixCausalRL(history, options = {}) {`
- `export { CausalEnvironment, CausalQLearner, CausalPolicyGradient, buildCausalEnvFromHistory };`

---

## 📦 ИМПОРТЫ / IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📈 ПАРАМЕТРЫ / PARAMETERS

| Параметр / Parameter | Тип / Type | Значение / Value | Описание / Description |
|----------------------|-----------|------------------|------------------------|
| minHistory | number | 20 | Минимум sweep для запуска |
| timeoutMs | number | 120000 | Таймаут выполнения (мс) |
| phase | string | S | Фаза конвейера |
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
