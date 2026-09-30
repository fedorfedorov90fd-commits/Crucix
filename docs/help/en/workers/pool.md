# pool

## 📋 ABOUT

The `pool` module — component of Crucix predictive core.
File: `apis/predict/workers/pool.mjs` (6438 B, 228 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **workers**, type **math**. Category: workers.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase workers.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/workers/pool.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 6438 B.

---

## 📚 EXPORTS

- `export function getWorkerPool(options = {}) {`
- `export function resetWorkerPool() {`
- `export { WorkerPool, N_CPUS, DEFAULT_POOL_SIZE };`
- `export async function parallelMonteCarlo(config, totalIterations = 10000) {`
- `export async function parallelMatrixMultiply(matrices) {`

---

## 📦 IMPORTS

- `import { Worker } from 'node:worker_threads';`
- `import { cpus } from 'node:os';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
