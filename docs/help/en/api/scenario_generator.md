# scenario_generator

## 📋 ABOUT

The `scenario_generator` module — LLM-генерация сценариев.
File: `apis/predict/scenario_generator.mjs` (13155 B, 284 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **K3**, type **predictive**. Category: api.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase K3.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/scenario_generator.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 13155 B.

---

## 📚 EXPORTS

- `export const meta = {`
- `export class LLMProvider {`
- `export class ScenarioGenerator {`
- `export async function crucixScenarioGeneration(latest, context = {}) {`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync } from 'node:fs';`
- `import { join, dirname, resolve } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
