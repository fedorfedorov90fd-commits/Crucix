# opponent_ppo

## 📋 ABOUT

The `opponent_ppo` module — component of Crucix predictive core.
File: `apis/predict/opponent_ppo.mjs` (25128 B, 745 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **api**, type **predictive**. Category: api.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase api.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/opponent_ppo.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 25128 B.

---

## 📚 EXPORTS

- `export function trainOpponentPPO(opts = {}) {`
- `export function crucixOpponentPPO(history, opts = {}) {`
- `export { PPOAgent, AdversarialEnv, MLP };`

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
**Module version:** —
