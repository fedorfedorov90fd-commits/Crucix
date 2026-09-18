// tests/predict/multilayer_causal.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MultiLayerCausalGraph, LAYERS, crucixMultiLayerCausal, NODE_DEFINITIONS, CAUSAL_EDGES } from '../../apis/predict/multilayer_causal.mjs';

describe('MultiLayerCausalGraph', () => {
  it('инициализируется со всеми узлами', () => {
    const g = new MultiLayerCausalGraph();
    assert.strictEqual(g.nodes.size, Object.keys(NODE_DEFINITIONS).length);
    assert.ok(g.crossLayerEdges.length > 0);
  });

  it('содержит 4 слоя', () => {
    const g = new MultiLayerCausalGraph();
    const layers = new Set([...g.nodes.values()].map(n => n.layer));
    assert.strictEqual(layers.size, 4);
    assert.ok(layers.has(LAYERS.CYBER));
    assert.ok(layers.has(LAYERS.INFO));
    assert.ok(layers.has(LAYERS.FINANCE));
    assert.ok(layers.has(LAYERS.PHYSICAL));
  });

  it('обновляет вероятность узла', () => {
    const g = new MultiLayerCausalGraph();
    g.observe('vixSpike', 0.9, 0.9);
    const node = g.nodes.get('vixSpike');
    assert.ok(node.currentProb > 0.5);
  });

  it('распространяет вероятности по графу', () => {
    const g = new MultiLayerCausalGraph();
    g.observe('cyberAttack', 0.95, 1.0);
    const updates = g.propagate(3);
    assert.ok(updates.length > 0);
    assert.ok(updates.some(u => u.to === 'vixSpike'));
  });

  it('выполняет do-intervention', () => {
    const g = new MultiLayerCausalGraph();
    const result = g.doIntervention('infrastructureBreach', 0.9);
    assert.strictEqual(result.intervention.nodeId, 'infrastructureBreach');
    assert.ok(result.directUpdates >= 0);
    assert.ok(typeof result.totalImpact === 'number');
  });

  it('анализирует кросс-слойное влияние', () => {
    const g = new MultiLayerCausalGraph();
    const influence = g.crossLayerInfluence();
    assert.ok(Object.keys(influence).length > 0);
    for (const [key, val] of Object.entries(influence)) {
      assert.ok(val.count > 0);
      assert.ok(val.avgStrength > 0);
    }
  });

  it('генерирует рекурсивные counterfactuals', () => {
    const g = new MultiLayerCausalGraph();
    const chains = g.recursiveCounterfactual('militaryBuildUp', 0.85, 3);
    assert.ok(Array.isArray(chains));
    assert.ok(chains.length > 0);
  });
});

describe('crucixMultiLayerCausal', () => {
  it('обрабатывает sweep', () => {
    const latest = {
      fred: { vix: 32 },
      gdelt: { conflictEvents: Array.from({ length: 12 }, () => ({})) },
      sanctions: { count: 5 },
      radiation: { max: 180 },
      delta: { escalatedAlerts: 3 },
    };
    const result = crucixMultiLayerCausal(latest, []);
    assert.strictEqual(result.module, 'multilayer_causal');
    assert.ok(result.graphStats.nodeCount > 0);
    assert.ok(result.scenarios.scenario1);
  });
});
