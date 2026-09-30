# engine_v6_patch

## 📋 ABOUT

The `engine_v6_patch` module — component of Crucix predictive core.
File: `apis/predict/engine_v6_patch.mjs` (26040 B, 772 lines, version 1.0.0).

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
| Module | `apis/predict/engine_v6_patch.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 26040 B.

---

## 📚 EXPORTS

- `export async function runV6Phase(history, options = {}) {`
- `export async function runCatalogPhase(history, options = {}) {`
- `export function applyV6ToSnapshot(snapshot, v6Phase, catalogPhase) {`
- `export async function runNewPhases(history, options = {}) {`
- `export function healthcheck() {`
- `export {`

---

## 📦 IMPORTS

- `import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 1.0.0
