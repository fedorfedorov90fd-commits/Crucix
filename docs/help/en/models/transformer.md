# transformer

## 📋 ABOUT

The `transformer` module — component of Crucix predictive core.
File: `apis/predict/models/transformer.mjs` (20392 B, 54 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **models**, type **predictive**. Category: models.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase models.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/models/transformer.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 20392 B.

---

## 📚 EXPORTS

- `export { Transformer, TransformerBlock, MultiHeadAttention, LayerNorm, FeedForward, positionalEncoding, crucixTransformer };`

---

## 📦 IMPORTS

- `import { softmax as wasmSoftmax } from '../wasm/simd_loader.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
