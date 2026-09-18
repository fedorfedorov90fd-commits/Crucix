// Crucix — Watchdog
// Мониторинг здоровья системы: проверка процессов, ресурсов, сервисов.

export default class Watchdog {
  constructor(opts = {}) {
    this.checks = new Map();
    this.alerts = [];
    this.thresholds = opts.thresholds || { cpu: 90, memory: 90, disk: 90 };
  }
  register(name, handler) {
    this.checks.set(name, { name, handler, lastRun: 0, lastResult: null });
    return this;
  }
  async run(name) {
    const check = this.checks.get(name);
    if (!check) return { error: 'Not found' };
    try {
      const result = await check.handler();
      check.lastRun = Date.now();
      check.lastResult = result;
      if (result && result.status === 'fail') {
        this.alerts.push({ name, timestamp: Date.now(), result });
      }
      return result;
    } catch (e) {
      const err = { status: 'error', message: e.message };
      check.lastResult = err;
      this.alerts.push({ name, timestamp: Date.now(), result: err });
      return err;
    }
  }
  async runAll() {
    const out = {};
    for (const name of this.checks.keys()) out[name] = await this.run(name);
    return out;
  }
  getAll() { return [...this.checks.values()].map(c => ({ name: c.name, lastRun: c.lastRun, status: c.lastResult?.status || 'unknown' })); }
  recentAlerts(n = 20) { return this.alerts.slice(-n).reverse(); }
}
