// tests/v7/v7_pack.test.mjs

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V7 = join(__dirname, '..', '..', 'apis', 'predict', 'v7');

const wmMod = await import(join(V7, 'world_model.mjs'));
const nodeMod = await import(join(V7, 'neural_ode.mjs'));
const drMod = await import(join(V7, 'dreamer.mjs'));
const ccMod = await import(join(V7, 'continuous_causal.mjs'));
const seMod = await import(join(V7, 'simulation_engine.mjs'));

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

describe('v7 pack: smoke loading', () => {
  test('world_model exports', () => {
    assert.ok(wmMod.WorldModel);
    assert.ok(wmMod.VAE);
    assert.ok(wmMod.MDNRNN);
    assert.ok(wmMod.Controller);
    assert.equal(typeof wmMod.crucixWorldModel, 'function');
  });

  test('neural_ode exports', () => {
    assert.ok(nodeMod.NeuralODEFunc);
    assert.ok(nodeMod.NeuralODETrainer);
    assert.equal(typeof nodeMod.rk4Solve, 'function');
    assert.equal(typeof nodeMod.counterfactual, 'function');
    assert.equal(typeof nodeMod.rewind, 'function');
    assert.equal(typeof nodeMod.crucixNeuralODE, 'function');
  });

  test('dreamer exports', () => {
    assert.ok(drMod.Dreamer);
    assert.ok(drMod.Actor);
    assert.ok(drMod.Critic);
    assert.equal(typeof drMod.computeReward, 'function');
    assert.equal(typeof drMod.crucixDreamer, 'function');
  });

  test('continuous_causal exports', () => {
    assert.ok(ccMod.CausalDAG);
    assert.ok(ccMod.ContinuousSCM);
    assert.equal(typeof ccMod.crucixContinuousCausal, 'function');
  });

  test('simulation_engine exports', () => {
    assert.equal(typeof seMod.crucixSimulationEngine, 'function');
    assert.equal(typeof seMod.synthesize, 'function');
    assert.equal(typeof seMod.consensusDirection, 'function');
  });
});

describe('world_model: functional', () => {
  test('insufficient history', () => {
    const r = wmMod.crucixWorldModel([], {});
    assert.equal(r.available, false);
    assert.equal(r.reason, 'insufficient_history');
  });

  test('VAE encode/decode round trip', () => {
    const vae = new wmMod.VAE({ inputDim: 11, hiddenDim: 12, latentDim: 6 });
    const x = new Array(11).fill(0.5);
    const enc = vae.encode(x, true);
    assert.equal(enc.z.length, 6);
    assert.ok(enc.z.every(isFiniteNum));
    const dec = vae.decode(enc.z);
    assert.equal(dec.xHat.length, 11);
    assert.ok(dec.xHat.every(isFiniteNum));
  });

  test('works on 30 sweeps', () => {
    const h = makeHistory(30);
    const r = wmMod.crucixWorldModel(h, {
      vaeEpochs: 1, rnnEpochs: 1, latentDim: 4, hiddenDim: 8, horizon: 5,
    });
    assert.equal(r.available, true);
    assert.ok(r.imagination);
    assert.ok(Array.isArray(r.imagination.imaginedFeatures));
    assert.ok(r.direction);
    assert.ok(['escalation', 'deescalation', 'stable'].includes(r.direction));
  });
});

describe('neural_ode: functional', () => {
  test('insufficient history', () => {
    const r = nodeMod.crucixNeuralODE([], {});
    assert.equal(r.available, false);
  });

  test('rk4Solve on dz/dt = 0', () => {
    const f = new nodeMod.NeuralODEFunc({ stateDim: 2, hiddenDim: 4 });
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) f.W1[i][j] = 0;
      for (let j = 0; j < 4; j++) f.W2[i][j] = 0;
    }
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 4; j++) f.W3[i][j] = 0;
      f.b3[i] = 0;
    }
    const sol = nodeMod.rk4Solve(f, [1, 2], 0, 1, 10);
    assert.ok(isFiniteNum(sol.z[0]));
    assert.ok(Math.abs(sol.z[0] - 1) < 0.5);
  });

  test('works on 25 sweeps', () => {
    const h = makeHistory(25);
    const r = nodeMod.crucixNeuralODE(h, { epochs: 1, hiddenDim: 8, horizon: 5 });
    assert.equal(r.available, true);
    assert.ok(r.forecast);
    assert.ok(r.forecast.trend);
    assert.ok(['escalation', 'deescalation', 'stable'].includes(r.forecast.direction));
  });
});

describe('dreamer: functional', () => {
  test('insufficient history', () => {
    const r = drMod.crucixDreamer([], {});
    assert.equal(r.available, false);
  });

  test('Actor sampling sums to 1', () => {
    const actor = new drMod.Actor({ latentDim: 8, hiddenDim: 8, nActions: 5 });
    const z = new Array(8).fill(0.5);
    const { probs } = actor.forward(z);
    const sum = probs.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6);
    assert.ok(probs.every(p => p >= 0 && p <= 1));
  });

  test('Critic returns finite value', () => {
    const critic = new drMod.Critic({ latentDim: 8, hiddenDim: 8 });
    const z = new Array(8).fill(0.5);
    const { value } = critic.forward(z);
    assert.ok(isFiniteNum(value));
  });

  test('works on 30 sweeps', () => {
    const h = makeHistory(30);
    const r = drMod.crucixDreamer(h, {
      latentDim: 4, hiddenDim: 8, nActions: 3,
      vaeEpochs: 1, rnnEpochs: 1, trainSteps: 3, horizon: 4,
    });
    assert.equal(r.available, true);
    assert.ok(r.bestAction);
    assert.ok(r.evaluation);
    assert.ok(isFiniteNum(r.evaluation.before.meanReturn));
  });
});

describe('continuous_causal: functional', () => {
  test('insufficient history', () => {
    const r = ccMod.crucixContinuousCausal([], {});
    assert.equal(r.available, false);
  });

  test('CausalDAG detects cycle', () => {
    assert.throws(() => {
      new ccMod.CausalDAG({
        nodes: ['a', 'b'],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'a' },
        ],
      });
    });
  });

  test('CausalDAG topological order valid', () => {
    const dag = new ccMod.CausalDAG({
      nodes: ['a', 'b', 'c'],
      edges: [
        { from: 'a', to: 'b' },
        { from: 'b', to: 'c' },
      ],
    });
    const order = dag.topologicalOrder();
    assert.equal(order.length, 3);
    assert.ok(order.indexOf('a') < order.indexOf('b'));
    assert.ok(order.indexOf('b') < order.indexOf('c'));
  });

  test('works on 30 sweeps', () => {
    const h = makeHistory(30);
    const r = ccMod.crucixContinuousCausal(h, { epochs: 1, hiddenDim: 8, horizon: 5 });
    assert.equal(r.available, true);
    assert.ok(r.dag);
    assert.ok(Array.isArray(r.dag.edges));
    assert.ok(r.forecast);
    assert.ok(isFiniteNum(r.ate?.totalMagnitude));
  });
});

describe('simulation_engine: functional', () => {
  test('insufficient history', async () => {
    const r = await seMod.crucixSimulationEngine([], {});
    assert.equal(r.available, false);
  });

  test('consensusDirection works', () => {
    const c = seMod.consensusDirection(['escalation', 'escalation', 'stable']);
    assert.equal(c.direction, 'escalation');
    assert.equal(c.nVoters, 3);
    assert.ok(isFiniteNum(c.agreement));
    assert.ok(c.agreement > 0.5);
  });

  test('works on 30 sweeps (full engine)', async () => {
    const h = makeHistory(30);
    const r = await seMod.crucixSimulationEngine(h, {
      horizon: 5,
      modules: {
        worldModel: { vaeEpochs: 1, rnnEpochs: 1, latentDim: 4, hiddenDim: 8 },
        neuralODE: { epochs: 1, hiddenDim: 8 },
        dreamer: { trainSteps: 3, horizon: 3 },
        continuousCausal: { epochs: 1, hiddenDim: 8 },
      },
    });
    assert.equal(r.available, true);
    assert.ok(r.moduleStatus);
    assert.ok(r.synthesis);
    assert.ok(Array.isArray(r.answers));
    assert.ok(isFiniteNum(r.synthesis.confidence));
    assert.ok(r.synthesis.confidence >= 0 && r.synthesis.confidence <= 1);
  });
});
