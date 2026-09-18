// tests/v6/v6_pack.test.mjs

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V6 = join(__dirname, '..', '..', 'apis', 'predict', 'v6');

const ncdMod = await import(join(V6, 'neural_causal_discovery.mjs'));
const clMod = await import(join(V6, 'continual_learning.mjs'));
const crlMod = await import(join(V6, 'causal_rl.mjs'));
const qhgMod = await import(join(V6, 'quantum_hypergraph.mjs'));
const zkfMod = await import(join(V6, 'zk_federated.mjs'));

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

describe('v6 pack: smoke loading', () => {
  test('neural_causal_discovery exports', () => {
    assert.ok(ncdMod.NeuralCausalDiscovery);
    assert.ok(ncdMod.MultiHeadAttention);
    assert.equal(typeof ncdMod.crucixNeuralCausalDiscovery, 'function');
  });

  test('continual_learning exports', () => {
    assert.ok(clMod.EWCLearner);
    assert.ok(clMod.SynapticIntelligence);
    assert.equal(typeof clMod.crucixContinualLearning, 'function');
  });

  test('causal_rl exports', () => {
    assert.ok(crlMod.CausalEnvironment);
    assert.ok(crlMod.CausalQLearner);
    assert.ok(crlMod.CausalPolicyGradient);
    assert.equal(typeof crlMod.crucixCausalRL, 'function');
  });

  test('quantum_hypergraph exports', () => {
    assert.ok(qhgMod.QUBOFormulation);
    assert.ok(qhgMod.QuantumAnnealer);
    assert.ok(qhgMod.HypergraphMAP);
    assert.equal(typeof qhgMod.crucixQuantumHypergraph, 'function');
  });

  test('zk_federated exports', () => {
    assert.ok(zkfMod.ZKSchnorrProver);
    assert.ok(zkfMod.DPMechanism);
    assert.ok(zkfMod.FederatedNode);
    assert.ok(zkfMod.SecureAggregator);
    assert.equal(typeof zkfMod.crucixZKFederated, 'function');
  });
});

describe('continual_learning: functional', () => {
  test('insufficient history returns unavailable', () => {
    const r = clMod.crucixContinualLearning([], {});
    assert.equal(r.available, false);
    assert.equal(r.reason, 'insufficient_history');
  });

  test('works on 35 sweep history (EWC)', () => {
    const h = makeHistory(35);
    const r = clMod.crucixContinualLearning(h, { method: 'ewc', epochs: 3 });
    assert.equal(r.available, true);
    assert.equal(r.method, 'ewc');
    assert.ok(isFiniteNum(r.lossBefore));
    assert.ok(isFiniteNum(r.lossAfter));
    assert.ok(r.prediction);
    assert.ok(['crisis', 'elevated', 'stable'].includes(r.prediction.class));
  });

  test('works with Synaptic Intelligence', () => {
    const h = makeHistory(35);
    const r = clMod.crucixContinualLearning(h, { method: 'si', epochs: 3 });
    assert.equal(r.available, true);
    assert.equal(r.method, 'si');
    assert.ok(r.prediction);
  });

  test('EWCLearner forward/backward finite', () => {
    const l = new clMod.EWCLearner({ inputSize: 10, hiddenSize: 8, outputSize: 3 });
    const x = new Array(10).fill(0.5);
    const probs = l.predict(x);
    assert.equal(probs.length, 3);
    assert.ok(probs.every(isFiniteNum));
    const sum = probs.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6);
  });
});

describe('causal_rl: functional', () => {
  test('insufficient history returns unavailable', () => {
    const r = crlMod.crucixCausalRL([], {});
    assert.equal(r.available, false);
  });

  test('works on 25 sweep history', () => {
    const h = makeHistory(25);
    const r = crlMod.crucixCausalRL(h, { episodes: 10 });
    assert.equal(r.available, true);
    assert.equal(r.method, 'q_learning');
    assert.ok(r.training);
    assert.ok(isFiniteNum(r.training.avgReward));
    assert.ok(typeof r.recommendedAction === 'string');
    assert.ok(Array.isArray(r.causalInsights));
  });

  test('CausalEnvironment reset works', () => {
    const env = new crlMod.CausalEnvironment({
      nodes: ['a', 'b', 'c'],
      edges: [{ from: 'a', to: 'b', weight: 0.8 }, { from: 'b', to: 'c', weight: 0.5 }],
      maxSteps: 5,
    });
    const s = env.reset();
    assert.ok(s.a !== undefined);
    assert.ok(s.b !== undefined);
    assert.ok(s.c !== undefined);
  });
});

describe('quantum_hypergraph: functional', () => {
  test('insufficient history returns unavailable', () => {
    const r = qhgMod.crucixQuantumHypergraph([], {});
    assert.equal(r.available, false);
  });

  test('works on 30 sweep history', () => {
    const h = makeHistory(30);
    const r = qhgMod.crucixQuantumHypergraph(h, { nSteps: 200, nReplicas: 4 });
    assert.equal(r.available, true);
    assert.ok(r.nQubits > 0);
    assert.ok(r.annealing);
    assert.ok(isFiniteNum(r.annealing.bestEnergy));
    assert.ok(r.hypergraph);
    assert.ok(isFiniteNum(r.hypergraph.nHyperedges));
    assert.ok(typeof r.hypergraph.isAcyclic === 'boolean');
  });

  test('QUBOFormulation energy finite', () => {
    const q = new qhgMod.QUBOFormulation({ nVariables: 3, maxHyperedgeSize: 2 });
    const data = Array.from({ length: 20 }, () => [Math.random(), Math.random(), Math.random()]);
    q.build(data);
    const x = new Array(q.nQubits).fill(0);
    const e = q.energy(x);
    assert.ok(isFiniteNum(e));
  });
});

describe('zk_federated: functional', () => {
  test('insufficient history returns unavailable', () => {
    const r = zkfMod.crucixZKFederated([], {});
    assert.equal(r.available, false);
  });

  test('works on 35 sweep history', () => {
    const h = makeHistory(35);
    const r = zkfMod.crucixZKFederated(h, { nNodes: 3, rounds: 3, epsilon: 1.0 });
    assert.equal(r.available, true);
    assert.equal(r.nNodes, 3);
    assert.equal(r.rounds, 3);
    assert.ok(r.privacy);
    assert.ok(isFiniteNum(r.privacy.epsilon));
    assert.ok(r.training);
    assert.ok(isFiniteNum(r.training.initialLoss));
    assert.ok(isFiniteNum(r.training.finalLoss));
    assert.ok(r.security);
    assert.equal(r.security.zkProtocol, 'schnorr_fiat_shamir');
  });

  test('ZKSchnorrProver verifies correctly', () => {
    const prover = new zkfMod.ZKSchnorrProver();
    prover.commit();
    const proof = prover.proveNonInteractive('test_context');
    const valid = zkfMod.ZKSchnorrProver.verify(proof, 'test_context');
    assert.equal(valid, true);
    const invalid = zkfMod.ZKSchnorrProver.verify(proof, 'wrong_context');
    assert.equal(invalid, false);
  });

  test('DPMechanism sigma positive', () => {
    const dp = new zkfMod.DPMechanism({ epsilon: 1.0, delta: 1e-5, clipNorm: 1.0 });
    assert.ok(isFiniteNum(dp.sigma));
    assert.ok(dp.sigma > 0);
  });
});
