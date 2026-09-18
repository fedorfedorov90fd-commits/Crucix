# planner

## 📋 ABOUT

The `planner` module — component of Crucix predictive core.
File: `apis/predict/agent/planner.mjs` (13376 B, 365 lines, version 8.0.0).

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
| Module | `apis/predict/agent/planner.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 13376 B.

---

## 📚 EXPORTS

- `export async function planQuery(query, options = {}) {`
- `export async function executeQuery(query, options = {}) {`
- `export async function runAgentPipeline(query, options = {}) {`
- `export { Planner };`

---

## 📦 IMPORTS

- `import { AgentCore } from './agent_core.mjs';`
- `import { ToolRegistry, loadHistory } from './tool_registry.mjs';`
- `import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 8.0.0
