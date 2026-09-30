# resource_exhaustion

## 📋 ABOUT

The `resource_exhaustion` module — Истощение ресурсов.
File: `apis/predict/resource_exhaustion.mjs` (16081 B, 418 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **J3**, type **predictive**. Category: api.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase J3.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/resource_exhaustion.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 16081 B.

---

## 📚 EXPORTS

- `export const meta = {`
- `export class MilitaryExhaustionModel {`
- `export class EconomicExhaustionModel {`
- `export function crucixResourceExhaustion(latest, history) {`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname, resolve } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
