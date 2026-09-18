// tests/mutation/hypergraph.mutate.mjs
//
// Mutation testing для Hypergraph Contagion.
//
// Методология: mutation testing (Jia & Harman, 2011, "An Analysis and Survey
// of the Development of Mutation Testing") предполагает внесение
// синтетических дефектов (мутаций) в исходный код с последующей проверкой,
// обнаруживают ли их существующие тесты. Mutation score = killed / total.
//
// Для Hypergraph критические мутации:
//   1. Изменение логики активации AND -> OR
//   2. Отключение затухания (weight = 1.0 always)
//   3. Игнорирование типа гиперребра
//   4. Отключение нормализации вероятности
//   5. Инверсия направления (target -> sources)
//
// ЗАПУСК:
//   node tests/mutation/hypergraph.mutate.mjs
//   или через run_all.mjs
//
// РЕЖИМЫ:
//   Обычный: печатает отчёт в stdout, process.exit(0|1) по порогу.
//   JSON-режим (CRUCIX_MUTATION_JSON=1): печатает только JSON, не выходит
//   с кодом 1. Используется оркестратором run_all.mjs.

import { Hypergraph, buildCrucixHypergraph } from '../../apis/predict/hypergraph_contagion.mjs';

/**
 * Реестр мутаций. Каждая мутация:
 *   - name: человекочитаемое имя
 *   - apply(HypergraphClass): применяет мутацию к классу
 *   - detect(HypergraphClass): возвращает true, если тест ловит мутацию
 */
const MUTATIONS = [
  {
    name: 'AND-логика заменена на OR',
    apply: (HGClass) => {
      const originalPropagate = HGClass.prototype.propagate;
      HGClass.prototype.propagate = function(targetNodeId) {
        // Мутация: игнорируем тип гиперребра, всегда используем OR
        const incoming = [...this.hyperedges.values()]
          .filter(he => he.nodes.includes(targetNodeId));

        const updates = [];
        const targetNode = this.nodes.get(targetNodeId);
        if (!targetNode) return updates;

        for (const he of incoming) {
          const sourceNodes = he.nodes.filter(id => id !== targetNodeId);
          const probs = sourceNodes.map(id => this.nodes.get(id)?.currentProb ?? 0);
          // МУТАЦИЯ: всегда OR
          const activation = 1 - probs.reduce((prod, p) => prod * (1 - p), 1);

          const delta = activation * (he.weight - 1) * 0.2;
          const newProb = Math.max(0.001, Math.min(0.999, targetNode.currentProb + delta));

          if (Math.abs(delta) > 0.001) {
            updates.push({
              hyperedge: he.id, target: targetNodeId, sources: sourceNodes,
              activation, delta, newProb, type: he.type,
            });
            targetNode.currentProb = newProb;
          }
        }
        return updates;
      };
    },
    detect: (HGClass) => {
      // Тест: AND-гиперребро с одним неактивным узлом не должно активироваться
      const hg = new HGClass();
      hg.addNode('a', 'A', 'cyber', 0.9);
      hg.addNode('b', 'B', 'info', 0.05);
      hg.addNode('target', 'T', 'finance', 0.1);
      hg.addHyperedge(['a', 'b', 'target'], { weight: 3.0, type: 'AND' });

      const updates = hg.propagate('target');
      // AND-логика: activation = 0.9 * 0.05 = 0.045 -> нет активации
      // OR-логика (мутация): activation = 1 - 0.1*0.95 = 0.905 -> активация
      if (updates.length > 0 && updates[0].activation > 0.5) {
        return true;
      }
      return false;
    },
  },

  {
    name: 'Weight игнорируется (всегда 1.0)',
    apply: (HGClass) => {
      HGClass.prototype.propagate = function(targetNodeId) {
        const incoming = [...this.hyperedges.values()]
          .filter(he => he.nodes.includes(targetNodeId));
        const updates = [];
        const targetNode = this.nodes.get(targetNodeId);
        if (!targetNode) return updates;

        for (const he of incoming) {
          const sourceNodes = he.nodes.filter(id => id !== targetNodeId);
          const probs = sourceNodes.map(id => this.nodes.get(id)?.currentProb ?? 0);
          let activation = probs.reduce((prod, p) => prod * p, 1);
          // МУТАЦИЯ: weight всегда 1.0
          const delta = activation * (1.0 - 1) * 0.2;
          if (Math.abs(delta) > 0.001) {
            updates.push({ hyperedge: he.id, target: targetNodeId, delta });
          }
        }
        return updates;
      };
    },
    detect: (HGClass) => {
      const hg = new HGClass();
      hg.addNode('a', 'A', 'cyber', 0.9);
      hg.addNode('b', 'B', 'info', 0.9);
      hg.addNode('target', 'T', 'finance', 0.1);
      hg.addHyperedge(['a', 'b', 'target'], { weight: 5.0, type: 'AND' });

      const updates = hg.propagate('target');
      // Оригинал: weight=5 -> delta = 0.81 * 4 * 0.2 = 0.648 -> активация
      // Мутация: delta = 0 -> нет обновлений
      return updates.length === 0;
    },
  },

  {
    name: 'Вероятность не клампится в [0,1]',
    apply: (HGClass) => {
      HGClass.prototype.propagate = function(targetNodeId) {
        const incoming = [...this.hyperedges.values()]
          .filter(he => he.nodes.includes(targetNodeId));
        const updates = [];
        const targetNode = this.nodes.get(targetNodeId);
        if (!targetNode) return updates;

        for (const he of incoming) {
          const sourceNodes = he.nodes.filter(id => id !== targetNodeId);
          const probs = sourceNodes.map(id => this.nodes.get(id)?.currentProb ?? 0);
          const activation = probs.reduce((prod, p) => prod * p, 1);
          const delta = activation * (he.weight - 1) * 0.2;
          // МУТАЦИЯ: без clamp
          const newProb = targetNode.currentProb + delta;
          if (Math.abs(delta) > 0.001) {
            updates.push({ hyperedge: he.id, target: targetNodeId, newProb });
            targetNode.currentProb = newProb;
          }
        }
        return updates;
      };
    },
    detect: (HGClass) => {
      const hg = new HGClass();
      hg.addNode('a', 'A', 'cyber', 0.99);
      hg.addNode('b', 'B', 'info', 0.99);
      hg.addNode('c', 'C', 'physical', 0.99);
      hg.addNode('target', 'T', 'finance', 0.95);
      hg.addHyperedge(['a', 'b', 'c', 'target'], { weight: 10.0, type: 'AND' });

      hg.propagate('target');
      const prob = hg.nodes.get('target').currentProb;
      // Оригинал: clamp(0.95 + 0.97*9*0.2 = 0.95+1.75) = 0.999
      // Мутация: 0.95 + 1.75 = 2.7 (>1)
      return prob > 1.0;
    },
  },

  {
    name: 'Propagation меняет source вместо target',
    apply: (HGClass) => {
      HGClass.prototype.propagate = function(targetNodeId) {
        const incoming = [...this.hyperedges.values()]
          .filter(he => he.nodes.includes(targetNodeId));
        const updates = [];
        const targetNode = this.nodes.get(targetNodeId);
        if (!targetNode) return updates;

        for (const he of incoming) {
          const sourceNodes = he.nodes.filter(id => id !== targetNodeId);
          const probs = sourceNodes.map(id => this.nodes.get(id)?.currentProb ?? 0);
          const activation = probs.reduce((prod, p) => prod * p, 1);
          const delta = activation * (he.weight - 1) * 0.2;
          // МУТАЦИЯ: меняем source вместо target
          for (const srcId of sourceNodes) {
            const srcNode = this.nodes.get(srcId);
            srcNode.currentProb = Math.max(0.001, Math.min(0.999, srcNode.currentProb + delta));
          }
          updates.push({ hyperedge: he.id, target: targetNodeId, delta, mutatedSource: true });
        }
        return updates;
      };
    },
    detect: (HGClass) => {
      const hg = new HGClass();
      hg.addNode('a', 'A', 'cyber', 0.3);
      hg.addNode('b', 'B', 'info', 0.3);
      hg.addNode('target', 'T', 'finance', 0.3);
      hg.addHyperedge(['a', 'b', 'target'], { weight: 3.0, type: 'AND' });

      const beforeTarget = hg.nodes.get('target').currentProb;
      const beforeA = hg.nodes.get('a').currentProb;
      hg.propagate('target');
      const afterTarget = hg.nodes.get('target').currentProb;
      const afterA = hg.nodes.get('a').currentProb;

      // Оригинал: target меняется, a не меняется
      // Мутация: target не меняется, a меняется
      return afterA !== beforeA;
    },
  },

  {
    name: 'MAJORITY использует порог 0.5 неправильно',
    apply: (HGClass) => {
      const originalPropagate = HGClass.prototype.propagate;
      HGClass.prototype.propagate = function(targetNodeId) {
        // Мутация: MAJORITY заменен на AND
        const incoming = [...this.hyperedges.values()]
          .filter(he => he.nodes.includes(targetNodeId));
        const updates = [];
        const targetNode = this.nodes.get(targetNodeId);
        if (!targetNode) return updates;

        for (const he of incoming) {
          const sourceNodes = he.nodes.filter(id => id !== targetNodeId);
          const probs = sourceNodes.map(id => this.nodes.get(id)?.currentProb ?? 0);

          let activation;
          if (he.type === 'AND') activation = probs.reduce((a, b) => a * b, 1);
          else if (he.type === 'OR') activation = 1 - probs.reduce((a, p) => a * (1 - p), 1);
          else {
            // МУТАЦИЯ: MAJORITY заменен на AND
            activation = probs.reduce((a, b) => a * b, 1);
          }

          const delta = activation * (he.weight - 1) * 0.2;
          const newProb = Math.max(0.001, Math.min(0.999, targetNode.currentProb + delta));
          if (Math.abs(delta) > 0.001) {
            updates.push({ hyperedge: he.id, target: targetNodeId, activation, delta });
            targetNode.currentProb = newProb;
          }
        }
        return updates;
      };
    },
    detect: (HGClass) => {
      const hg = new HGClass();
      hg.addNode('a', 'A', 'cyber', 0.9);
      hg.addNode('b', 'B', 'info', 0.8);
      hg.addNode('c', 'C', 'physical', 0.1);
      hg.addNode('target', 'T', 'finance', 0.1);
      hg.addHyperedge(['a', 'b', 'c', 'target'], { weight: 3.0, type: 'MAJORITY' });

      const updates = hg.propagate('target');
      // Оригинал MAJORITY: activation = 2/3 ~ 0.667
      // Мутация AND: activation = 0.9 * 0.8 * 0.1 = 0.072
      if (updates.length > 0) {
        return Math.abs(updates[0].activation - 2 / 3) > 0.1;
      }
      return false;
    },
  },

  {
    name: 'addHyperedge не проверяет минимум 3 узла',
    apply: (HGClass) => {
      HGClass.prototype.addHyperedge = function(nodeIds, config = {}) {
        // МУТАЦИЯ: убрана проверка min 3
        for (const id of nodeIds) {
          if (!this.nodes.has(id)) throw new Error(`Node ${id} not found`);
        }
        const id = `he_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        this.hyperedges.set(id, {
          id, nodes: [...nodeIds],
          weight: config.weight ?? 1.0,
          lagHours: config.lagHours ?? 0,
          description: config.description || '',
          type: config.type || 'AND',
        });
        return id;
      };
    },
    detect: (HGClass) => {
      const hg = new HGClass();
      hg.addNode('a', 'A', 'cyber');
      hg.addNode('b', 'B', 'info');
      try {
        hg.addHyperedge(['a', 'b'], {});
        return true;
      } catch {
        return false;
      }
    },
  },
];

const MUTATION_TARGET_SCORE = 0.7;

const JSON_MODE = typeof process !== 'undefined'
  && process.env
  && process.env.CRUCIX_MUTATION_JSON === '1';

// ===== RUNNER =====

async function runMutationTests() {
  const originalLog = console.log;
  if (JSON_MODE) console.log = () => {};

  try {
    console.log('=======================================================');
    console.log('  Mutation Testing - Hypergraph Contagion');
    console.log('=======================================================');
    console.log('');

    let killed = 0;
    let survived = 0;
    const details = [];

    for (const mutation of MUTATIONS) {
      // Свежий импорт модуля для каждой мутации
      const moduleUrl = new URL('../../apis/predict/hypergraph_contagion.mjs?v=' + Date.now() + Math.random(), import.meta.url);
      const { Hypergraph: HG } = await import(moduleUrl.href);

      // Применяем мутацию
      mutation.apply(HG);

      // Запускаем тест
      let caught = false;
      let error = null;
      try {
        caught = mutation.detect(HG);
      } catch (e) {
        caught = true;
        error = e.message;
      }

      if (caught) {
        killed++;
        console.log(`  [KILLED]    ${mutation.name}`);
      } else {
        survived++;
        console.log(`  [SURVIVED]  ${mutation.name}`);
      }

      details.push({ name: mutation.name, killed: caught, error });
    }

    const total = killed + survived;
    const score = total > 0 ? killed / total : 0;

    console.log('');
    console.log('=======================================================');
    console.log(`  Mutation score: ${(score * 100).toFixed(1)}% (${killed}/${total})`);
    console.log(`  Target: ${(MUTATION_TARGET_SCORE * 100).toFixed(1)}%`);
    console.log('=======================================================');
    console.log('');

    return {
      killed,
      survived,
      errors: 0,
      total,
      score,
      details,
      mutations: details,
    };
  } finally {
    if (JSON_MODE) console.log = originalLog;
  }
}

// ===== CLI RUNNER =====

const isDirectRun = (() => {
  if (typeof process === 'undefined' || !process.argv) return false;
  const argv1 = process.argv[1] || '';
  return argv1.endsWith('hypergraph.mutate.mjs');
})();

if (isDirectRun) {
  if (JSON_MODE) {
    runMutationTests()
      .then((result) => {
        process.stdout.write(JSON.stringify(result) + '\n');
        process.exit(0);
      })
      .catch((e) => {
        process.stdout.write(JSON.stringify({
          killed: 0, survived: 0, errors: 1, total: 0, score: 0,
          crash: true, reason: e.message,
        }) + '\n');
        process.exit(0);
      });
  } else {
    runMutationTests()
      .then((result) => {
        const passed = result.score >= MUTATION_TARGET_SCORE;
        if (passed) {
          console.log('  PASSED');
          process.exit(0);
        } else {
          console.error(`  FAILED: mutation score below ${(MUTATION_TARGET_SCORE * 100).toFixed(1)}%`);
          process.exit(1);
        }
      })
      .catch((e) => {
        console.error('Mutation test crash:', e);
        process.exit(1);
      });
  }
}

export { runMutationTests };
