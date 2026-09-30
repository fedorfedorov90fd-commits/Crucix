# fl_node

## 📋 ABOUT

The `fl_node` module — component of Crucix predictive core.
File: `apis/predict/federated/fl_node.mjs` (6096 B, 30 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **federated**, type **predictive**. Category: federated.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase federated.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/federated/fl_node.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 6096 B.

---

## 📚 EXPORTS

- `export { FLNode, readBody };`

---

## 📦 IMPORTS

- `import { createServer } from 'node:http';`
- `import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { MLP } from '../models/neural.mjs';`
- `import { FederatedClient, FederatedServer, federatedAveraging } from './fl_protocol.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
