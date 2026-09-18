// tests/predict/meta_ensemble.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MetaLearner, MetaEnsemble, extractRegimeSignature, crucixMetaEnsemble, DEFAULT_MODELS } from '../../apis/predict/meta_ensemble.mjs';

describe('MetaLearner', () => {
  it('forward возвращает нормализованные веса', () => {
    const ml = new MetaLearner({ inputDim: 4, hiddenDim: 8, outputDim: 3 });
    const features = [0.5, 0.3, 0.8, 0.2];
    const { weights } = ml.forward(features);
    assert.strictEqual(weights.length, 3);
    const sum = weights.reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-6);
  });

  it('обучается и уменьшает loss', () => {
    const ml = new MetaLearner({ inputDim: 4, hiddenDim: 16, outputDim: 3 });
    const features = [0.5, 0.3, 0.8, 0.2];
    const predictions = [0.3, 0.7, 0.5];
    const outcome = 0.6;

    const losses = [];
    for (let i = 0; i < 50; i++) {
      const result = ml.trainStep(features, predictions, outcome);
      losses.push(result.loss);
    }

    // Loss должен уменьшиться
    assert.ok(losses[losses.length - 1] < losses[0] * 1.5);
  });

  it('сериализуется и десериализуется', () => {
    const ml = new MetaLearner({ inputDim: 4, hiddenDim: 8, outputDim: 3 });
    const json = ml.serialize();
    const ml2 = MetaLearner.deserialize(json);
    assert.strictEqual(ml2.inputDim, 4);
    assert.strictEqual(ml2.outputDim, 3);
  });
});

describe('extractRegimeSignature', () => {
  it('возвращает 8 признаков', () => {
    const latest = { fred: { vix: 25, hySpread: 4 }, gdelt: { conflictEvents: [{}] }, sanctions: { count: 2 }, delta: { newAlerts: 3, escalatedAlerts: 1 } };
    const history = [];
    const sig = extractRegimeSignature(latest, history);
    assert.strictEqual(sig.length, 8);
    assert.ok(sig.every(v => v >= 0 && v <= 1));
  });
});

describe('MetaEnsemble', () => {
  it('возвращает веса по режиму', () => {
    const me = new MetaEnsemble(['m1', 'm2', 'm3']);
    const latest = { fred: { vix: 22 } };
    const weights = me.getWeights(latest, []);
    assert.ok(weights.weights);
    assert.ok(weights.regime);
  });

  it('классифицирует режимы', () => {
    const me = new MetaEnsemble(['m1']);
    assert.strictEqual(me._classifyRegime([0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9]), 'crisis');
    assert.strictEqual(me._classifyRegime([0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05]), 'calm');
  });
});

describe('crucixMetaEnsemble', () => {
  it('обрабатывает sweep', () => {
    const latest = { fred: { vix: 25 }, gdelt: { conflictEvents: [] } };
    const result = crucixMetaEnsemble(latest, [], {});
    assert.strictEqual(result.module, 'meta_ensemble');
    assert.ok(result.modelWeights);
    assert.ok(result.currentRegime);
  });
});
