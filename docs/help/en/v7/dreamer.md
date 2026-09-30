# dreamer

## 📋 ABOUT

The `dreamer` module — component of Crucix predictive core.
File: `apis/predict/v7/dreamer.mjs` (28183 B, 858 lines, version 7.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **U**, type **predictive**. Category: v7.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase U.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/v7/dreamer.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 28183 B.

---

## 📚 EXPORTS

- `export function crucixDreamer(history, options = {}) {`
- `export { Dreamer, Actor, Critic, computeReward };`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { WorldModel } from './world_model.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 7.0.0
