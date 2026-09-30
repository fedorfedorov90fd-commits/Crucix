# adversarial_coevolution

## 📋 ABOUT

The `adversarial_coevolution` module — Адаптация противника.
File: `apis/predict/adversarial_coevolution.mjs` (12704 B, 311 lines, version —).

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
| Module | `apis/predict/adversarial_coevolution.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 12704 B.

---

## 📚 EXPORTS

- `export const meta = {`
- `export class OpponentModel {`
- `export class AdversarialCoEvolution {`
- `export function crucixAdversarialCoEvolution(latest, history, stateFile = null) {`

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
