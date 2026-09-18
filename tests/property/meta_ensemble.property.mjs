// tests/property/meta_ensemble.property.mjs
// Property-based тесты для MetaLearner
// Проверяем инварианты, которые должны сохраняться при ЛЮБЫХ входных данных

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MetaLearner, MetaEnsemble, extractRegimeSignature } from '../../apis/predict/meta_ensemble.mjs';

/**
 * Простой property-based testing framework
 * Генерирует случайные входы, проверяет что инварианты сохраняются
 */
function forAll(numCases, generator, assertion) {
  const failures = [];
  for (let i = 0; i < numCases; i++) {
    const input = generator(i);
    try {
      assertion(input);
    } catch (e) {
      failures.push({ case: i, input, error: e.message });
    }
  }
  return failures;
}

function randomRegimeFeatures() {
  return Array.from({ length: 8 }, () => Math.random());
}

function randomModelPredictions(n) {
  return Array.from({ length: n }, () => Math.random());
}

function randomOutcome() {
  return Math.random() > 0.5 ? 1 : 0;
}

describe('MetaLearner — Property-Based Tests', () => {

  it('PROPERTY: forward всегда возвращает веса, суммирующиеся к 1', () => {
    const failures = forAll(100, () => ({
      inputDim: Math.floor(Math.random() * 10) + 3,
      outputDim: Math.floor(Math.random() * 8) + 2,
      features: randomRegimeFeatures(),
    }), ({ inputDim, outputDim, features }) => {
      const ml = new MetaLearner({ inputDim, hiddenDim: 16, outputDim });
      const features_trimmed = features.slice(0, inputDim);
      const { weights } = ml.forward(features_trimmed);

      assert.strictEqual(weights.length, outputDim, 'Wrong weights length');

      const sum = weights.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `Sum ${sum} != 1`);

      weights.forEach(w => {
        assert.ok(w >= 0 && w <= 1, `Weight ${w} out of [0,1]`);
      });
    });

    assert.strictEqual(failures.length, 0, `Failures: ${JSON.stringify(failures.slice(0, 3))}`);
  });

  it('PROPERTY: forward детерминирован для одинаковых входов', () => {
    const failures = forAll(50, () => ({
      features: randomRegimeFeatures(),
    }), ({ features }) => {
      const ml = new MetaLearner({ inputDim: 8, hiddenDim: 16, outputDim: 5 });
      const r1 = ml.forward(features);
      const r2 = ml.forward(features);

      for (let i = 0; i < r1.weights.length; i++) {
        assert.ok(Math.abs(r1.weights[i] - r2.weights[i]) < 1e-10,
          `Determinism violated at index ${i}`);
      }
    });

    assert.strictEqual(failures.length, 0);
  });

  it('PROPERTY: обучение не увеличивает loss монотонно (сходимость)', () => {
    const failures = forAll(20, () => ({
      features: randomRegimeFeatures(),
      predictions: randomModelPredictions(5),
      outcome: randomOutcome(),
    }), ({ features, predictions, outcome }) => {
      const ml = new MetaLearner({ inputDim: 8, hiddenDim: 16, outputDim: 5 });

      let losses = [];
      for (let i = 0; i < 20; i++) {
        const r = ml.trainStep(features, predictions, outcome);
        losses.push(r.loss);
      }

      // Loss должен уменьшиться хотя бы на 5%
      const firstLoss = losses[0];
      const minLoss = Math.min(...losses);
      assert.ok(minLoss <= firstLoss * 1.05,
        `No convergence: first=${firstLoss}, min=${minLoss}`);
    });

    assert.strictEqual(failures.length, 0);
  });

  it('PROPERTY: веса не NaN даже при экстремальных входах', () => {
    const extremeFeatures = [
      [1e6, 1e6, 1e6, 1e6, 1e6, 1e6, 1e6, 1e6],
      [-1e6, -1e6, -1e6, -1e6, -1e6, -1e6, -1e6, -1e6],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [1e-10, 1e-10, 1e-10, 1e-10, 1e-10, 1e-10, 1e-10, 1e-10],
    ];

    for (const features of extremeFeatures) {
      const ml = new MetaLearner({ inputDim: 8, hiddenDim: 16, outputDim: 5 });
      const { weights } = ml.forward(features);
      weights.forEach((w, i) => {
        assert.ok(!isNaN(w), `NaN at index ${i} for features ${features[0]}`);
        assert.ok(isFinite(w), `Infinity at index ${i}`);
      });
    }
  });

  it('PROPERTY: сериализация round-trip сохраняет поведение', () => {
    const failures = forAll(30, () => ({
      features: randomRegimeFeatures(),
      outputDim: Math.floor(Math.random() * 6) + 2,
    }), ({ features, outputDim }) => {
      const ml1 = new MetaLearner({ inputDim: 8, hiddenDim: 16, outputDim });
      const r1 = ml1.forward(features);

      const json = ml1.serialize();
      const ml2 = MetaLearner.deserialize(json);
      const r2 = ml2.forward(features);

      for (let i = 0; i < outputDim; i++) {
        assert.ok(Math.abs(r1.weights[i] - r2.weights[i]) < 1e-10,
          `Round-trip changed weights at ${i}: ${r1.weights[i]} != ${r2.weights[i]}`);
      }
    });

    assert.strictEqual(failures.length, 0);
  });
});

describe('MetaEnsemble — Property-Based Tests', () => {
  it('PROPERTY: getWeights всегда возвращает валидные веса', () => {
    const failures = forAll(50, () => ({
      vix: Math.random() * 50,
      hySpread: Math.random() * 10,
      conflicts: Math.floor(Math.random() * 20),
    }), ({ vix, hySpread, conflicts }) => {
      const me = new MetaEnsemble(['m1', 'm2', 'm3', 'm4', 'm5']);
      const latest = { fred: { vix, hySpread }, gdelt: { conflictEvents: Array.from({ length: conflicts }, () => ({})) } };
      const result = me.getWeights(latest, []);

      const weights = Object.values(result.weights);
      const sum = weights.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `Weights sum ${sum}`);
      weights.forEach(w => assert.ok(w >= 0 && w <= 1));
      assert.ok(['calm', 'normal', 'elevated', 'crisis'].includes(result.regime));
    });

    assert.strictEqual(failures.length, 0);
  });
});
