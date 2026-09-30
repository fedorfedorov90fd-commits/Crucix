# gpu

## 📋 ABOUT

The `gpu` module — component of Crucix predictive core.
File: `apis/predict/webgl/gpu.mjs` (11155 B, 365 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **webgl**, type **math**. Category: webgl.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase webgl.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/webgl/gpu.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 11155 B.

---

## 📚 EXPORTS

- `export async function initGPU() {`
- `export function gpuMatmul(A, B) {`
- `export function gpuElementwise(A, B, op = 'add') {`
- `export function gpuActivation(X, type = 'relu') {`
- `export function gpuStatus() {`
- `export function gpuBenchmark(n = 128) {`
- `export const GPU_INFO = {`

---

## 📦 IMPORTS

- `import { SHADER_SOURCES } from './shaders.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
