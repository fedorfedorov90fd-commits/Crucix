# knowledge_graph

## 📋 ABOUT

The `knowledge_graph` module — Граф знаний.
File: `apis/knowledge/graph.mjs` (12921 B, 384 lines, version 2.0.0).

---

## 🎯 PURPOSE

Module belongs to phase **G**, type **meta**. Category: sources.
Timeout: 10000 ms.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase G.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/knowledge/graph.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |
| Phase passport | `docs/modules/phase-G.md` |
| Help RU | `docs/help/ru/sources/knowledge_graph.md` |
| Help EN | `docs/help/en/sources/knowledge_graph.md` |

---

## 📊 STATUS

🟢 Active. File exists, size 12921 B.

---

## 🔗 RELATED MODULES

- `apis/predict/engine.mjs` — main orchestrator.
- `apis/predict/register_coordinat_all.mjs` — module registry.
- `docs/modules/phase-G.md` — phase passport.

---

## 📚 EXPORTS

- `export {`

---

## 📦 IMPORTS

- `import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`

---

## 🧮 THEORETICAL BASIS

Hogan, A. et al. (2021). "Knowledge Graphs". ACM Computing Surveys,
54(4), 1-37.
Ji, S., Pan, S., Cambria, E., Marttinen, P., & Yu, P. S. (2021).
"A Survey on Knowledge Graphs". IEEE TNNLS, 33(2), 494-514.

---

## 📈 PARAMETERS

| Parameter | Type | Value | Description |
|-----------|------|-------|-------------|
| minHistory | number | 0 | Minimum sweeps to run |
| timeoutMs | number | 10000 | Timeout in ms |
| phase | string | G | Pipeline phase |
| type | string | meta | Module type |

---

## ⚙️ EXECUTION FLOW

1. Orchestrator (engine.mjs) calls module at phase G.
2. Module receives sweep and history.
3. Returns result into unified snapshot.
4. On error — recorded in forecast.failures.

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

## 🚧 ROADMAP

See `docs/book/07-improvements.md` — section for phase G.

---

## 🔍 TESTS

Location: `tests/`. Check for module tests.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** 2.0.0
