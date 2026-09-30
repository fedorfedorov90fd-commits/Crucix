// plugins/hooks.mjs
// Lifecycle hooks для плагинов Crucix.
//
// Назначение:
//   Плагины подписываются на события системы через hook-систему.
//   Каждый hook вызывается в определённой точке жизненного цикла:
//   старт, предсказание, сигнал, алерт, смена режима, таймер.
//
// Особенности:
//   - Zero dependencies: только стандартные средства Node.js.
//   - Приоритеты handler'ов (выше приоритет — раньше вызов).
//   - Timeout на каждый handler (по умолчанию 5000 мс).
//   - Опциональный параллельный запуск handler'ов одного хука.
//   - Статистика по хукам: calls, errors, avgMs.

export const HOOKS = {
  onStartup: {
    description: 'Called once when Crucix starts',
    args: [],
    category: 'lifecycle',
  },
  onShutdown: {
    description: 'Called on graceful shutdown',
    args: [],
    category: 'lifecycle',
  },

  beforePrediction: {
    description: 'Called before each prediction cycle',
    args: ['latest'],
    category: 'prediction',
  },
  afterPrediction: {
    description: 'Called after each prediction cycle',
    args: ['result'],
    category: 'prediction',
  },

  onSignal: {
    description: 'Called for each registered signal',
    args: ['signal', 'value'],
    category: 'signal',
  },
  onSignalHigh: {
    description: 'Called when signal value exceeds threshold',
    args: ['signal'],
    category: 'signal',
  },

  onAlert: {
    description: 'Called when alert is triggered',
    args: ['alert'],
    category: 'alert',
  },
  onRegimeChange: {
    description: 'Called when regime change detected',
    args: ['changeData'],
    category: 'alert',
  },

  onTimer: {
    description: 'Called periodically',
    args: ['elapsedMs'],
    category: 'timer',
  },
};

const DEFAULT_HANDLER_TIMEOUT_MS = 5000;
const MIN_TIMER_INTERVAL_MS = 100;

function _withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).then(v => ({ ok: true, value: v })),
    new Promise(resolve => {
      timer = setTimeout(() => resolve({ ok: false, timeout: true }), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export class HookManager {
  constructor({ handlerTimeoutMs = DEFAULT_HANDLER_TIMEOUT_MS, parallel = false } = {}) {
    this.handlers = new Map();
    this.timers = new Map();
    this.handlerTimeoutMs = handlerTimeoutMs;
    this.parallel = parallel;
    this.stats = {
      totalCalls: 0,
      totalErrors: 0,
      byHook: {},
    };
  }

  on(hookName, handler, { pluginName = 'anonymous', priority = 0 } = {}) {
    if (!HOOKS[hookName]) {
      throw new Error('Unknown hook: ' + hookName);
    }
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }

    if (!this.handlers.has(hookName)) {
      this.handlers.set(hookName, []);
    }

    const list = this.handlers.get(hookName);
    const existingIndex = list.findIndex(h => h.pluginName === pluginName);
    const entry = { pluginName, handler, priority };

    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.push(entry);
    }

    list.sort((a, b) => b.priority - a.priority);
    return { ok: true, replaced: existingIndex >= 0 };
  }

  off(hookName, pluginName) {
    if (!this.handlers.has(hookName)) return 0;
    const handlers = this.handlers.get(hookName);
    const before = handlers.length;
    const filtered = handlers.filter(h => h.pluginName !== pluginName);
    this.handlers.set(hookName, filtered);
    return before - filtered.length;
  }

  _bumpHookStats(hookName, ok, durationMs) {
    const s = this.stats.byHook[hookName] || { calls: 0, errors: 0, totalMs: 0, avgMs: 0 };
    s.calls++;
    if (!ok) s.errors++;
    if (Number.isFinite(durationMs)) {
      s.totalMs += durationMs;
      s.avgMs = s.totalMs / s.calls;
    }
    this.stats.byHook[hookName] = s;
  }

  async _runOne(hookName, entry, args) {
    const startTime = Date.now();
    try {
      const wrapped = _withTimeout(entry.handler(...args), this.handlerTimeoutMs);
      const outcome = await wrapped;
      const duration = Date.now() - startTime;

      if (outcome.ok) {
        this._bumpHookStats(hookName, true, duration);
        return { plugin: entry.pluginName, ok: true, result: outcome.value, durationMs: duration };
      }

      this.stats.totalErrors++;
      this._bumpHookStats(hookName, false, duration);
      return { plugin: entry.pluginName, ok: false, timeout: true, durationMs: duration };
    } catch (e) {
      const duration = Date.now() - startTime;
      this.stats.totalErrors++;
      this._bumpHookStats(hookName, false, duration);
      const msg = e && e.message ? e.message : String(e);
      console.error('[hooks] ' + hookName + ' error in ' + entry.pluginName + ': ' + msg);
      return { plugin: entry.pluginName, ok: false, error: msg, durationMs: duration };
    }
  }

  async emit(hookName, ...args) {
    if (!HOOKS[hookName]) {
      return [{ plugin: 'system', ok: false, error: 'unknown_hook', hook: hookName }];
    }

    const handlers = this.handlers.get(hookName) || [];
    if (handlers.length === 0) {
      return [];
    }

    this.stats.totalCalls++;

    if (this.parallel) {
      return await Promise.all(handlers.map(h => this._runOne(hookName, h, args)));
    }

    const results = [];
    for (const entry of handlers) {
      results.push(await this._runOne(hookName, entry, args));
    }
    return results;
  }

  scheduleTimer(hookName, intervalMs, { unref = true } = {}) {
    if (!HOOKS[hookName]) {
      throw new Error('Unknown hook: ' + hookName);
    }
    if (!Number.isFinite(intervalMs) || intervalMs < MIN_TIMER_INTERVAL_MS) {
      throw new Error('intervalMs must be >= ' + MIN_TIMER_INTERVAL_MS);
    }

    if (this.timers.has(hookName)) {
      clearInterval(this.timers.get(hookName));
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      this.emit(hookName, elapsed).catch(() => {});
    }, intervalMs);

    if (unref && timer.unref) timer.unref();

    this.timers.set(hookName, timer);
    return timer;
  }

  stopTimers() {
    const stopped = [];
    for (const [name, timer] of this.timers) {
      clearInterval(timer);
      stopped.push(name);
    }
    this.timers.clear();
    return stopped;
  }

  list() {
    const result = {};
    for (const hookName of Object.keys(HOOKS)) {
      const handlers = this.handlers.get(hookName) || [];
      result[hookName] = handlers.map(h => h.pluginName);
    }
    return result;
  }

  resetStats() {
    this.stats = { totalCalls: 0, totalErrors: 0, byHook: {} };
    return { ok: true };
  }

  status() {
    return {
      hooks: this.list(),
      stats: this.stats,
      activeTimers: this.timers.size,
      handlerTimeoutMs: this.handlerTimeoutMs,
      parallel: this.parallel,
    };
  }
}

let _manager = null;

export function getHookManager(config) {
  if (!_manager) {
    _manager = new HookManager(config || {});
  }
  return _manager;
}

export function _resetHookManager() {
  if (_manager) _manager.stopTimers();
  _manager = null;
}

export const HOOKS_INFO = {
  available: Object.keys(HOOKS),
  categories: Array.from(new Set(Object.values(HOOKS).map(h => h.category))),
  description: 'Lifecycle hooks for plugins',
};
