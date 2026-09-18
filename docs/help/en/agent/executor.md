# executor

## 📋 ABOUT

The `executor` module — component of Crucix predictive core.
File: `apis/predict/agent/executor.mjs` (15111 B, 466 lines, version 8.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **agent**, type **agent**. Category: agent.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase agent.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/agent/executor.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 15111 B.

---

## 📚 EXPORTS

- `export async function executePlan(plan, registry, options = {}) {`
- `export {`

---

## 📦 IMPORTS

- `import { existsSync, readFileSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 8.0.0
