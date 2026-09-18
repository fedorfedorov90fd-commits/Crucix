// tests/chaos/chaos_runner.mjs
// Основной runner для chaos-экспериментов
// Запускает сценарии, измеряет метрики, генерирует отчёт

import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ChaosMonkey,
  ThrowErrorInjector,
  LatencyInjector,
  MemoryPressureInjector,
  NetworkDelayInjector,
  RandomKillInjector,
  PartialFailureInjector,
} from './fault_injection.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHAOS_DIR = join(__dirname, '..', '..', 'runs', 'chaos');

class ChaosRunner {
  constructor() {
    this.experiments = [];
    this.results = [];
  }

  addExperiment(name, setup, verify, teardown) {
    this.experiments.push({ name, setup, verify, teardown });
    return this;
  }

  async runExperiment(exp) {
    console.log(`\n========================================`);
    console.log(`  Эксперимент: ${exp.name}`);
    console.log(`========================================`);

    const t0 = Date.now();
    let result = { name: exp.name, success: false, error: null };

    try {
      const context = await exp.setup();

      const baseline = await exp.verify(context, 'baseline');
      console.log(`  Baseline: ${JSON.stringify(baseline)}`);

      if (context.monkey) {
        context.monkey.activate();
      }

      const duringChaos = await exp.verify(context, 'chaos');
      console.log(`  During chaos: ${JSON.stringify(duringChaos)}`);

      if (context.monkey) {
        context.monkey.deactivate();
      }

      await new Promise(r => setTimeout(r, 1000));
      const after = await exp.verify(context, 'recovery');
      console.log(`  After: ${JSON.stringify(after)}`);

      if (exp.teardown) {
        await exp.teardown(context);
      }

      result.success = true;
      result.baseline = baseline;
      result.duringChaos = duringChaos;
      result.after = after;
      result.chaosReport = context.monkey?.report() || null;
    } catch (e) {
      result.error = e.message;
      console.error(`  FAIL: ${e.message}`);
    }

    result.durationMs = Date.now() - t0;
    return result;
  }

  async runAll() {
    console.log('\n========================================');
    console.log(`  Chaos Engineering · ${this.experiments.length} экспериментов`);
    console.log('========================================');

    for (const exp of this.experiments) {
      const result = await this.runExperiment(exp);
      this.results.push(result);
    }

    return this.results;
  }

  saveReport() {
    if (!existsSync(CHAOS_DIR)) mkdirSync(CHAOS_DIR, { recursive: true });

    const report = {
      timestamp: new Date().toISOString(),
      totalExperiments: this.experiments.length,
      successful: this.results.filter(r => r.success).length,
      failed: this.results.filter(r => !r.success).length,
      results: this.results,
    };

    const path = join(CHAOS_DIR, `chaos_runner_${Date.now()}.json`);
    writeFileSync(path, JSON.stringify(report, null, 2));
    return path;
  }
}

async function experimentModuleFailure() {
  const runner = new ChaosRunner();

  runner.addExperiment(
    'Single module failure',
    async () => {
      const fakeHawkes = () => ({ probability: 0.3, regime: 'ok' });
      const fakeHMM = () => ({ currentState: 1 });
      const fakeIsing = () => ({ proximityToCritical: 0.5 });

      return {
        modules: { hawkes: fakeHawkes, hmm: fakeHMM, ising: fakeIsing },
        monkey: new ChaosMonkey().register('throw', new ThrowErrorInjector(0.5)),
      };
    },
    async (context, phase) => {
      const results = {};
      for (const [name, fn] of Object.entries(context.modules)) {
        try {
          const wrapped = context.monkey.wrap(fn, name);
          results[name] = await wrapped();
        } catch (e) {
          results[name] = null;
        }
      }
      const okCount = Object.values(results).filter(r => r !== null).length;
      return { okModules: okCount, total: 3, phase };
    },
    async () => {}
  );

  return runner;
}

async function experimentLatency() {
  const runner = new ChaosRunner();

  runner.addExperiment(
    'Network latency',
    async () => {
      const fastFn = async () => {
        let s = 0;
        for (let i = 0; i < 1e5; i++) s += i;
        return s;
      };

      return {
        fn: fastFn,
        monkey: new ChaosMonkey().register('latency', new LatencyInjector(50, 200, 0.5)),
      };
    },
    async (context, phase) => {
      const t0 = Date.now();
      const iterations = 10;
      for (let i = 0; i < iterations; i++) {
        const wrapped = context.monkey.wrap(context.fn, 'fastFn');
        await wrapped();
      }
      const totalTime = Date.now() - t0;
      return { totalMs: totalTime, avgMs: totalTime / iterations, phase };
    }
  );

  return runner;
}

async function experimentMemory() {
  const runner = new ChaosRunner();

  runner.addExperiment(
    'Memory pressure',
    async () => {
      return {
        monkey: new ChaosMonkey().register('memory', new MemoryPressureInjector(100)),
        memStart: process.memoryUsage().heapUsed,
      };
    },
    async (context, phase) => {
      await new Promise(r => setTimeout(r, 1000));
      const memNow = process.memoryUsage().heapUsed;
      return {
        heapMB: (memNow / 1024 / 1024).toFixed(1),
        deltaMB: ((memNow - context.memStart) / 1024 / 1024).toFixed(1),
        phase,
      };
    }
  );

  return runner;
}

async function experimentPartialFailures() {
  const runner = new ChaosRunner();

  runner.addExperiment(
    'Partial failures (30%)',
    async () => {
      return {
        monkey: new ChaosMonkey().register('partial', new PartialFailureInjector(0.3)),
      };
    },
    async (context, phase) => {
      let success = 0, fail = 0;
      for (let i = 0; i < 100; i++) {
        try {
          const fn = async () => ({ ok: true });
          const wrapped = context.monkey.wrap(fn, 'test');
          await wrapped();
          success++;
        } catch {
          fail++;
        }
      }
      return { success, fail, successRate: success / 100, phase };
    }
  );

  return runner;
}

async function experimentRandomKill() {
  const runner = new ChaosRunner();

  runner.addExperiment(
    'Random kill (10%)',
    async () => {
      return {
        monkey: new ChaosMonkey().register('kill', new RandomKillInjector(0.1)),
        state: { counter: 0 },
      };
    },
    async (context, phase) => {
      let corrupted = 0;
      for (let i = 0; i < 50; i++) {
        const fn = () => ({ value: 42 });
        const wrapped = context.monkey.wrap(fn, 'getValue');
        const result = wrapped();
        if (result === undefined) corrupted++;
      }
      return { corrupted, total: 50, corruptionRate: corrupted / 50, phase };
    }
  );

  return runner;
}

async function runChaosSuite() {
  const suites = [
    await experimentModuleFailure(),
    await experimentLatency(),
    await experimentMemory(),
    await experimentPartialFailures(),
    await experimentRandomKill(),
  ];

  const allResults = [];
  for (const suite of suites) {
    const results = await suite.runAll();
    allResults.push(...results);
  }

  const report = {
    timestamp: new Date().toISOString(),
    totalExperiments: allResults.length,
    successful: allResults.filter(r => r.success).length,
    failed: allResults.filter(r => !r.success).length,
    results: allResults,
  };

  if (!existsSync(CHAOS_DIR)) mkdirSync(CHAOS_DIR, { recursive: true });
  const path = join(CHAOS_DIR, `chaos_suite_${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));

  console.log('\n========================================');
  console.log(`  Итог: ${report.successful}/${report.totalExperiments} успешных`);
  console.log(`  Отчёт: ${path}`);
  console.log('========================================');

  return report;
}

if (process.argv[1] && process.argv[1].endsWith('chaos_runner.mjs')) {
  runChaosSuite().catch(e => {
    console.error('Ошибка chaos suite:', e);
    process.exit(1);
  });
}

export { ChaosRunner, runChaosSuite };
