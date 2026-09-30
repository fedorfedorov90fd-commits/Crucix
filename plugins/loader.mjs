// plugins/loader.mjs
// Динамическая загрузка и управление плагинами Crucix.
//
// Назначение:
//   Обнаружение плагинов в pluginsDir, валидация манифеста,
//   проверка совместимости версий, динамический импорт entryPoint,
//   регистрация hooks, управление жизненным циклом (init/onShutdown).
//
// Особенности:
//   - Zero dependencies: только node:fs, node:path, node:url.
//   - Откат частичной загрузки при ошибке init.
//   - Защита от двойной загрузки плагина с тем же именем.
//   - Timeout на hook-функции (по умолчанию 5000 мс).
//   - Singleton через getPluginLoader() с поддержкой reset.

import { readFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validateManifest, checkVersionCompatibility } from './manifest_schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRUCIX_VERSION = '3.0.0';
const DEFAULT_HOOK_TIMEOUT_MS = 5000;

function _withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).then(v => ({ ok: true, value: v })),
    new Promise(resolve => {
      timer = setTimeout(() => resolve({ ok: false, timeout: true }), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export class PluginLoader {
  constructor({ pluginsDir, handlerTimeoutMs } = {}) {
    this.pluginsDir = pluginsDir || join(__dirname, 'installed');
    this.handlerTimeoutMs = Number.isFinite(handlerTimeoutMs) ? handlerTimeoutMs : DEFAULT_HOOK_TIMEOUT_MS;
    this.plugins = new Map();
    this.hooks = new Map();
    this.errors = [];

    if (!existsSync(this.pluginsDir)) {
      try {
        mkdirSync(this.pluginsDir, { recursive: true });
      } catch (e) {
        this.errors.push({ plugin: 'root', error: 'cannot create pluginsDir: ' + e.message });
      }
    }
  }

  getErrors() {
    return this.errors.slice();
  }

  discover() {
    const discovered = [];
    this.errors = [];

    if (!existsSync(this.pluginsDir)) return discovered;

    try {
      const entries = readdirSync(this.pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const pluginDir = join(this.pluginsDir, entry.name);
        const manifestPath = join(pluginDir, 'manifest.json');

        if (!existsSync(manifestPath)) {
          this.errors.push({ plugin: entry.name, error: 'manifest.json not found' });
          continue;
        }

        try {
          const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
          discovered.push({ dir: pluginDir, manifest });
        } catch (e) {
          this.errors.push({ plugin: entry.name, error: 'invalid manifest.json: ' + e.message });
        }
      }
    } catch (e) {
      this.errors.push({ plugin: 'root', error: e.message });
    }

    return discovered;
  }

  async load(pluginDir, manifest) {
    if (!manifest || typeof manifest !== 'object' || !manifest.name) {
      return { ok: false, plugin: 'unknown', error: 'invalid_manifest_object' };
    }

    if (this.plugins.has(manifest.name)) {
      return { ok: false, plugin: manifest.name, error: 'already_loaded' };
    }

    const validation = validateManifest(manifest);
    if (!validation.valid) {
      return { ok: false, plugin: manifest.name, errors: validation.errors };
    }

    if (!checkVersionCompatibility(manifest.crucixVersion, CRUCIX_VERSION)) {
      return {
        ok: false,
        plugin: manifest.name,
        error: 'requires crucix ' + manifest.crucixVersion + ', actual ' + CRUCIX_VERSION,
      };
    }

    if (!pluginDir || !existsSync(pluginDir)) {
      return { ok: false, plugin: manifest.name, error: 'plugin_dir_not_found: ' + pluginDir };
    }

    const entryPath = resolve(pluginDir, manifest.entryPoint);
    if (!existsSync(entryPath)) {
      return {
        ok: false,
        plugin: manifest.name,
        error: 'entry point not found: ' + manifest.entryPoint,
      };
    }

    let module;
    try {
      const entryUrl = pathToFileURL(entryPath).href;
      module = await import(entryUrl);
    } catch (e) {
      return { ok: false, plugin: manifest.name, error: 'load failed: ' + e.message };
    }

    const instance = {
      manifest,
      module,
      path: pluginDir,
      config: null,
      loadedAt: new Date().toISOString(),
      hooksRegistered: [],
    };

    // init с откатом при ошибке
    if (typeof module.init === 'function') {
      try {
        const config = (manifest.config && manifest.config.defaults) || {};
        await module.init(config);
        instance.config = config;
      } catch (e) {
        // Откат: вызвать onShutdown, если он есть
        if (typeof module.onShutdown === 'function') {
          try { await module.onShutdown(); } catch (_) { /* ignore rollback error */ }
        }
        return { ok: false, plugin: manifest.name, error: 'init failed: ' + e.message };
      }
    }

    // Регистрация hooks с дедупликацией pluginName + hookName
    const registeredKeys = new Set();

    const registerHook = (hookName, hookFn) => {
      if (typeof hookFn !== 'function') return;
      const key = manifest.name + '::' + hookName;
      if (registeredKeys.has(key)) return;
      registeredKeys.add(key);

      if (!this.hooks.has(hookName)) this.hooks.set(hookName, []);
      this.hooks.get(hookName).push({ plugin: manifest.name, fn: hookFn });
      instance.hooksRegistered.push(hookName);
    };

    if (module.hooks && typeof module.hooks === 'object') {
      for (const [hookName, hookFn] of Object.entries(module.hooks)) {
        registerHook(hookName, hookFn);
      }
    }

    if (manifest.hooks && Array.isArray(manifest.hooks)) {
      for (const hookName of manifest.hooks) {
        if (typeof module[hookName] === 'function') {
          registerHook(hookName, module[hookName]);
        }
      }
    }

    this.plugins.set(manifest.name, instance);

    return {
      ok: true,
      plugin: manifest.name,
      version: manifest.version,
      hooks: instance.hooksRegistered,
    };
  }

  async loadAll() {
    const discovered = this.discover();
    const results = [];

    for (const { dir, manifest } of discovered) {
      const result = await this.load(dir, manifest);
      results.push(result);
    }

    return results;
  }

  async reload(pluginName) {
    const existing = this.plugins.get(pluginName);
    if (!existing) return { ok: false, error: 'not_loaded' };

    const pluginDir = existing.path;
    const manifest = existing.manifest;

    const unloadRes = await this.unload(pluginName);
    if (!unloadRes.ok) return unloadRes;

    return await this.load(pluginDir, manifest);
  }

  async runHook(hookName, ...args) {
    const hooks = this.hooks.get(hookName) || [];
    const results = [];

    for (const { plugin, fn } of hooks) {
      try {
        const outcome = await _withTimeout(fn(...args), this.handlerTimeoutMs);
        if (outcome.ok) {
          results.push({ plugin, ok: true, result: outcome.value });
        } else {
          results.push({ plugin, ok: false, timeout: true });
        }
      } catch (e) {
        const msg = e && e.message ? e.message : String(e);
        results.push({ plugin, ok: false, error: msg });
      }
    }

    return results;
  }

  list() {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.manifest.name,
      version: p.manifest.version,
      type: p.manifest.type,
      hooks: p.hooksRegistered,
      permissions: p.manifest.permissions,
      description: p.manifest.description,
      path: p.path,
      loadedAt: p.loadedAt,
    }));
  }

  async unload(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return { ok: false, error: 'not_loaded' };

    let shutdownOk = true;
    if (typeof plugin.module.onShutdown === 'function') {
      try {
        await plugin.module.onShutdown();
      } catch (e) {
        shutdownOk = false;
        console.error('[loader] onShutdown failed for ' + pluginName + ': ' + e.message);
      }
    }

    let hooksRemoved = 0;
    for (const [hookName, hooks] of this.hooks) {
      const before = hooks.length;
      const filtered = hooks.filter(h => h.plugin !== pluginName);
      hooksRemoved += before - filtered.length;
      this.hooks.set(hookName, filtered);
    }

    this.plugins.delete(pluginName);
    return { ok: true, hooks_removed: hooksRemoved, shutdown_ok: shutdownOk };
  }

  info(pluginName) {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) return null;

    return {
      ...plugin.manifest,
      path: plugin.path,
      loadedAt: plugin.loadedAt,
      hasInit: typeof plugin.module.init === 'function',
      hasShutdown: typeof plugin.module.onShutdown === 'function',
      hooksRegistered: plugin.hooksRegistered.slice(),
      exports: Object.keys(plugin.module),
      exportedFunctions: Object.keys(plugin.module).filter(k => typeof plugin.module[k] === 'function'),
    };
  }

  stats() {
    let hookCount = 0;
    for (const list of this.hooks.values()) hookCount += list.length;

    return {
      pluginsLoaded: this.plugins.size,
      hooksRegistered: hookCount,
      errors: this.errors.length,
      pluginsDir: this.pluginsDir,
      handlerTimeoutMs: this.handlerTimeoutMs,
    };
  }
}

let _loader = null;

export function getPluginLoader(options) {
  if (!_loader) _loader = new PluginLoader(options);
  return _loader;
}

export function _resetPluginLoader() {
  _loader = null;
}

export const LOADER_INFO = {
  name: 'Plugin Loader',
  crucixVersion: CRUCIX_VERSION,
  description: 'Dynamic plugin loading with validation',
};

export { CRUCIX_VERSION };
