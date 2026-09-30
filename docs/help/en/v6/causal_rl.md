# causal_rl

## 📋 ABOUT

The `causal_rl` module — Causal RL.
File: `apis/predict/v6/causal_rl.mjs` (22130 B, 637 lines, version 6.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **S**, type **predictive**. Category: v6.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase S.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/v6/causal_rl.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 22130 B.

---

## 📚 EXPORTS

- `export function crucixCausalRL(history, options = {}) {`
- `export { CausalEnvironment, CausalQLearner, CausalPolicyGradient, buildCausalEnvFromHistory };`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 6.0.0
