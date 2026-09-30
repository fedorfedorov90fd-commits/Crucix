# server

## 📋 ABOUT

The `server` module — component of Crucix predictive core.
File: `apis/predict/agent/server.mjs` (18350 B, 557 lines, version 8.0.0).

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
| Module | `apis/predict/agent/server.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 18350 B.

---

## 📚 EXPORTS

- `export { AgentServer };`

---

## 📦 IMPORTS

- `import { createServer } from 'node:http';`
- `import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { createHash } from 'node:crypto';`
- `import { Planner } from './planner.mjs';`
- `import { ToolRegistry, loadHistory } from './tool_registry.mjs';`
- `import { narrate } from './narrator.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 8.0.0
