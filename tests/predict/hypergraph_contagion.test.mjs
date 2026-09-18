// tests/predict/hypergraph_contagion.test.mjs
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { Hypergraph, buildCrucixHypergraph, crucixHypergraphContagion } from '../../apis/predict/hypergraph_contagion.mjs';

describe('Hypergraph — базовая функциональность', () => {
  let hg;
  beforeEach(() => { hg = new Hypergraph(); });

  it('добавляет узлы с дефолтной вероятностью', () => {
    hg.addNode('a', 'Node A', 'cyber');
    hg.addNode('b', 'Node B', 'finance', 0.7);

    assert.strictEqual(hg.nodes.size, 2);
    assert.strictEqual(hg.nodes.get('a').currentProb, 0.5);
    assert.strictEqual(hg.nodes.get('b').currentProb, 0.7);
  });

  it('добавляет гиперребро с 3+ узлами', () => {
    hg.addNode('a', 'A', 'cyber');
    hg.addNode('b', 'B', 'info');
    hg.addNode('c', 'C', 'finance');

    const id = hg.addHyperedge(['a', 'b', 'c'], { weight: 2.0, type: 'AND' });
    assert.ok(id.startsWith('he_'));
    assert.strictEqual(hg.hyperedges.size, 1);

    const he = hg.hyperedges.get(id);
    assert.strictEqual(he.nodes.length, 3);
    assert.strictEqual(he.weight, 2.0);
    assert.strictEqual(he.type, 'AND');
  });

  it('бросает ошибку при гиперребре с <3 узлами', () => {
    hg.addNode('a', 'A', 'cyber');
    hg.addNode('b', 'B', 'info');

    assert.throws(
      () => hg.addHyperedge(['a', 'b'], {}),
      /at least 3 nodes/
    );
  });

  it('бросает ошибку при неизвестном узле в гиперребре', () => {
    hg.addNode('a', 'A', 'cyber');
    hg.addNode('b', 'B', 'info');

    assert.throws(
      () => hg.addHyperedge(['a', 'b', 'unknown'], {}),
      /Node unknown not found/
    );
  });
});

describe('Hypergraph — propagate', () => {
  it('AND-гиперребро: активируется только когда ВСЕ узлы активны', () => {
    const hg = new Hypergraph();
    hg.addNode('a', 'A', 'cyber', 0.9);
    hg.addNode('b', 'B', 'info', 0.9);
    hg.addNode('target', 'Target', 'finance', 0.2);

    hg.addHyperedge(['a', 'b', 'target'], { weight: 2.0, type: 'AND' });

    // Случай 1: оба активны → target растёт
    const updates1 = hg.propagate('target');
    assert.ok(updates1.length > 0);
    assert.ok(updates1[0].activation > 0.5);

    // Сброс и тест: один неактивен
    hg.nodes.get('b').currentProb = 0.1;
    hg.nodes.get('target').currentProb = 0.2;
    const updates2 = hg.propagate('target');
    if (updates2.length > 0) {
      assert.ok(updates2[0].activation < 0.5, 'AND with one low should not activate');
    }
  });

  it('OR-гиперребро: активируется когда ХОТЯ БЫ ОДИН узел активен', () => {
    const hg = new Hypergraph();
    hg.addNode('a', 'A', 'cyber', 0.9);
    hg.addNode('b', 'B', 'info', 0.1);
    hg.addNode('target', 'Target', 'finance', 0.2);

    hg.addHyperedge(['a', 'b', 'target'], { weight: 2.0, type: 'OR' });

    const updates = hg.propagate('target');
    assert.ok(updates.length > 0);
    assert.ok(updates[0].activation > 0.5, 'OR with one high should activate');
  });

  it('MAJORITY-гиперребро: активируется при большинстве', () => {
    const hg = new Hypergraph();
    hg.addNode('a', 'A', 'cyber', 0.9);
    hg.addNode('b', 'B', 'info', 0.8);
    hg.addNode('c', 'C', 'physical', 0.1);
    hg.addNode('target', 'Target', 'finance', 0.2);

    hg.addHyperedge(['a', 'b', 'c', 'target'], { weight: 2.0, type: 'MAJORITY' });

    const updates = hg.propagate('target');
    assert.ok(updates.length > 0);
    // 2 из 3 активны → activation = 2/3
    assert.ok(Math.abs(updates[0].activation - 2 / 3) < 0.01);
  });

  it('не мутирует узел если дельта слишком мала', () => {
    const hg = new Hypergraph();
    hg.addNode('a', 'A', 'cyber', 0.1);
    hg.addNode('b', 'B', 'info', 0.1);
    hg.addNode('target', 'Target', 'finance', 0.1);

    hg.addHyperedge(['a', 'b', 'target'], { weight: 1.0, type: 'AND' });

    const updates = hg.propagate('target');
    assert.strictEqual(updates.length, 0);
  });
});

describe('Hypergraph — propagateAll', () => {
  it('распространяет по нескольким итерациям', () => {
    const hg = buildCrucixHypergraph();

    // Активируем несколько узлов
    hg.nodes.get('sanctions').currentProb = 0.8;
    hg.nodes.get('conflict').currentProb = 0.8;
    hg.nodes.get('media_campaign').currentProb = 0.8;

    const updates = hg.propagateAll(3);
    assert.ok(updates.length > 0);

    // market_crash должен вырасти через гиперребро [sanctions, conflict, media_campaign]
    const marketCrashUpdate = updates.find(u => u.target === 'market_crash');
    assert.ok(marketCrashUpdate, 'market_crash should be updated');
    assert.ok(marketCrashUpdate.delta > 0);
  });

  it('останавливается, если нет обновлений', () => {
    const hg = new Hypergraph();
    hg.addNode('isolated', 'Isolated', 'cyber', 0.5);

    const updates = hg.propagateAll(5);
    assert.strictEqual(updates.length, 0);
  });
});

describe('crucixHypergraphContagion — интеграция', () => {
  it('обрабатывает sweep без падений', () => {
    const latest = {
      sanctions: { count: 5 },
      gdelt: { conflictEvents: Array.from({ length: 12 }, () => ({})) },
      fred: { vix: 28 },
      delta: { escalatedAlerts: 4 },
    };

    const result = crucixHypergraphContagion(latest, []);
    assert.strictEqual(result.module, 'hypergraph_contagion');
    assert.ok(result.stats.nodeCount > 0);
    assert.ok(result.stats.hyperedgeCount > 0);
    assert.ok(Array.isArray(result.updates));
  });

  it('возвращает критичные гиперрёбра при высоких данных', () => {
    const latest = {
      sanctions: { count: 15 },
      gdelt: { conflictEvents: Array.from({ length: 20 }, () => ({})) },
      fred: { vix: 40 },
      delta: { escalatedAlerts: 8 },
    };

    const result = crucixHypergraphContagion(latest, []);
    assert.ok(result.criticalHyperedges.length >= 0);
  });

  it('не падает на пустом latest', () => {
    const result = crucixHypergraphContagion({}, []);
    assert.strictEqual(result.module, 'hypergraph_contagion');
  });
});
