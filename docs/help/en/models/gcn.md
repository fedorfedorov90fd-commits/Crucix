# gcn

## 📋 ABOUT

The `gcn` module — Graph Convolutional Network.
File: `apis/predict/models/graph_neural.mjs` (7536 B, 253 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **D**, type **predictive**. Category: models.
Minimum history: 5 sweep.
Timeout: 20000 ms.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase D.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/models/graph_neural.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |
| Phase passport | `docs/modules/phase-D.md` |
| Help RU | `docs/help/ru/models/gcn.md` |
| Help EN | `docs/help/en/models/gcn.md` |

---

## 📊 STATUS

🟢 Active. File exists, size 7536 B.

---

## 🔗 RELATED MODULES

- `apis/predict/engine.mjs` — main orchestrator.
- `apis/predict/register_coordinat_all.mjs` — module registry.
- `docs/modules/phase-D.md` — phase passport.

---

## 📚 EXPORTS

- `export { GCN, crucixGCNAnalysis };`

---

## 📦 IMPORTS

—

---

## 🧮 THEORETICAL BASIS

Kipf, T. N., & Welling, M. (2017). "Semi-Supervised Classification with
Graph Convolutional Networks". ICLR. arXiv:1609.02907.
Hamilton, W. L., Ying, R., & Leskovec, J. (2017). "Inductive
Representation Learning on Large Graphs". NeurIPS.
GCN-слой: H' = σ(D̂^{−1/2} · Â · D̂^{−1/2} · H · W)
где Â = A + I (adjacency + self-loop),
D̂ — матрица степеней.
Каждый узел агрегирует информацию от соседей через нормализованную
матрицу смежности. K слоёв = K-хоповая окрестность.

---

## 📈 PARAMETERS

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| minHistory | number | 5 | Minimum sweeps to run |
| timeoutMs | number | 20000 | Timeout in ms |
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
