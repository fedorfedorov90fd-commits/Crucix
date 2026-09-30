# multiscale_attention

## 📋 ABOUT

The `multiscale_attention` module — component of Crucix predictive core.
File: `apis/predict/multiscale_attention.mjs` (15179 B, 431 lines, version —).

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
| Module | `apis/predict/multiscale_attention.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 15179 B.

---

## 📚 EXPORTS

- `export class MultiScaleAttention {`
- `export function crucixMultiScaleAttention(history, stateFile = null) {`
- `export { AttentionScale };`

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
