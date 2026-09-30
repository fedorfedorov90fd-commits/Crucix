// apis/predict/plugins_api.mjs
// REST API для управления плагинами
//
// Endpoints:
//   GET    /api/plugins                — список установленных
//   GET    /api/plugins/available      — список доступных в реестре
//   GET    /api/plugins/:name          — детали плагина
//   GET    /api/plugins/:name/logs     — логи плагина
//   POST   /api/plugins/:name/install  — установка
//   POST   /api/plugins/:name/uninstall — удаление
//   POST   /api/plugins/:name/enable   — включить
//   POST   /api/plugins/:name/disable  — выключить
//   GET    /api/plugins/:name/config   — получить конфиг
//   PUT    /api/plugins/:name/config   — обновить конфиг
//   POST   /api/plugins/reload         — перезагрузить все
//   GET    /api/plugins/status         — общий статус

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPluginLoader } from '../../plugins/loader.mjs';
import { getHookManager } from '../../plugins/hooks.mjs';
import { getPluginRegistry, FEATURED_PLUGINS } from '../../plugins/registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const PLUGINS_DIR = join(ROOT, 'plugins', 'installed');
const CONFIG_DIR = join(ROOT, 'runs', 'plugins');
const LOGS_DIR = join(CONFIG_DIR, 'logs');

for (const d of [PLUGINS_DIR, CONFIG_DIR, LOGS_DIR]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

class PluginManager {
  constructor() {
    this.loader = getPluginLoader({ pluginsDir: PLUGINS_DIR });
    this.hooks = getHookManager();
    this.registry = getPluginRegistry();
    this.pluginStates = this._loadStates();
  }

  _loadStates() {
    const file = join(CONFIG_DIR, 'states.json');
    if (!existsSync(file)) return {};
    try {
      return JSON.parse(readFileSync(file, 'utf-8'));
    } catch {
      return {};
    }
  }

  _saveStates() {
    const file = join(CONFIG_DIR, 'states.json');
    writeFileSync(file, JSON.stringify(this.pluginStates, null, 2));
  }

  getState(name) {
    return this.pluginStates[name] || { enabled: true, installed: false };
  }

  setState(name, state) {
    this.pluginStates[name] = { ...this.getState(name), ...state };
    this._saveStates();
  }

  listInstalled() {
    const installed = this.loader.list();
    return installed.map(p => {
      const state = this.getState(p.name);
      return {
        ...p,
        enabled: state.enabled !== false,
        installed: true,
        loadedAt: state.loadedAt,
        configPath: join(CONFIG_DIR, `${p.name}.json`),
      };
    });
  }

  listAvailable() {
    const installed = new Set(this.loader.list().map(p => p.name));
    return FEATURED_PLUGINS.map(p => ({
      ...p,
      isInstalled: installed.has(p.name),
    }));
  }

  getDetails(name) {
    const info = this.loader.info(name);
    if (!info) return null;

    const state = this.getState(name);

    return {
      ...info,
      enabled: state.enabled !== false,
      config: this.getConfig(name),
      stats: this.getStats(name),
    };
  }

  async install(name, source = null) {
    if (this.loader.plugins.has(name)) {
      return { ok: false, error: 'already_installed' };
    }

    const examplePath = join(ROOT, 'plugins', 'examples', name);

    if (existsSync(examplePath)) {
      const targetPath = join(PLUGINS_DIR, name);
      if (existsSync(targetPath)) {
        rmSync(targetPath, { recursive: true });
      }
      cpSync(examplePath, targetPath, { recursive: true });

      const manifestPath = join(targetPath, 'manifest.json');
      if (existsSync(manifestPath)) {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
        const result = await this.loader.load(targetPath, manifest);

        if (result.ok) {
          this.setState(name, {
            enabled: true,
            installed: true,
            installedAt: new Date().toISOString(),
            source: 'examples',
          });
          this.registry.register(manifest);
        }

        return result;
      }
    }

    return { ok: false, error: 'not_found_in_registry', name };
  }

  async uninstall(name) {
    const plugin = this.loader.plugins.get(name);
    if (!plugin) return { ok: false, error: 'not_loaded' };

    await this.loader.unload(name);

    const pluginDir = join(PLUGINS_DIR, name);
    if (existsSync(pluginDir)) {
      rmSync(pluginDir, { recursive: true });
    }

    delete this.pluginStates[name];
    this._saveStates();
    this.registry.unregister(name);

    return { ok: true };
  }

  async enable(name) {
    const plugin = this.loader.plugins.get(name);
    if (!plugin) return { ok: false, error: 'not_loaded' };

    this.setState(name, { enabled: true });
    return { ok: true };
  }

  async disable(name) {
    const plugin = this.loader.plugins.get(name);
    if (!plugin) return { ok: false, error: 'not_loaded' };

    for (const hookName of Object.keys(plugin.manifest.hooks || {})) {
      this.hooks.off(hookName, name);
    }

    this.setState(name, { enabled: false });
    return { ok: true };
  }

  getConfig(name) {
    const configPath = join(CONFIG_DIR, `${name}.json`);
    if (existsSync(configPath)) {
      try {
        return JSON.parse(readFileSync(configPath, 'utf-8'));
      } catch {
        return {};
      }
    }

    const plugin = this.loader.plugins.get(name);
    return plugin?.manifest?.config?.defaults || {};
  }

  setConfig(name, config) {
    const configPath = join(CONFIG_DIR, `${name}.json`);
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    return { ok: true, config };
  }

  getLogs(name, limit = 100) {
    const logPath = join(LOGS_DIR, `${name}.log`);
    if (!existsSync(logPath)) return { lines: [], total: 0 };

    try {
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      return {
        lines: lines.slice(-limit),
        total: lines.length,
      };
    } catch {
      return { lines: [], total: 0 };
    }
  }

  getStats(name) {
    const state = this.getState(name);
    const info = this.loader.info(name);
    if (!info) return null;

    return {
      enabled: state.enabled !== false,
      hooks: info.hooks || [],
      permissions: info.permissions || [],
      exportedFunctions: info.exportedFunctions || [],
      hasInit: info.hasInit,
      hasShutdown: info.hasShutdown,
    };
  }

  status() {
    return {
      installed: this.loader.plugins.size,
      enabled: this.listInstalled().filter(p => p.enabled).length,
      errors: this.loader.errors,
      hooks: this.hooks.status(),
      registry: this.registry.list(),
    };
  }

  async reload() {
    for (const name of this.loader.plugins.keys()) {
      await this.loader.unload(name);
    }

    const results = await this.loader.loadAll();
    return { reloaded: results.length, results };
  }
}

let _manager = null;
function getManager() {
  if (!_manager) _manager = new PluginManager();
  return _manager;
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

export async function handlePluginsAPI(req, res, url) {
  const manager = getManager();
  const path = url.pathname;
  const parts = path.split('/').filter(Boolean);

  if (parts.length === 2 && parts[1] === 'plugins') {
    if (req.method === 'GET') {
      return json(res, {
        installed: manager.listInstalled(),
        available: manager.listAvailable(),
        status: manager.status(),
      });
    }
  }

  if (parts.length === 3 && parts[1] === 'plugins' && parts[2] === 'reload') {
    if (req.method === 'POST') {
      const result = await manager.reload();
      return json(res, result);
    }
  }

  if (parts.length === 3 && parts[1] === 'plugins' && parts[2] === 'status') {
    return json(res, manager.status());
  }

  if (parts.length === 3 && parts[1] === 'plugins' && parts[2] === 'available') {
    return json(res, manager.listAvailable());
  }

  if (parts.length === 3 && parts[1] === 'plugins') {
    const name = parts[2];

    if (req.method === 'GET') {
      const details = manager.getDetails(name);
      if (!details) return json(res, { error: 'not_found' }, 404);
      return json(res, details);
    }

    if (req.method === 'DELETE') {
      const result = await manager.uninstall(name);
      return json(res, result, result.ok ? 200 : 400);
    }
  }

  if (parts.length === 4 && parts[1] === 'plugins' && parts[3] === 'install') {
    if (req.method === 'POST') {
      const body = await readBody(req);
      let source = null;
      try { source = JSON.parse(body).source; } catch {}
      const result = await manager.install(parts[2], source);
      return json(res, result, result.ok ? 200 : 400);
    }
  }

  if (parts.length === 4 && parts[1] === 'plugins' && parts[3] === 'uninstall') {
    if (req.method === 'POST') {
      const result = await manager.uninstall(parts[2]);
      return json(res, result, result.ok ? 200 : 400);
    }
  }

  if (parts.length === 4 && parts[1] === 'plugins' && parts[3] === 'enable') {
    if (req.method === 'POST') {
      const result = await manager.enable(parts[2]);
      return json(res, result);
    }
  }

  if (parts.length === 4 && parts[1] === 'plugins' && parts[3] === 'disable') {
    if (req.method === 'POST') {
      const result = await manager.disable(parts[2]);
      return json(res, result);
    }
  }

  if (parts.length === 4 && parts[1] === 'plugins' && parts[3] === 'config') {
    if (req.method === 'GET') {
      return json(res, manager.getConfig(parts[2]));
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readBody(req);
      try {
        const config = JSON.parse(body);
        const result = manager.setConfig(parts[2], config);
        return json(res, result);
      } catch (e) {
        return json(res, { error: e.message }, 400);
      }
    }
  }

  if (parts.length === 4 && parts[1] === 'plugins' && parts[3] === 'logs') {
    const limit = parseInt(url.searchParams.get('limit') || '100');
    return json(res, manager.getLogs(parts[2], limit));
  }

  return json(res, { error: 'not_found', path }, 404);
}

export { PluginManager, getManager as getPluginManager };
