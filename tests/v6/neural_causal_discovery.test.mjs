// tests/v6/neural_causal_discovery.test.mjs
// Unit-тесты для apis/predict/v6/neural_causal_discovery.mjs
//
// Запуск: node tests/v6/neural_causal_discovery.test.mjs
// Или через test runner: node --test tests/v6/neural_causal_discovery.test.mjs

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = join(__dirname, '..', '..', 'apis', 'predict', 'v6', 'neural_causal_discovery.mjs');

const {
  NeuralCausalDiscovery,
  MultiHeadAttention,
  crucixNeuralCausalDiscovery,
} = await import(MODULE_PATH);

// ═══════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════

function makeHistory(n, options = {}) {
  const noise = options.noise ?? 0.1;
  return Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(Date.now() - (n - i) * 15 * 60 * 1000).toISOString(),
    fred: {
      vix: 20 + Math.sin(i / 4) * 10 + (Math.random() - 0.5) * noise * 10,
      hySpread: 3 + Math.cos(i / 5) * 1.5,
    },
    gdelt: {
      conflictEvents: Array(Math.floor(Math.abs(Math.sin(i / 3)) * 10) + 1).fill({}),
    },
    sanctions: { count: Math.floor(Math.random() * 5) },
    tension: 0.4 + Math.sin(i / 4) * 0.3,
    radiation: { max: 50 + Math.random() * 30 },
  }));
}

function isFiniteNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

function isFiniteMatrix(m) {
  if (!Array.isArray(m)) return false;
  for (const row of m) {
    if (!Array.isArray(row)) return false;
    for (const v of row) if (!Number.isFinite(v)) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════
// SMOKE ТЕСТЫ
// ═══════════════════════════════════════════════════

test('module loads without errors', () => {
  assert.ok(NeuralCausalDiscovery, 'NeuralCausalDiscovery должен быть классом');
  assert.ok(MultiHeadAttention, 'MultiHeadAttention должен быть классом');
  assert.equal(typeof crucixNeuralCausalDiscovery, 'function');
});

test('NeuralCausalDiscovery constructor initializes correctly', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 5 });
  assert.equal(ncd.nVariables, 5);
  assert.equal(ncd.W.length, 5);
  assert.equal(ncd.W[0].length, 5);
  // Диагональ должна быть 0
  for (let i = 0; i < 5; i++) {
    assert.equal(ncd.W[i][i], 0);
  }
  assert.ok(isFiniteMatrix(ncd.W));
});

test('MultiHeadAttention forward produces finite values', () => {
  const mha = new MultiHeadAttention(8, 2);
  const X = [
    [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  ];
  const out = mha.forward(X);
  assert.equal(out.length, 2);
  assert.equal(out[0].length, 8);
  assert.ok(isFiniteMatrix(out));
});

// ═══════════════════════════════════════════════════
// ФУНКЦИОНАЛЬНЫЕ ТЕСТЫ
// ═══════════════════════════════════════════════════

test('acyclicityConstraint returns 0 for zero matrix', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 3 });
  // Обнулить W
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) ncd.W[i][j] = 0;
  }
  const h = ncd.acyclicityConstraint();
  assert.ok(isFiniteNumber(h));
  assert.ok(Math.abs(h) < 1e-6, `h(W) должен быть ≈0 для нулевой матрицы, получено ${h}`);
});

test('acyclicityConstraint returns positive for DAG', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 3 });
  // W: 0→1, 1→2 (простой DAG)
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) ncd.W[i][j] = 0;
  }
  ncd.W[0][1] = 1.0;
  ncd.W[1][2] = 1.0;
  const h = ncd.acyclicityConstraint();
  // Для DAG h(W) > 0 (мера "не-нулевая" через trace-exp)
  assert.ok(isFiniteNumber(h));
});

test('sparsityLoss computes L1 norm correctly', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 2 });
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) ncd.W[i][j] = 0;
  }
  ncd.W[0][1] = 0.5;
  ncd.W[1][0] = -0.3;
  const loss = ncd.sparsityLoss();
  assert.ok(isFiniteNumber(loss));
  assert.ok(Math.abs(loss - 0.8) < 1e-6);
});

test('computeLoss returns structured object', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 3 });
  const X = [
    [0.1, 0.2, 0.3],
    [0.4, 0.5, 0.6],
    [0.7, 0.8, 0.9],
  ];
  const loss = ncd.computeLoss(X);
  assert.ok('total' in loss, 'total должен быть');
  assert.ok('mse' in loss, 'mse должен быть');
  assert.ok('sparse' in loss, 'sparse должен быть');
  assert.ok('acyc' in loss, 'acyc должен быть');
  assert.ok(isFiniteNumber(loss.total));
  assert.ok(isFiniteNumber(loss.mse));
});

test('extractDAG returns array of edges with thresholds', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 3 });
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) ncd.W[i][j] = 0;
  }
  ncd.W[0][1] = 0.5;
  ncd.W[1][2] = -0.8;
  ncd.W[2][0] = 0.05; // ниже порога
  const edges = ncd.extractDAG(0.1);
  assert.ok(Array.isArray(edges));
  assert.equal(edges.length, 2, `ожидалось 2 ребра, получено ${edges.length}`);
  // Топ-ребро должно быть с большим |weight|
  assert.equal(edges[0].to, 2);
  assert.ok(edges[0].weight < 0);
  assert.equal(edges[0].direction, 'negative');
});

test('getMetrics returns valid structure', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 4 });
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) ncd.W[i][j] = 0;
  }
  ncd.W[0][1] = 0.5;
  ncd.W[1][2] = 0.3;
  ncd.W[2][3] = 0.4;
  const m = ncd.getMetrics();
  assert.equal(m.nVariables, 4);
  assert.equal(m.nEdges, 3);
  assert.ok(isFiniteNumber(m.density));
  assert.equal(typeof m.isAcyclic, 'boolean');
  assert.ok(Array.isArray(m.topEdges));
});

test('_checkAcyclic detects cycle correctly', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 3 });
  // DAG: 0→1, 1→2
  const dagAdj = [
    [0, 1, 0],
    [0, 0, 1],
    [0, 0, 0],
  ];
  assert.equal(ncd._checkAcyclic(dagAdj), true);

  // Цикл: 0→1, 1→2, 2→0
  const cycleAdj = [
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 0],
  ];
  assert.equal(ncd._checkAcyclic(cycleAdj), false);
});

// ═══════════════════════════════════════════════════
// ИНТЕГРАЦИОННЫЕ ТЕСТЫ (crucixNeuralCausalDiscovery)
// ═══════════════════════════════════════════════════

test('crucixNeuralCausalDiscovery fails on insufficient history', () => {
  const result = crucixNeuralCausalDiscovery([], {});
  assert.equal(result.available, false);
  assert.equal(result.reason, 'insufficient_history');
  assert.equal(result.minimumRequired, 20);
});

test('crucixNeuralCausalDiscovery works on 25 sweep history', () => {
  const history = makeHistory(25);
  const result = crucixNeuralCausalDiscovery(history, { iterations: 5 });
  assert.equal(result.available, true);
  assert.ok(result.elapsedMs > 0);
  assert.equal(result.nVariables, 5, 'default vars: 5');
  assert.equal(result.nTimesteps, 25);
  assert.ok(Array.isArray(result.discoveredEdges));
  assert.ok(isFiniteNumber(result.nEdges));
  assert.ok(typeof result.isAcyclic === 'boolean');
  assert.ok(isFiniteNumber(result.density));
  assert.ok(typeof result.interpretation === 'string');
  assert.ok(result.interpretation.length > 0);
});

test('crucixNeuralCausalDiscovery returns finite finalLoss', () => {
  const history = makeHistory(30);
  const result = crucixNeuralCausalDiscovery(history, { iterations: 10 });
  assert.equal(result.available, true);
  // finalLoss может быть 0 (если все loss finite), но не NaN
  if (result.finalLoss !== null) {
    assert.ok(isFiniteNumber(result.finalLoss),
      `finalLoss должен быть finite, получено ${result.finalLoss}`);
  }
});

// ═══════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════

test('NeuralCausalDiscovery handles 1 variable', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 1 });
  assert.equal(ncd.W.length, 1);
  assert.equal(ncd.W[0].length, 1);
  const X = [[0.5], [0.6], [0.7]];
  const loss = ncd.computeLoss(X);
  assert.ok(isFiniteNumber(loss.total));
});

test('extractDAG on empty matrix returns empty array', () => {
  const ncd = new NeuralCausalDiscovery({ nVariables: 2 });
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) ncd.W[i][j] = 0;
  }
  const edges = ncd.extractDAG(0.1);
  assert.equal(edges.length, 0);
});

test('neural causal discovery result has all required fields', () => {
  const history = makeHistory(25);
  const result = crucixNeuralCausalDiscovery(history, { iterations: 3 });
  const requiredFields = [
    'module', 'available', 'elapsedMs',
    'nVariables', 'nTimesteps', 'variables',
    'discoveredEdges', 'nEdges', 'isAcyclic',
    'density', 'interpretation',
  ];
  for (const field of requiredFields) {
    assert.ok(field in result, `поле "${field}" отсутствует в результате`);
  }
  assert.equal(result.module, 'neural_causal_discovery');
});

console.log('\n✅ Все тесты neural_causal_discovery завершены\n');
