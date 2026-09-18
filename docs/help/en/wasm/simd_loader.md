# simd_loader

## 📋 ABOUT

The `simd_loader` module — component of Crucix predictive core.
File: `apis/predict/wasm/simd_loader.mjs` (7668 B, 257 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **wasm**, type **math**. Category: wasm.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase wasm.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/wasm/simd_loader.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 7668 B.

---

## 📚 EXPORTS

- `export async function initSIMD() {`
- `export function dotProduct(a, b) {`
- `export function matrixMultiply(A, B) {`
- `export function l2Norm(x) {`
- `export function relu(x) {`
- `export function add(a, b) {`
- `export function scalarMultiply(x, scalar) {`
- `export function maxValue(x) {`
- `export function simdStatus() {`
- `export function benchmarkAll(n = 100) {`
- `export const SIMD_INFO = {`

---

## 📦 IMPORTS

- `import { readFileSync, existsSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
