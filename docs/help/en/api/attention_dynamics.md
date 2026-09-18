# attention_dynamics

## 📋 ABOUT

The `attention_dynamics` module — Коллективное внимание.
File: `apis/predict/attention_dynamics.mjs` (10763 B, 294 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **L3**, type **predictive**. Category: api.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase L3.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/attention_dynamics.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 10763 B.

---

## 📚 EXPORTS

- `export const meta = {`
- `export class AttentionDynamics {`
- `export function crucixAttentionDynamics(latest, history, stateFile = null) {`
- `export { extractTopicsFromSweep };`

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
