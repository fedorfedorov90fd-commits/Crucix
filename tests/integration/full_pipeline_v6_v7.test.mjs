// tests/integration/full_pipeline_v6_v7.test.mjs

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRED = join(__dirname, '..', '..', 'apis', 'predict');

const v6Patch = await import(join(PRED, 'engine_v6_patch.mjs'));
const v7Patch = await import(join(PRED, 'engine_v7_patch.mjs'));

function makeHistory(n) {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(Date.now() - (n - i) * 15 * 60 * 1000).toISOString(),
    fred: {
      vix: 20 + Math.sin(i / 4) * 10,
      hySpread: 3 + Math.cos(i / 5) * 1.5,
      treasury10y: 4 + Math.sin(i / 6) * 0.5,
      dxy: 100 + Math.cos(i / 7) * 3,
    },
    gdelt: {
      conflictEvents: Array(Math.floor(Math.abs(Math.sin(i / 3)) * 10) + 1).fill({}),
      tone: -1 + Math.sin(i / 6),
    },
    sanctions: { count: Math.floor(Math.abs(Math.cos(i / 4)) * 5) },
    tension: 0.4 + Math.sin(i / 4) * 0.3,
    radiation: { max: 50 + Math.random() * 30 },
    energy: { oilPrice: 70 + Math.sin(i / 3) * 10 },
    gold: { price: 1900 + Math.cos(i / 4) * 100 },
  }));
}

function isFiniteNum(x) { return typeof x === 'number' && Number.isFinite(x); }

describe('integration: engine_v6_patch', () => {
  test('healthcheck reports 11 modules', () => {
    const h = v6Patch.healthcheck();
    assert.ok(Array.isArray(h.v6Modules));
    assert.ok(Array.isArray(h.catalogModules));
    assert.equal(h.v6Modules.length, 5);
    assert.equal(h.catalogModules.length, 6);
    for (const m of h.v6Modules) {
      assert.equal(m.exists, true, `${m.path} отсутствует`);
    }
    for (const m of h.catalogModules) {
      assert.equal(m.exists, true, `${m.path} отсутствует`);
    }
  });

  test('runV6Phase on 35 sweeps', async () => {
    const h = makeHistory(35);
    const r = await v6Patch.runV6Phase(h, {});
    assert.equal(r.phase, 'S_v6_extensions');
    assert.ok(r.totalModules >= 1);
    assert.ok(typeof r.okCount === 'number');
    assert.ok(r.okCount + r.skippedCount + r.errorCount === r.totalModules);
    assert.ok(r.modules);
  });

  test('runCatalogPhase on 35 sweeps', async () => {
    const h = makeHistory(35);
    const r = await v6Patch.runCatalogPhase(h, {});
    assert.equal(r.phase, 'T_catalog_extensions');
    assert.ok(r.totalModules >= 1);
    assert.ok(typeof r.okCount === 'number');
  });

  test('runNewPhases (S + T in parallel)', async () => {
    const h = makeHistory(35);
    const r = await v6Patch.runNewPhases(h, {});
    assert.ok(r.v6);
    assert.ok(r.catalog);
    assert.ok(isFiniteNum(r.elapsedMs));
  });

  test('applyV6ToSnapshot adds extensions', () => {
    const snap = {
      explanation: { reasoning_steps: [], summary: 'base' },
    };
    const fakeV6 = {
      phase: 'S_v6_extensions',
      okCount: 3,
      totalModules: 5,
      elapsedMs: 100,
      skippedCount: 1,
      errorCount: 1,
      modules: {
        neural_causal_discovery: {
          ok: true,
          result: { nEdges: 5, isAcyclic: true },
        },
        continual_learning: {
          ok: true,
          result: { taskId: 1, forgettingDelta: 0.05 },
        },
        causal_rl: {
          ok: true,
          result: { evaluation: { improvementPct: 10 } },
        },
      },
      failures: [],
    };
    const fakeCatalog = {
      phase: 'T_catalog_extensions',
      okCount: 2,
      totalModules: 2,
      elapsedMs: 200,
      skippedCount: 0,
      errorCount: 0,
      modules: {
        anomaly_detection: {
          ok: true,
          result: { lastSweep: { isAnomaly: false, votes: 0, score: 0.1 }, summary: { nAnomalies: 0 } },
        },
      },
      failures: [],
    };
    v6Patch.applyV6ToSnapshot(snap, fakeV6, fakeCatalog);
    assert.ok(snap.v6_extensions);
    assert.ok(snap.catalog_extensions);
    assert.ok(Array.isArray(snap.new_module_signals));
    assert.ok(snap.new_module_signals.length > 0);
    assert.ok(snap.explanation.reasoning_steps.length > 0);
  });
});

describe('integration: engine_v7_patch', () => {
  test('healthcheck reports 5 v7 files', () => {
    const h = v7Patch.healthcheck();
    assert.ok(Array.isArray(h.v7Files));
    assert.equal(h.v7Files.length, 5);
    for (const m of h.v7Files) {
      assert.equal(m.exists, true, `${m.name} отсутствует`);
    }
  });

  test('runV7Phase on 35 sweeps', async () => {
    const h = makeHistory(35);
    const r = await v7Patch.runV7Phase(h, {
      horizon: 4,
      modules: {
        worldModel: { vaeEpochs: 1, rnnEpochs: 1, latentDim: 4, hiddenDim: 8 },
        neuralODE: { epochs: 1, hiddenDim: 8 },
        dreamer: { trainSteps: 3, horizon: 3 },
        continuousCausal: { epochs: 1, hiddenDim: 8 },
      },
    });
    assert.equal(r.name, 'simulation_engine_v7');
    assert.equal(r.ok, true);
    assert.ok(r.result);
    assert.ok(r.result.synthesis);
    assert.ok(isFiniteNum(r.result.synthesis.confidence));
  });

  test('applyV7ToSnapshot adds v7_extensions', () => {
    const snap = {
      explanation: { reasoning_steps: [], summary: 'base' },
    };
    const fakeV7 = {
      ok: true,
      elapsedMs: 1234,
      result: {
        version: '7.0.0',
        available: true,
        nSweeps: 40,
        horizon: 8,
        horizonHours: 2,
        moduleStatus: {
          worldModel: 'ok',
          neuralODE: 'ok',
          dreamer: 'ok',
          continuousCausal: 'ok',
        },
        activeModules: 4,
        totalModules: 4,
        synthesis: {
          consensus: { direction: 'stable', agreement: 0.75, votes: {}, nVoters: 4 },
          confidence: 0.825,
          confidenceLevel: 'high',
          reasoningSteps: [
            { module: 'world_model', signal: 'stable', text: 'test', weight: 0.25 },
          ],
        },
        answers: [{ question: 'q', answer: 'a' }],
        interpretation: 'test',
      },
    };
    v7Patch.applyV7ToSnapshot(snap, fakeV7);
    assert.ok(snap.v7_extensions);
    assert.equal(snap.v7_extensions.ok, true);
    assert.equal(snap.v7_extensions.activeModules, 4);
    assert.equal(snap.v7_extensions.synthesis.confidence, 0.825);
    assert.ok(snap.explanation.reasoning_steps.length > 0);
    assert.ok(snap.explanation.summary.includes('Фаза U'));
  });

  test('applyV7ToSnapshot handles failed phase gracefully', () => {
    const snap = { explanation: { reasoning_steps: [], summary: 'base' } };
    const failedV7 = {
      ok: false,
      elapsedMs: 50,
      error: 'test error',
      reason: null,
    };
    v7Patch.applyV7ToSnapshot(snap, failedV7);
    assert.ok(snap.v7_extensions);
    assert.equal(snap.v7_extensions.ok, false);
    assert.equal(snap.v7_extensions.error, 'test error');
  });
});

describe('integration: full S+T+U pipeline', () => {
  test('all three phases on 35 sweeps', async () => {
    const h = makeHistory(35);

    const t0 = Date.now();

    const v6 = await v6Patch.runV6Phase(h, {});
    const catalog = await v6Patch.runCatalogPhase(h, {});
    const v7 = await v7Patch.runV7Phase(h, {
      horizon: 4,
      modules: {
        worldModel: { vaeEpochs: 1, rnnEpochs: 1, latentDim: 4, hiddenDim: 8 },
        neuralODE: { epochs: 1, hiddenDim: 8 },
        dreamer: { trainSteps: 3, horizon: 3 },
        continuousCausal: { epochs: 1, hiddenDim: 8 },
      },
    });

    const elapsed = Date.now() - t0;
    assert.ok(elapsed > 0);
    assert.ok(v6.okCount + v6.skippedCount + v6.errorCount === v6.totalModules);
    assert.ok(catalog.okCount + catalog.skippedCount + catalog.errorCount === catalog.totalModules);
    assert.equal(v7.ok, true);

    const snap = { explanation: { reasoning_steps: [], summary: 'base' } };
    v6Patch.applyV6ToSnapshot(snap, v6, catalog);
    v7Patch.applyV7ToSnapshot(snap, v7);

    assert.ok(snap.v6_extensions);
    assert.ok(snap.catalog_extensions);
    assert.ok(snap.v7_extensions);
    assert.ok(snap.v7_extensions.available === true);
  });
});
