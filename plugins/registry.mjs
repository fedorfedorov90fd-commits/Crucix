// plugins/registry.mjs
// Реестр плагинов Crucix: discovery, versioning, dependency resolution.
//
// Назначение:
//   Хранит локальный реестр установленных плагинов (plugins/registry.json).
//   Разрешает зависимости с поддержкой диапазонов версий (>=, ^, ~, ||).
//   Строит топологический порядок загрузки с обнаружением циклов.
//   Хранит список рекомендуемых (featured) плагинов.
//
// Особенности:
//   - Zero dependencies: только node:fs, node:path, node:url.
//   - Атомарная запись через writeFileSync во временный файл + renameSync.
//   - Валидация структуры при загрузке.
//   - Сохранение installedAt при повторной регистрации.
//   - Singleton через getPluginRegistry() с поддержкой reset.

import { readFileSync, existsSync, writeFileSync, renameSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkVersionCompatibility } from './manifest_schema.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_FILE = join(__dirname, 'registry.json');

function _atomicWrite(filePath, content) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Date.now();
  try {
    writeFileSync(tmp, content, 'utf-8');
    renameSync(tmp, filePath);
  } catch (e) {
    try { if (existsSync(tmp)) unlinkSync(tmp); } catch (_) { /* ignore */ }
    throw e;
  }
}

export class PluginRegistry {
  constructor({ registryFile } = {}) {
    this.registryFile = registryFile || REGISTRY_FILE;
    this.registry = this._load();
  }

  _load() {
    if (!existsSync(this.registryFile)) {
      return { plugins: {}, lastUpdated: null };
    }

    try {
      const parsed = JSON.parse(readFileSync(this.registryFile, 'utf-8'));
      if (!parsed || typeof parsed !== 'object') {
        return { plugins: {}, lastUpdated: null };
      }
      if (!parsed.plugins || typeof parsed.plugins !== 'object') {
        parsed.plugins = {};
      }
      if (!('lastUpdated' in parsed)) {
        parsed.lastUpdated = null;
      }
      return parsed;
    } catch (e) {
      console.error('[registry] load failed: ' + e.message);
      return { plugins: {}, lastUpdated: null };
    }
  }

  _save() {
    this.registry.lastUpdated = new Date().toISOString();
    try {
      _atomicWrite(this.registryFile, JSON.stringify(this.registry, null, 2));
      return { ok: true };
    } catch (e) {
      console.error('[registry] save failed: ' + e.message);
      return { ok: false, error: e.message };
    }
  }

  register(manifest, metadata = {}) {
    if (!manifest || typeof manifest !== 'object' || !manifest.name) {
      return { ok: false, error: 'invalid_manifest' };
    }

    const existing = this.registry.plugins[manifest.name] || null;
    const now = new Date().toISOString();

    // Защищённые поля name/version нельзя перетереть через metadata
    const safeMeta = { ...metadata };
    delete safeMeta.name;
    delete safeMeta.version;
    delete safeMeta.installedAt;

    this.registry.plugins[manifest.name] = {
      name: manifest.name,
      version: manifest.version,
      type: manifest.type,
      hooks: Array.isArray(manifest.hooks) ? manifest.hooks.slice() : [],
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions.slice() : [],
      description: manifest.description || '',
      author: manifest.author || '',
      installedAt: existing ? existing.installedAt : now,
      updatedAt: now,
      ...safeMeta,
    };

    const saved = this._save();
    return { ok: saved.ok, plugin: manifest.name, replaced: !!existing };
  }

  unregister(pluginName) {
    const existed = !!this.registry.plugins[pluginName];
    if (!existed) return { ok: true, existed: false };

    delete this.registry.plugins[pluginName];
    const saved = this._save();
    return { ok: saved.ok, existed: true };
  }

  get(pluginName) {
    return this.registry.plugins[pluginName] || null;
  }

  list() {
    return Object.values(this.registry.plugins)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Разрешение зависимостей с поддержкой диапазонов версий.
   * Возвращает: missing (не установлено), satisfied (ок), mismatched (несовместимая версия).
   */
  resolveDependencies(manifest, _seen = new Set()) {
    const deps = (manifest && manifest.dependencies) || {};
    const missing = [];
    const satisfied = [];
    const mismatched = [];

    if (_seen.has(manifest && manifest.name)) {
      return { ok: true, missing, satisfied, mismatched, cycle: true };
    }
    if (manifest && manifest.name) _seen.add(manifest.name);

    for (const [depName, depVersion] of Object.entries(deps)) {
      const installed = this.registry.plugins[depName];
      if (!installed) {
        missing.push({ name: depName, required: depVersion });
      } else if (checkVersionCompatibility(depVersion, installed.version)) {
        satisfied.push({ name: depName, required: depVersion, installed: installed.version });
      } else {
        mismatched.push({ name: depName, required: depVersion, installed: installed.version });
      }
    }

    return {
      ok: missing.length === 0 && mismatched.length === 0,
      missing,
      satisfied,
      mismatched,
    };
  }

  /**
   * Топологический порядок загрузки на основе зависимостей.
   * Обнаруживает циклы.
   */
  checkDependencyGraph() {
    const plugins = this.registry.plugins;
    const order = [];
    const visiting = new Set();
    const visited = new Set();
    const cycles = [];

    const visit = (name, path) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        cycles.push({ cycle: path.concat(name) });
        return;
      }
      visiting.add(name);
      const plugin = plugins[name];
      if (plugin && plugin.dependencies) {
        for (const dep of Object.keys(plugin.dependencies)) {
          if (plugins[dep]) visit(dep, path.concat(name));
        }
      }
      visiting.delete(name);
      visited.add(name);
      order.push(name);
    };

    for (const name of Object.keys(plugins)) {
      visit(name, []);
    }

    return { order, cycles, ok: cycles.length === 0 };
  }

  findByType(type) {
    return this.list().filter(p => p.type === type);
  }

  findByHook(hookName) {
    return this.list().filter(p => Array.isArray(p.hooks) && p.hooks.includes(hookName));
  }

  findByPermission(permission) {
    return this.list().filter(p => Array.isArray(p.permissions) && p.permissions.includes(permission));
  }

  stats() {
    const list = this.list();
    const byType = {};
    const byAuthor = {};
    for (const p of list) {
      byType[p.type] = (byType[p.type] || 0) + 1;
      const a = p.author || 'unknown';
      byAuthor[a] = (byAuthor[a] || 0) + 1;
    }
    return {
      total: list.length,
      byType,
      byAuthor,
      lastUpdated: this.registry.lastUpdated,
    };
  }

  clear() {
    this.registry = { plugins: {}, lastUpdated: null };
    const saved = this._save();
    return { ok: saved.ok };
  }

  export() {
    return JSON.stringify(this.registry, null, 2);
  }
}

export const FEATURED_PLUGINS = [
  {
    name: 'crucix-telegram-bot',
    description: 'Telegram bot для Crucix',
    type: 'notifier',
    author: 'crucix-team',
    official: true,
  },
  {
    name: 'crucix-twitter-publisher',
    description: 'Публикация алертов в Twitter',
    type: 'notifier',
    author: 'community',
  },
  {
    name: 'crucix-crypto-signals',
    description: 'Crypto-specific signals',
    type: 'signal',
    author: 'community',
  },
  {
    name: 'crucix-backtesting',
    description: 'Backtesting framework',
    type: 'analyzer',
    author: 'crucix-team',
    official: true,
  },
  {
    name: 'crucix-postgres-connector',
    description: 'Persist predictions to PostgreSQL',
    type: 'full',
    author: 'community',
  },
];

let _registry = null;

export function getPluginRegistry(options) {
  if (!_registry) _registry = new PluginRegistry(options);
  return _registry;
}

export function _resetPluginRegistry() {
  _registry = null;
}

export const REGISTRY_INFO = {
  name: 'Plugin Registry',
  description: 'Local registry + featured plugins',
  featuredCount: FEATURED_PLUGINS.length,
  registryFile: REGISTRY_FILE,
};
