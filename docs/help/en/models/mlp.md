# mlp

## 📋 ABOUT

The `mlp` module — MLP нейросеть.
File: `apis/predict/models/neural.mjs` (8165 B, 275 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **D**, type **predictive**. Category: models.
Minimum history: 30 sweep.
Timeout: 30000 ms.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase D.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/models/neural.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |
| Phase passport | `docs/modules/phase-D.md` |
| Help RU | `docs/help/ru/models/mlp.md` |
| Help EN | `docs/help/en/models/mlp.md` |

---

## 📊 STATUS

🟢 Active. File exists, size 8165 B.

---

## 🔗 RELATED MODULES

- `apis/predict/engine.mjs` — main orchestrator.
- `apis/predict/register_coordinat_all.mjs` — module registry.
- `docs/modules/phase-D.md` — phase passport.

---

## 📚 EXPORTS

- `export { MLP, crucixMLPAnalysis };`

---

## 📦 IMPORTS

—

---

## 🧮 THEORETICAL BASIS

Rumelhart, D. E., Hinton, G. E., & Williams, R. J. (1986).
"Learning representations by back-propagating errors". Nature, 323, 533-536.
Goodfellow, I., Bengio, Y., & Courville, A. (2016). "Deep Learning".
MIT Press. Главы 6-8.
Forward:  a^l = σ(W^l · a^{l-1} + b^l)
Backward: δ^L = ∇_a C ⊙ σ'(z^L)
δ^l = ((W^{l+1})ᵀ · δ^{l+1}) ⊙ σ'(z^l)
∂C/∂W^l = δ^l · (a^{l-1})ᵀ

---

## 📈 PARAMETERS

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| minHistory | number | 30 | Minimum sweeps to run |
| timeoutMs | number | 30000 | Timeout in ms |
| phase | string | D | Pipeline phase |
| type | string | predictive | Module type |

---

## ⚙️ EXECUTION FLOW

1. Orchestrator (engine.mjs) calls module at phase D.
2. Module receives sweep and history.
3. Returns result into unified snapshot.
4. On error — recorded in forecast.failures.

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

## 🚧 ROADMAP

See `docs/book/07-improvements.md` — section for phase D.

---

## 🔍 TESTS

Location: `tests/`. Check for module tests.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
