// tests/chaos/fault_injection.mjs
// Инъекция сбоев в Crucix модули
//
// Принципы:
//   1. Инжектим — измеряем — откатываем
//   2. Не убиваем production
//   3. Всегда логируем результаты

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAOS_DIR = join(__dirname, '..', '..', 'runs', 'chaos');

class FaultInjector {
  constructor(name) {
    this.name = name;
    this.active = false;
    this.injections = 0;
  }

  activate() {
    this.active = true;
    console.log(`[chaos] ${this.name} активирован`);
  }

  deactivate() {
    this.active = false;
    console.log(`[chaos] ${this.name} деактивирован (инъекций: ${this.injections})`);
  }

  shouldInject() {
    return this.active;
  }
}

class ThrowErrorInjector extends FaultInjector {
  constructor(probability = 0.5) {
    super('ThrowError');
    this.probability = probability;
  }

  wrap(fn, fnName) {
    const self = this;
    return function (...args) {
      if (self.shouldInject() && Math.random() < self.probability) {
        self.injections++;
        throw new Error(`CHAOS: injected error in ${fnName}`);
      }
      return fn.apply(this, args);
    };
  }
}

class LatencyInjector extends FaultInjector {
  constructor(minMs = 100, maxMs = 500, probability = 0.3) {
    super('Latency');
    this.minMs = minMs;
    this.maxMs = maxMs;
    this.probability = probability;
  }

  wrap(fn, fnName) {
    const self = this;
    return async function (...args) {
      if (self.shouldInject() && Math.random() < self.probability) {
        const delay = self.minMs + Math.random() * (self.maxMs - self.minMs);
        self.injections++;
        await new Promise(r => setTimeout(r, delay));
      }
      return fn.apply(this, args);
    };
  }
}

class MemoryPressureInjector extends FaultInjector {
  constructor(sizeMB = 100) {
    super('MemoryPressure');
    this.sizeMB = sizeMB;
    this.buffers = [];
  }

  activate() {
    super.activate();
    const chunkSize = 1024 * 1024;
    const numChunks = this.sizeMB;

    for (let i = 0; i < numChunks; i++) {
      const chunk = Buffer.alloc(chunkSize);
      chunk.fill(0x42);
      this.buffers.push(chunk);
    }

    console.log(`[chaos] Выделено ${this.sizeMB} MB`);
  }

  deactivate() {
    this.buffers = [];
    if (global.gc) global.gc();
    super.deactivate();
  }
}

class NetworkDelayInjector extends FaultInjector {
  constructor(baseDelayMs = 50, jitterMs = 100) {
    super('NetworkDelay');
    this.baseDelayMs = baseDelayMs;
    this.jitterMs = jitterMs;
  }

  wrap(fn) {
    const self = this;
    return async function (...args) {
      if (self.shouldInject()) {
        const delay = self.baseDelayMs + Math.random() * self.jitterMs;
        self.injections++;
        await new Promise(r => setTimeout(r, delay));
      }
      return fn.apply(this, args);
    };
  }
}

class RandomKillInjector extends FaultInjector {
  constructor(probability = 0.01) {
    super('RandomKill');
    this.probability = probability;
  }

  wrap(fn) {
    const self = this;
    return function (...args) {
      if (self.shouldInject() && Math.random() < self.probability) {
        self.injections++;
        return undefined;
      }
      return fn.apply(this, args);
    };
  }
}

class DataCorruptionInjector extends FaultInjector {
  constructor(probability = 0.05) {
    super('DataCorruption');
    this.probability = probability;
  }

  wrap(fn) {
    const self = this;
    return function (...args) {
      const result = fn.apply(this, args);

      if (self.shouldInject() && Math.random() < self.probability) {
        self.injections++;
        if (typeof result === 'number') return NaN;
        if (typeof result === 'object' && result !== null) {
          if (Array.isArray(result)) return [...result].map(() => NaN);
          return { ...result, corrupted: true };
        }
      }
      return result;
    };
  }
}

class PartialFailureInjector extends FaultInjector {
  constructor(failRate = 0.5) {
    super('PartialFailure');
    this.failRate = failRate;
    this.successCount = 0;
    this.failCount = 0;
  }

  wrapAsync(fn) {
    const self = this;
    return async function (...args) {
      if (self.shouldInject()) {
        if (Math.random() < self.failRate) {
          self.failCount++;
          throw new Error(`CHAOS: partial failure (${self.failCount} fails)`);
        } else {
          self.successCount++;
        }
      }
      return fn.apply(this, args);
    };
  }
}

class ChaosMonkey {
  constructor() {
    this.injectors = new Map();
    this.startTime = null;
    this.results = [];
  }

  register(name, injector) {
    this.injectors.set(name, injector);
    return this;
  }

  activate(names = null) {
    this.startTime = Date.now();
    const targets = names || Array.from(this.injectors.keys());
    for (const name of targets) {
      const inj = this.injectors.get(name);
      if (inj) inj.activate();
    }
  }

  deactivate() {
    for (const inj of this.injectors.values()) {
      inj.deactivate();
    }

    if (this.startTime) {
      this.results.push({
        startTime: new Date(this.startTime).toISOString(),
        endTime: new Date().toISOString(),
        durationMs: Date.now() - this.startTime,
        injections: Object.fromEntries(
          Array.from(this.injectors.entries()).map(([k, v]) => [k, v.injections])
        ),
      });
    }
  }

  wrap(fn, fnName) {
    let wrapped = fn;
    for (const inj of this.injectors.values()) {
      if (typeof inj.wrap === 'function') {
        wrapped = inj.wrap(wrapped, fnName);
      }
    }
    return wrapped;
  }

  report() {
    return {
      totalInjections: Array.from(this.injectors.values()).reduce((s, i) => s + i.injections, 0),
      byInjector: Object.fromEntries(
        Array.from(this.injectors.entries()).map(([k, v]) => [k, v.injections])
      ),
      history: this.results,
    };
  }
}

async function chaosSlowNetwork() {
  console.log('\n========================================');
  console.log('  Chaos: Slow Network');
  console.log('========================================');

  const monkey = new ChaosMonkey();
  monkey.register('latency', new LatencyInjector(100, 500, 0.5));
  monkey.activate();

  const workFn = () => { let s = 0; for (let i = 0; i < 1e6; i++) s += i; return s; };
  const wrapped = monkey.wrap(workFn, 'work');

  const t0 = Date.now();
  for (let i = 0; i < 20; i++) {
    await wrapped();
  }
  const duration = Date.now() - t0;

  monkey.deactivate();
  console.log(`  Total duration: ${duration}ms`);
  console.log(`  Report:`, JSON.stringify(monkey.report(), null, 2));

  return duration;
}

async function chaosMemoryPressure() {
  console.log('\n========================================');
  console.log('  Chaos: Memory Pressure');
  console.log('========================================');

  const memBefore = process.memoryUsage();

  const monkey = new ChaosMonkey();
  monkey.register('memory', new MemoryPressureInjector(200));
  monkey.activate();

  await new Promise(r => setTimeout(r, 3000));

  const memDuring = process.memoryUsage();

  monkey.deactivate();

  await new Promise(r => setTimeout(r, 1000));
  const memAfter = process.memoryUsage();

  console.log(`  Memory before: ${(memBefore.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Memory during: ${(memDuring.heapUsed / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Memory after:  ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)} MB`);

  return { memBefore, memDuring, memAfter };
}

async function chaosRandomFailures() {
  console.log('\n========================================');
  console.log('  Chaos: Random Failures');
  console.log('========================================');

  const monkey = new ChaosMonkey();
  monkey.register('throw', new ThrowErrorInjector(0.3));
  monkey.register('partial', new PartialFailureInjector(0.4));
  monkey.activate();

  const modules = ['hawkes', 'hmm', 'ising', 'evt', 'copula', 'bocpd'];
  const results = {};

  for (const mod of modules) {
    const fn = () => ({ module: mod, value: Math.random() });
    const wrapped = monkey.wrap(fn, mod);

    try {
      const result = await wrapped();
      results[mod] = { ok: true, result };
    } catch (e) {
      results[mod] = { ok: false, error: e.message };
    }
  }

  monkey.deactivate();

  const okCount = Object.values(results).filter(r => r.ok).length;
  console.log(`  Успешных модулей: ${okCount}/${modules.length}`);
  console.log(`  Детали:`, JSON.stringify(results, null, 2));

  return results;
}

if (process.argv[1] && process.argv[1].endsWith('fault_injection.mjs')) {
  const scenario = process.argv[2] || 'all';

  (async () => {
    const allResults = {};

    if (scenario === 'all' || scenario === 'network') {
      allResults.slowNetwork = await chaosSlowNetwork();
    }
    if (scenario === 'all' || scenario === 'memory') {
      allResults.memoryPressure = await chaosMemoryPressure();
    }
    if (scenario === 'all' || scenario === 'failures') {
      allResults.randomFailures = await chaosRandomFailures();
    }

    if (!existsSync(CHAOS_DIR)) mkdirSync(CHAOS_DIR, { recursive: true });
    const reportPath = join(CHAOS_DIR, `chaos_report_${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      results: allResults,
    }, null, 2));

    console.log(`\n[chaos] Отчёт: ${reportPath}`);
  })().catch(e => {
    console.error('Ошибка chaos:', e);
    process.exit(1);
  });
}

export {
  FaultInjector,
  ThrowErrorInjector,
  LatencyInjector,
  MemoryPressureInjector,
  NetworkDelayInjector,
  RandomKillInjector,
  DataCorruptionInjector,
  PartialFailureInjector,
  ChaosMonkey,
  chaosSlowNetwork,
  chaosMemoryPressure,
  chaosRandomFailures,
};
