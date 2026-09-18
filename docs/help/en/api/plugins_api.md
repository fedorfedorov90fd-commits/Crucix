# plugins_api

## 📋 ABOUT

The `plugins_api` module — component of Crucix predictive core.
File: `apis/predict/plugins_api.mjs` (10788 B, 368 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **api**, type **predictive**. Category: api.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase api.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/plugins_api.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 10788 B.

---

## 📚 EXPORTS

- `export async function handlePluginsAPI(req, res, url) {`
- `export { PluginManager, getManager as getPluginManager };`

---

## 📦 IMPORTS

- `import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, cpSync } from 'node:fs';`
- `import { join, dirname } from 'node:path';`
- `import { fileURLToPath } from 'node:url';`
- `import { getPluginLoader } from '../../plugins/loader.mjs';`
- `import { getHookManager } from '../../plugins/hooks.mjs';`
- `import { getPluginRegistry, FEATURED_PLUGINS } from '../../plugins/registry.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
