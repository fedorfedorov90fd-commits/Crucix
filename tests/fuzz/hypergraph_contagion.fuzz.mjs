// tests/fuzz/hypergraph_contagion.fuzz.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hypergraph, crucixHypergraphContagion } from '../../apis/predict/hypergraph_contagion.mjs';

describe('Hypergraph — Fuzz Tests', () => {
  it('FUZZ: не падает на произвольные гиперрёбра', () => {
    for (let trial = 0; trial < 100; trial++) {
      const hg = new Hypergraph();
      const numNodes = Math.floor(Math.random() * 10) + 3;
      for (let i = 0; i < numNodes; i++) {
        hg.addNode(`n${i}`, `Node ${i}`, 'cyber', Math.random());
      }

      const numEdges = Math.floor(Math.random() * 10);
      for (let i = 0; i < numEdges; i++) {
        const edgeSize = 3 + Math.floor(Math.random() * (numNodes - 2));
        const nodes = [];
        const shuffled = [...hg.nodes.keys()].sort(() => Math.random() - 0.5);
        for (let j = 0; j < Math.min(edgeSize, numNodes); j++) {
          nodes.push(shuffled[j]);
        }
        try {
          hg.addHyperedge(nodes, { weight: Math.random() * 5 });
        } catch (e) {
          // Допустимо, если nodes имеет <3 уникальных
        }
      }

      try {
        hg.propagateAll(5);
      } catch (e) {
        assert.fail(`Crash on trial ${trial}: ${e.message}`);
      }
    }
  });

  it('FUZZ: crucixHypergraphContagion на произвольном latest', () => {
    for (let trial = 0; trial < 100; trial++) {
      const latest = {};
      if (Math.random() > 0.3) latest.sanctions = { count: Math.floor(Math.random() * 30) };
      if (Math.random() > 0.3) latest.gdelt = { conflictEvents: Array.from({ length: Math.floor(Math.random() * 30) }, () => ({})) };
      if (Math.random() > 0.3) latest.fred = { vix: Math.random() * 100 };
      if (Math.random() > 0.3) latest.delta = { escalatedAlerts: Math.floor(Math.random() * 20) };

      try {
        const result = crucixHypergraphContagion(latest, []);
        assert.strictEqual(result.module, 'hypergraph_contagion');
      } catch (e) {
        assert.fail(`Trial ${trial} crash: ${e.message}`);
      }
    }
  });

  it('FUZZ: экстремальные веса гиперрёбер', () => {
    const hg = new Hypergraph();
    hg.addNode('a', 'A', 'cyber', 0.5);
    hg.addNode('b', 'B', 'info', 0.5);
    hg.addNode('c', 'C', 'finance', 0.5);

    const extremeWeights = [0, -1, 1e6, -1e6, NaN, Infinity, -Infinity];
    for (const w of extremeWeights) {
      try {
        hg.addHyperedge(['a', 'b', 'c'], { weight: w });
      } catch (e) {
        // Допустимо
      }
    }

    assert.doesNotThrow(() => hg.propagateAll(3));
  });
});
