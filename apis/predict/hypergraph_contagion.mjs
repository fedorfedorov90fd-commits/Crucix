// apis/predict/hypergraph_contagion.mjs
// Cross-Domain Contagion via Hypergraph
// Гиперрёбра связывают 3+ узла одновременно.
// Позволяет моделировать тройные и N-арные причинные связи.
//
// Теоретическая основа:
//   - Berge (1989). "Hypergraphs: Combinatorics of Finite Sets".
//   - Ouvrard et al. (2017). "Hypergraph-based modeling".
//
// Ключевая идея:
//   Стандартный граф имеет только парные рёбра (A → B). Реальность часто
//   требует N-арных связей: обвал происходит, когда ОДНОВРЕМЕННО присутствуют
//   санкции, конфликт и медиа-кампания. Это AND-гиперребро.
//
//   Три типа гиперрёбер:
//     AND      — все узлы должны быть активны (конъюнкция)
//     OR       — хотя бы один узел активен (дизъюнкция)
//     MAJORITY — большинство узлов активны
//
// Контракт Тип B (внутренний модуль apis/predict/*):
//   - export const meta (id, name, layer, category, description, version, depends, exports)
//   - export class Name
//   - export function name
//   Никаких route / methods / handler.
//   Только ESM, никаких require.
//   Портабельность — через fileURLToPath(import.meta.url).

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const meta = {
  id: 'hypergraph_contagion',
  name: 'Cross-Domain Contagion via Hypergraph',
  layer: 8,
  category: 'causal',
  description: 'Гиперграф с N-арными причинными связями (AND/OR/MAJORITY). Моделирует кросс-слойную контагию между кибер-, информационным, финансовым и физическим слоями.',
  version: '2.0.0',
  depends: [],
  exports: ['Hypergraph', 'buildCrucixHypergraph', 'crucixHypergraphContagion'],
};

// ─── ГИПЕРГРАФ ─────────────────────────────────────

export class Hypergraph {
  constructor() {
    this.nodes = new Map();       // id → { id, name, layer, currentProb, baseProb }
    this.hyperedges = new Map();  // id → { id, nodes: [id1, id2, id3], weight, lagHours, description, type }
  }

  addNode(id, name, layer, baseProb = 0.5) {
    this.nodes.set(id, { id, name, layer, currentProb: baseProb, baseProb });
    return this;
  }

  /**
   * Гиперребро: связывает 3+ узлов
   * @param {string[]} nodeIds — минимум 3 узла
   * @param {Object} config — { weight, lagHours, description, type: 'AND'|'OR'|'MAJORITY' }
   */
  addHyperedge(nodeIds, config = {}) {
    if (nodeIds.length < 3) {
      throw new Error(`Hyperedge requires at least 3 nodes, got ${nodeIds.length}`);
    }
    for (const id of nodeIds) {
      if (!this.nodes.has(id)) throw new Error(`Node ${id} not found`);
    }

    const id = `he_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.hyperedges.set(id, {
      id,
      nodes: [...nodeIds],
      weight: config.weight ?? 1.0,
      lagHours: config.lagHours ?? 0,
      description: config.description || '',
      type: config.type || 'AND',  // AND = все условия, OR = любое
    });
    return id;
  }

  /**
   * Активация гиперребра: если все узлы (или большинство) активны — целевой узел получает усиление
   * @param {string} targetNodeId — узел, который получает обновление
   */
  propagate(targetNodeId) {
    const incoming = [...this.hyperedges.values()]
      .filter(he => he.nodes.includes(targetNodeId));

    const updates = [];
    const targetNode = this.nodes.get(targetNodeId);
    if (!targetNode) return updates;

    for (const he of incoming) {
      const sourceNodes = he.nodes.filter(id => id !== targetNodeId);
      const probs = sourceNodes.map(id => this.nodes.get(id)?.currentProb ?? 0);

      let activation = 0;
      if (he.type === 'AND') {
        // Все узлы должны быть активны
        activation = probs.reduce((prod, p) => prod * p, 1);
      } else if (he.type === 'OR') {
        // Хотя бы один
        activation = 1 - probs.reduce((prod, p) => prod * (1 - p), 1);
      } else if (he.type === 'MAJORITY') {
        // Большинство
        activation = probs.filter(p => p > 0.5).length / probs.length;
      }

      // Обновление целевого узла
      const delta = activation * (he.weight - 1) * 0.2;
      const newProb = Math.max(0.001, Math.min(0.999, targetNode.currentProb + delta));

      if (Math.abs(delta) > 0.001) {
        updates.push({
          hyperedge: he.id,
          target: targetNodeId,
          sources: sourceNodes,
          activation,
          delta,
          newProb,
          type: he.type,
          description: he.description,
        });
        targetNode.currentProb = newProb;
      }
    }

    return updates;
  }

  /**
   * Полное распространение: N итераций
   */
  propagateAll(maxDepth = 3) {
    const allUpdates = [];
    let frontier = [...this.nodes.keys()];

    for (let depth = 0; depth < maxDepth; depth++) {
      const nextFrontier = new Set();
      for (const nodeId of frontier) {
        const updates = this.propagate(nodeId);
        allUpdates.push(...updates);
        for (const u of updates) {
          for (const src of u.sources) nextFrontier.add(src);
        }
      }
      frontier = [...nextFrontier];
      if (frontier.length === 0) break;
    }

    return allUpdates;
  }

  toJSON() {
    return {
      nodes: [...this.nodes.values()],
      hyperedges: [...this.hyperedges.values()],
      stats: {
        nodeCount: this.nodes.size,
        hyperedgeCount: this.hyperedges.size,
        avgHyperedgeSize: this.hyperedges.size > 0
          ? [...this.hyperedges.values()].reduce((s, he) => s + he.nodes.length, 0) / this.hyperedges.size
          : 0,
      },
    };
  }
}

// ─── CONFIG ────────────────────────────────────────

function buildCrucixHypergraph() {
  const hg = new Hypergraph();

  // Узлы (4 слоя)
  hg.addNode('sanctions', 'Санкции', 'finance', 0.3);
  hg.addNode('conflict', 'Конфликт', 'physical', 0.3);
  hg.addNode('media_campaign', 'Медиа-кампания', 'info', 0.3);
  hg.addNode('capital_flight', 'Отток капитала', 'finance', 0.2);
  hg.addNode('market_crash', 'Обвал рынка', 'finance', 0.15);
  hg.addNode('cyber_attack', 'Кибератака', 'cyber', 0.2);
  hg.addNode('energy_spike', 'Энергетический шок', 'physical', 0.2);
  hg.addNode('political_instability', 'Политическая нестабильность', 'info', 0.2);
  hg.addNode('regime_change', 'Смена режима', 'physical', 0.1);

  // Гиперрёбра (тройные связи)
  // 1. Санкции + конфликт + медиа-кампания → обвал рынка
  hg.addHyperedge(['sanctions', 'conflict', 'media_campaign'], {
    weight: 2.5, lagHours: 72, type: 'AND',
    description: 'Комбинация санкций, конфликта и медиа-давления → обвал',
  });

  // 2. Кибератака + энергетический шок + политическая нестабильность → смена режима
  hg.addHyperedge(['cyber_attack', 'energy_spike', 'political_instability'], {
    weight: 3.0, lagHours: 168, type: 'AND',
    description: 'Кибер + энергия + политика → системный сдвиг',
  });

  // 3. Отток капитала + обвал + энергетический шок → смена режима (MAJORITY)
  hg.addHyperedge(['capital_flight', 'market_crash', 'energy_spike'], {
    weight: 2.0, lagHours: 48, type: 'MAJORITY',
    description: 'Финансовый + энергетический кризис → смена режима',
  });

  // 4. OR-гиперребро: любой из сигналов → политическая нестабильность
  hg.addHyperedge(['sanctions', 'conflict', 'cyber_attack'], {
    weight: 1.8, lagHours: 24, type: 'OR',
    description: 'Любой из сигналов → рост нестабильности',
  });

  return hg;
}

// ─── ИНТЕГРАЦИЯ С CRUCIX ───────────────────────────

export function crucixHypergraphContagion(latest, history) {
  const hg = buildCrucixHypergraph();

  // Обновление из текущих данных
  if (latest.sanctions?.count > 3) hg.nodes.get('sanctions').currentProb = Math.min(0.9, latest.sanctions.count / 15);
  if (latest.gdelt?.conflictEvents?.length > 8) hg.nodes.get('conflict').currentProb = Math.min(0.9, latest.gdelt.conflictEvents.length / 20);
  if (latest.fred?.vix > 25) hg.nodes.get('market_crash').currentProb = Math.min(0.8, (latest.fred.vix - 20) / 25);
  if (latest.delta?.escalatedAlerts > 2) hg.nodes.get('political_instability').currentProb = Math.min(0.9, latest.delta.escalatedAlerts / 8);

  // Распространение
  const updates = hg.propagateAll(3);

  return {
    module: 'hypergraph_contagion',
    stats: hg.toJSON().stats,
    hyperedges: hg.toJSON().hyperedges,
    updates,
    criticalHyperedges: updates.filter(u => u.delta > 0.1),
    timestamp: new Date().toISOString(),
  };
}

export { buildCrucixHypergraph };
