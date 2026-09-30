# zk_federated

## 📋 ABOUT

The `zk_federated` module — ZK-Schnorr + DP.
File: `apis/predict/v6/zk_federated.mjs` (23280 B, 599 lines, version 6.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **S**, type **predictive**. Category: v6.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase S.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/v6/zk_federated.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 23280 B.

---

## 📚 EXPORTS

- `export function crucixZKFederated(history, options = {}) {`
- `export { ZKSchnorrProver, DPMechanism, FederatedNode, SecureAggregator };`

---

## 📦 IMPORTS

- `import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { createHash } from 'node:crypto';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 6.0.0
