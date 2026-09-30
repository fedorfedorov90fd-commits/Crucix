# crucix_engine_v4

## 📋 ABOUT

The `crucix_engine_v4` module — component of Crucix predictive core.
File: `apis/predict/crucix_engine_v4.mjs` (9221 B, 279 lines, version —).

---

## 🎯 PURPOSE

Module belongs to phase **core**, type **orchestrator**. Category: core.

---

## 🚀 HOW TO USE

Module is called by orchestrator `apis/predict/engine.mjs` at phase core.
Registered in `apis/predict/register_coordinat_all.mjs`.

---

## 📍 LOCATION

| File | Path |
|------|------|
| Module | `apis/predict/crucix_engine_v4.mjs` |
| Orchestrator | `apis/predict/engine.mjs` |
| Registry | `apis/predict/register_coordinat_all.mjs` |

---

## 📊 STATUS

🟢 Active. File exists, size 9221 B.

---

## 📚 EXPORTS

- `export class CrucixEngineV4 {`
- `export async function runFullCrucixV4Cycle(latestPath, opts = {}) {`
- `export { runCrucixExtendedV3 };`

---

## 📦 IMPORTS

- `import { runCrucixExtendedV3 } from './crucix_engine_v3.mjs';`
- `import { getHookManager } from '../../plugins/hooks.mjs';`
- `import { getPluginLoader } from '../../plugins/loader.mjs';`
- `import { getPluginRegistry } from '../../plugins/registry.mjs';`
- `import { getIntegrationManager } from '../../integrations/webhook_manager.mjs';`
- `import { loadOrCreateVAPIDKeys, SubscriptionStore, notifyPush, createPushHandlers } from '../../dashboard/pwa/push.js';`
- `import { handlePluginsAPI } from './plugins_api.mjs';`

---

## 📝 CHANGELOG

- 2026-09-17 — help created.

---

**Created:** 2026-09-17
**Actual at:** 2026-09-17
**Module version:** —
