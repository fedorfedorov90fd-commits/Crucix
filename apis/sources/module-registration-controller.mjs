// Crucix — ModuleRegistrationController
// Управление регистрацией модулей: топологическая сортировка, проверка зависимостей, health checks.

export default class ModuleRegistrationController {
  constructor() {
    this.modules = new Map();
    this.activeModules = new Set();
    this.dependencies = new Map();
    this.healthChecks = new Map();
  }

  register(info) {
    if (!info.id || !info.file) throw new Error('id and file required');
    const module = { ...info, version: this._computeVersion(info), registeredAt: Date.now() };
    this.modules.set(info.id, module);
    if (info.dependencies) this.dependencies.set(info.id, info.dependencies);
    if (info.isActive) this.activate(info.id);
    return module;
  }

  _computeVersion(info) {
    if (info.versionHash) return info.versionHash;
    return String(Date.now());
  }

  activate(moduleId) {
    const mod = this.modules.get(moduleId);
    if (!mod) throw new Error(`Module ${moduleId} not found`);
    const deps = this.dependencies.get(moduleId) || [];
    const missing = deps.filter(d => !this.modules.has(d));
    const inactive = deps.filter(d => this.modules.has(d) && !this.activeModules.has(d));
    if (missing.length > 0) throw new Error(`Missing deps: ${missing.join(',')}`);
    if (inactive.length > 0) throw new Error(`Inactive deps: ${inactive.join(',')}`);
    this.activeModules.add(moduleId);
    mod.isActive = true;
    return true;
  }

  deactivate(moduleId) {
    this.activeModules.delete(moduleId);
    const mod = this.modules.get(moduleId);
    if (mod) mod.isActive = false;
    return true;
  }

  topoSort() {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    const visit = (id) => {
      if (visited.has(id)) return;
      if (visiting.has(id)) throw new Error(`Circular dep: ${id}`);
      visiting.add(id);
      for (const dep of (this.dependencies.get(id) || [])) visit(dep);
      visiting.delete(id);
      visited.add(id);
      sorted.push(id);
    };
    for (const id of this.modules.keys()) visit(id);
    return sorted;
  }

  healthCheck() {
    const results = [];
    for (const [id, mod] of this.modules) {
      const deps = this.dependencies.get(id) || [];
      const missing = deps.filter(d => !this.modules.has(d));
      const inactive = deps.filter(d => !this.activeModules.has(d));
      results.push({
        id,
        isActive: this.activeModules.has(id),
        dependencies: deps.length,
        missingDeps: missing,
        inactiveDeps: inactive,
        status: missing.length === 0 && inactive.length === 0 ? 'healthy' : 'unhealthy',
      });
    }
    return results;
  }

  getAll() { return [...this.modules.values()]; }
  stats() {
    const all = this.getAll();
    return {
      total: all.length,
      active: this.activeModules.size,
      withDeps: this.dependencies.size,
    };
  }
}
