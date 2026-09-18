# composite_risk

## 📋 ABOUT

The `composite_risk` module — Композитный индикатор риска.
File: `apis/predict/composite_risk.mjs` (12825 B, 379 lines, version 1.0.1).

---

## 🎯 PURPOSE

Module belongs to phase **Z**, type **meta**. Category: api.
Timeout: 5000 ms.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase Z.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/composite_risk.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |
| Phase passport | `docs/modules/phase-Z.md` |
| Help RU | `docs/help/ru/api/composite_risk.md` |
| Help EN | `docs/help/en/api/composite_risk.md` |

---

## 📊 STATUS

🟢 Active. File exists, size 12825 B.

---

## 🔗 RELATED MODULES

- `apis/predict/engine.mjs` — main orchestrator.
- `apis/predict/register_coordinat_all.mjs` — module registry.
- `docs/modules/phase-Z.md` — phase passport.

---

## 📚 EXPORTS

- `export {`

---

## 📦 IMPORTS

- `import { createRequire } from 'node:module';`

---

## 🧮 THEORETICAL BASIS

Ансамбль с динамическими весами (Brier-based) + корректировки от
расширенных слоёв. Согласованность сигналов повышает confidence,
разногласие — понижает.

---

## 📈 PARAMETERS

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| minHistory | number | 0 | Minimum sweeps to run |
| timeoutMs | number | 5000 | Timeout in ms |
| phase | string | Z | Pipeline phase |
| type | string | meta | Module type |

---

## ⚙️ EXECUTION FLOW

1. Orchestrator (engine.mjs) calls module at phase Z.
2. Module receives sweep and history.
3. Returns result into unified snapshot.
4. On error — recorded in forecast.failures.

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

## 🚧 ROADMAP

See `docs/book/07-improvements.md` — section for phase Z.

---

## 🔍 TESTS

Location: `tests/`. Check for module tests.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 1.0.1
