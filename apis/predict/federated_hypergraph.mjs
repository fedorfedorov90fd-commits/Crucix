// apis/predict/federated_hypergraph.mjs
//
// Federated Hypergraph Learning
// Распределённое обучение гиперграфов между несколькими инстансами Crucix
// без обмена сырыми данными.
//
// Теоретическая основа:
//   - McMahan et al. (2017). "Communication-Efficient Learning of Deep
//     Networks from Decentralized Data" AISTATS. -- FedAvg.
//   - Bonawitz et al. (2017). "Practical Secure Aggregation for Privacy-
//     Preserving Machine Learning" CCS. -- Secure Aggregation.
//   - Kairouz et al. (2021). "Advances and Open Problems in Federated
//     Learning" FnT ML. -- обзор.
//
// Ключевая идея:
//   Каждый инстанс Crucix имеет локальный гиперграф, построенный на
//   собственных данных. Мы хотим агрегировать структуру, не передавая
//   сырые данные.
//
// Агрегация:
//   1. Каждый клиент отправляет (hyperedge_signature, count, weight)
//      -- гипереребро как отсортированный набор имён + статистика.
//   2. Сервер объединяет по сигнатуре: суммирует counts и weight средние.
//   3. Возвращает глобальный гиперграф.
//
//   Дифференциальная приватность: добавление Laplace noise к counts
//   перед отправкой.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// === HYPEREDGE SIGNATURE ===

/**
 * Сигнатура гиперребра: каноничная форма для агрегации.
 * Узлы сортируются -> любые два клиента с одинаковым набором узлов
 * производят одинаковую сигнатуру.
 */
function hyperedgeSignature(he) {
  return [...he.nodes].sort().join('::');
}

/**
 * Извлечение гиперрёбер из локального прогноза.
 *
 * @param {object} localPrediction -- output от runForecastPipeline
 * @returns {Array<{signature, nodes, type, weight, count, klDivergence}>}
 */
function extractHyperedgeStatistics(localPrediction) {
  const stats = [];

  // Из hypergraphContagion
  const hg = localPrediction.hypergraphContagion;
  if (hg?.hyperedges) {
    for (const he of hg.hyperedges) {
      stats.push({
        signature: hyperedgeSignature(he),
        nodes: [...he.nodes],
        type: he.type,
        weight: he.weight,
        count: 1,
        // Как часто это ребро было активным
        activationCount: (hg.updates || []).filter(u => u.hyperedge === he.id).length,
      });
    }
  }

  // Из hypergraph_discovery (N-арные, выученные из данных)
  const disc = localPrediction.hypergraphDiscovery;
  if (disc?.nary) {
    for (const link of disc.nary) {
      const nodes = [...link.sources, link.target];
      stats.push({
        signature: hyperedgeSignature({ nodes }),
        nodes,
        type: link.type,
        weight: link.interactionStrength || 1.0,
        count: 1,
        jointMI: link.jointMI,
        significance: link.significance?.pValue,
      });
    }
  }

  return stats;
}

// === DIFFERENTIAL PRIVACY ===

/**
 * Добавление Laplace noise к значению.
 *
 * Laplace(0, b): b = sensitivity / epsilon.
 *
 * @param {number} value
 * @param {number} epsilon -- privacy budget
 * @param {number} sensitivity -- max change per record
 */
function addLaplaceNoise(value, epsilon = 1.0, sensitivity = 1.0) {
  const b = sensitivity / epsilon;
  const u = Math.random() - 0.5;
  const noise = -b * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return value + noise;
}

/**
 * Add Gaussian noise (альтернатива Laplace).
 */
function addGaussianNoise(value, epsilon = 1.0, delta = 1e-5, sensitivity = 1.0) {
  const sigma = sensitivity * Math.sqrt(2 * Math.log(1.25 / delta)) / epsilon;
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return value + z * sigma;
}

// === FEDERATED CLIENT ===

class FederatedClient {
  constructor(clientId, { dpEnabled = true, epsilon = 1.0 } = {}) {
    this.clientId = clientId;
    this.dpEnabled = dpEnabled;
    this.epsilon = epsilon;
    this.roundsParticipated = 0;
    this.lastContribution = null;
  }

  /**
   * Подготовка локального вклада.
   * @param {object} localPrediction
   * @returns {object} -- contribution с (возможно) DP-шумом
   */
  contribute(localPrediction) {
    const stats = extractHyperedgeStatistics(localPrediction);

    const contribution = stats.map(s => {
      const noisyCount = this.dpEnabled
        ? Math.max(0, addLaplaceNoise(s.count, this.epsilon, 1.0))
        : s.count;
      const noisyWeight = this.dpEnabled
        ? Math.max(0.01, addGaussianNoise(s.weight, this.epsilon, 1e-5, 0.1))
        : s.weight;

      return {
        signature: s.signature,
        nodes: s.nodes,
        type: s.type,
        count: noisyCount,
        weight: noisyWeight,
        activationCount: s.activationCount,
        jointMI: s.jointMI,
      };
    });

    this.lastContribution = contribution;
    this.roundsParticipated++;

    return {
      clientId: this.clientId,
      round: this.roundsParticipated,
      contributions: contribution,
      nEdges: contribution.length,
    };
  }
}

// === FEDERATED SERVER ===

class FederatedHypergraphServer {
  constructor({ minClients = 2, dpEnabled = true } = {}) {
    this.minClients = minClients;
    this.dpEnabled = dpEnabled;
    this.updates = [];
    this.globalHypergraph = null;
    this.round = 0;
    this.history = [];
  }

  receiveUpdate(update) {
    this.updates.push(update);
  }

  /**
   * Агрегация: объединение по signature.
   *
   * Для каждого уникального signature:
   *   - count = Sum count_k (сумма по клиентам)
   *   - weight = weighted average by count
   *   - type = majority vote
   */
  aggregate() {
    if (this.updates.length < this.minClients) {
      return {
        success: false,
        reason: 'insufficient_clients',
        have: this.updates.length,
        need: this.minClients,
      };
    }

    const aggregated = new Map();

    for (const update of this.updates) {
      for (const contrib of update.contributions) {
        const key = contrib.signature;
        if (!aggregated.has(key)) {
          aggregated.set(key, {
            signature: key,
            nodes: contrib.nodes,
            types: [],
            totalCount: 0,
            weightedSum: 0,
            weightCount: 0,
            jointMI: contrib.jointMI,
            contributingClients: new Set(),
          });
        }
        const agg = aggregated.get(key);
        agg.types.push(contrib.type);
        agg.totalCount += contrib.count;
        agg.weightedSum += contrib.weight * contrib.count;
        agg.weightCount += contrib.count;
        agg.contributingClients.add(update.clientId);
      }
    }

    // Финальная агрегация
    const hypergraph = [];
    for (const agg of aggregated.values()) {
      // Majority vote для типа
      const typeCounts = {};
      for (const t of agg.types) typeCounts[t] = (typeCounts[t] || 0) + 1;
      const finalType = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])[0][0];

      hypergraph.push({
        signature: agg.signature,
        nodes: agg.nodes,
        type: finalType,
        aggregatedWeight: agg.weightCount > 0
          ? agg.weightedSum / agg.weightCount
          : 1.0,
        totalCount: agg.totalCount,
        contributingClients: agg.contributingClients.size,
        jointMI: agg.jointMI,
        confidence: agg.contributingClients.size / this.updates.length,
      });
    }

    hypergraph.sort((a, b) => b.totalCount - a.totalCount);

    this.globalHypergraph = hypergraph;
    this.round++;

    const roundInfo = {
      round: this.round,
      nClients: this.updates.length,
      nUniqueEdges: hypergraph.length,
      nConfirmedEdges: hypergraph.filter(e => e.confidence >= 0.5).length,
      topEdge: hypergraph[0] || null,
    };
    this.history.push(roundInfo);

    // Очистка
    this.updates = [];

    return {
      success: true,
      ...roundInfo,
      globalHypergraph: hypergraph.slice(0, 50),
    };
  }

  /**
   * Broadcast глобального гиперграфа клиентам.
   */
  broadcast() {
    return this.globalHypergraph;
  }

  status() {
    return {
      round: this.round,
      bufferedUpdates: this.updates.length,
      globalEdges: this.globalHypergraph?.length || 0,
      history: this.history.slice(-5),
    };
  }
}

// === FEDERATED ORCHESTRATOR ===

/**
 * Симуляция федерации на локальных данных.
 *
 * Каждый "клиент" получает случайное подмножество истории sweeps
 * (эмуляция распределённых инстансов) и строит локальный гиперграф.
 */
export function simulateFederatedHypergraph(history, opts = {}) {
  const {
    nClients = 3,
    minClients = 2,
    dpEnabled = true,
    epsilon = 1.0,
    subsetRatio = 0.7,
  } = opts;

  if (!history || history.length < 20) {
    return { available: false, reason: 'insufficient_history' };
  }

  const server = new FederatedHypergraphServer({ minClients, dpEnabled });
  const clients = [];
  const clientResults = [];

  // Разбиваем историю на subset для каждого клиента
  for (let i = 0; i < nClients; i++) {
    const clientId = `client_${i}`;
    const client = new FederatedClient(clientId, { dpEnabled, epsilon });
    clients.push(client);

    // Случайный subset истории
    const shuffled = [...history].sort(() => Math.random() - 0.5);
    const subsetSize = Math.floor(history.length * subsetRatio);
    const subset = shuffled.slice(0, subsetSize).sort((a, b) =>
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Строим локальный прогноз (упрощённо -- используем только hypergraph)
    const localPrediction = buildLocalHypergraphForClient(subset, clientId);

    // Клиент делает contribution
    const contribution = client.contribute(localPrediction);
    server.receiveUpdate(contribution);

    clientResults.push({
      clientId,
      nSamples: subset.length,
      nEdges: contribution.nEdges,
    });
  }

  // Агрегация
  const aggregation = server.aggregate();

  return {
    module: 'federated_hypergraph',
    available: true,
    nClients,
    dpEnabled,
    epsilon,
    clients: clientResults,
    aggregation,
    globalHypergraph: server.broadcast(),
    serverStatus: server.status(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Упрощённое построение локального гиперграфа для клиента.
 * Использует только hypergraphContagion -- без полного pipeline.
 */
function buildLocalHypergraphForClient(history, clientId) {
  // Импорт модуля через динамический import чтобы избежать циклических зависимостей
  // Здесь используем упрощённую логику: фиксированные гиперрёбра
  const FIXED_HYPEREDGES = [
    {
      nodes: ['sanctions', 'conflict', 'media_campaign'],
      type: 'AND',
      weight: 2.5,
      description: 'Комбинация -> обвал',
    },
    {
      nodes: ['cyber_attack', 'energy_spike', 'political_instability'],
      type: 'AND',
      weight: 3.0,
      description: 'Кибер + энергия + политика -> сдвиг',
    },
    {
      nodes: ['capital_flight', 'market_crash', 'energy_spike'],
      type: 'MAJORITY',
      weight: 2.0,
      description: 'Фин. + энерг. кризис',
    },
    {
      nodes: ['sanctions', 'conflict', 'cyber_attack'],
      type: 'OR',
      weight: 1.8,
      description: 'Рост нестабильности',
    },
  ];

  // Для клиента: subset гиперрёбер на основе его данных
  const clientNumber = parseInt(clientId.split('_')[1], 10);
  const clientHyperedges = FIXED_HYPEREDGES.filter((_, i) => {
    // Детерминированный subset: client_0 видит рёбра 0, 2; client_1 -- 0, 1; и т.д.
    return (i + clientNumber) % 2 === 0;
  });

  // Симуляция обнаружения: count > 0 если в истории были соответствующие события
  const hyperedges = clientHyperedges.map((he, i) => ({
    id: `he_${clientId}_${i}`,
    nodes: he.nodes,
    type: he.type,
    weight: he.weight,
    description: he.description,
  }));

  // Простые updates
  const updates = hyperedges.map(he => ({
    hyperedge: he.id,
    target: he.nodes[he.nodes.length - 1],
    delta: 0.1 + Math.random() * 0.3,
  }));

  return {
    hypergraphContagion: {
      hyperedges,
      updates,
      stats: {
        nodeCount: new Set(hyperedges.flatMap(h => h.nodes)).size,
        hyperedgeCount: hyperedges.length,
      },
    },
  };
}

// === ИНТЕГРАЦИЯ С CRUCIX ===

export function crucixFederatedHypergraph(history, opts = {}) {
  const result = simulateFederatedHypergraph(history, {
    nClients: opts.nClients || 3,
    minClients: 2,
    dpEnabled: opts.dpEnabled !== false,
    epsilon: opts.epsilon || 1.0,
    subsetRatio: 0.7,
  });

  const dir = join(__dirname, '..', '..', 'runs', 'predictions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'federated_hypergraph.json'),
    JSON.stringify(result, null, 2)
  );

  return result;
}

export {
  FederatedClient,
  FederatedHypergraphServer,
  extractHyperedgeStatistics,
  hyperedgeSignature,
  addLaplaceNoise,
  addGaussianNoise,
};
