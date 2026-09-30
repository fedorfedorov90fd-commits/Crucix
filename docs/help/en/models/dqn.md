# dqn

## 📋 ABOUT

The `dqn` module — Deep Q-Network.
File: `apis/predict/models/reinforcement.mjs` (21795 B, 726 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **D**, type **meta**. Category: models.
Minimum history: 10 sweep.
Timeout: 20000 ms.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase D.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/models/reinforcement.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |
| Phase passport | `docs/modules/phase-D.md` |
| Help RU | `docs/help/ru/models/dqn.md` |
| Help EN | `docs/help/en/models/dqn.md` |

---

## 📊 STATUS

🟢 Active. File exists, size 21795 B.

---

## 🔗 RELATED MODULES

- `apis/predict/engine.mjs` — main orchestrator.
- `apis/predict/register_coordinat_all.mjs` — module registry.
- `docs/modules/phase-D.md` — phase passport.

---

## 📚 EXPORTS

- `export {`

---

## 📦 IMPORTS

—

---

## 🧮 THEORETICAL BASIS

Sutton & Barto (2018). "Reinforcement Learning: An Introduction" (2nd ed.).
Mnih et al. (2015). "Human-level control through deep RL". Nature, 518.
Williams (1992). "Simple statistical gradient-following algorithms".
Schulman et al. (2017). "Proximal Policy Optimization". arXiv:1707.06347.

---

## 📈 PARAMETERS

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| minHistory | number | 10 | Minimum sweeps to run |
| timeoutMs | number | 20000 | Timeout in ms |
| phase | string | D | Pipeline phase |
| type | string | meta | Module type |

---

## ⚙️ EXECUTION FLOW

1. Orchestrator (engine.mjs) calls module at phase D.
2. Module receives sweep and history.
3. Returns result into unified snapshot.
4. On error — recorded in forecast.failures.

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

## 🚧 ROADMAP

See `docs/book/07-improvements.md` — section for phase D.

---

## 🔍 TESTS

Location: `tests/`. Check for module tests.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
