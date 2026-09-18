// tests/property/hypergraph_contagion.property.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hypergraph, buildCrucixHypergraph } from '../../apis/predict/hypergraph_contagion.mjs';

const PROPERTY_CASES = parseInt(process.env.PROPERTY_CASES || '100', 10);

function forAll(numCases, generator, assertion) {
  const failures = [];
  for (let i = 0; i < numCases; i++) {
    try { assertion(generator(i)); }
    catch (e) { failures.push({ case: i, error: e.message }); }
  }
  return failures;
}

describe('Hypergraph — Property Tests', () => {
  it(`PROPERTY: propagate не возвращает NaN (${PROPERTY_CASES} кейсов)`, () => {
    const failures = forAll(PROPERTY_CASES, () => {
      const hg = new Hypergraph();
      const numNodes = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numNodes; i++) {
        hg.addNode(`n${i}`, `Node ${i}`, 'cyber', Math.random());
      }
      // Случайные гиперрёбра
      for (let i = 0; i < 3; i++) {
        const nodes = [];
        const numInEdge = 3 + Math.floor(Math.random() * 2);
        const shuffled = [...hg.nodes.keys()].sort(() => Math.random() - 0.5);
        for (let j = 0; j < numInEdge; j++) nodes.push(shuffled[j]);
        hg.addHyperedge(nodes, {
          weight: 0.5 + Math.random() * 3,
          type: ['AND', 'OR', 'MAJORITY'][Math.floor(Math.random() * 3)],
        });
      }
      return hg;
    }, (hg) => {
      const updates = hg.propagateAll(3);
      for (const u of updates) {
        assert.ok(!isNaN(u.delta), `NaN delta: ${u.delta}`);
        assert.ok(!isNaN(u.newProb), `NaN newProb: ${u.newProb}`);
        assert.ok(u.newProb >= 0 && u.newProb <= 1, `newProb out of [0,1]: ${u.newProb}`);
        assert.ok(!isNaN(u.activation), `NaN activation`);
      }
    });
    assert.strictEqual(failures.length, 0, JSON.stringify(failures.slice(0, 3)));
  });

  it('PROPERTY: вероятность узла всегда в [0, 1]', () => {
    const failures = forAll(PROPERTY_CASES, () => {
      const hg = new Hypergraph();
      hg.addNode('a', 'A', 'cyber', Math.random());
      hg.addNode('b', 'B', 'info', Math.random());
      hg.addNode('c', 'C', 'finance', Math.random());
      hg.addNode('target', 'T', 'finance', Math.random());
      hg.addHyperedge(['a', 'b', 'c', 'target'], {
        weight: Math.random() * 5,
        type: 'AND',
      });
      return hg;
    }, (hg) => {
      hg.propagateAll(5);
      for (const node of hg.nodes.values()) {
        assert.ok(node.currentProb >= 0 && node.currentProb <= 1,
          `Node ${node.id} out of [0,1]: ${node.currentProb}`);
      }
    });
    assert.strictEqual(failures.length, 0);
  });

  it('PROPERTY: propagate идемпотентен для стабильной системы', () => {
    const hg = buildCrucixHypergraph();
    // Все узлы в 0 — propagate не меняет
    for (const node of hg.nodes.values()) node.currentProb = 0;

    const updates = hg.propagateAll(3);
    // AND с 0 не активирует, OR тоже (0 - 0 = 0), MAJORITY = 0
    assert.strictEqual(updates.length, 0, `Expected no updates, got ${updates.length}`);
  });

  it('PROPERTY: сериализация round-trip сохраняет структуру', () => {
    const hg = buildCrucixHypergraph();
    const json = hg.toJSON();

    assert.strictEqual(json.nodes.length, hg.nodes.size);
    assert.strictEqual(json.hyperedges.length, hg.hyperedges.size);
    assert.ok(json.stats.nodeCount === hg.nodes.size);
  });
});
