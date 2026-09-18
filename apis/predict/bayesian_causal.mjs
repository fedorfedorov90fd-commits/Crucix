// apis/predict/bayesian_causal.mjs
//
// Bayesian Causal Discovery
// Байесовский вывод структуры DAG через MCMC по пространству графов.
//
// Теоретическая основа:
//   - Heckerman, Geiger, Chickering (1995). "Learning Bayesian Networks:
//     The Combination of Knowledge and Statistical Data" Machine Learning.
//     -- Bayesian score (BDeu).
//   - Friedman & Koller (2003). "Being Bayesian About Network Structure"
//     Machine Learning. -- MCMC над DAG.
//   - Madigan & York (1995). "Bayesian Graphical Models for Discrete Data"
//     International Statistical Review. -- MCMC по графам.
//
// Ключевая идея:
//   Constraint-based методы (PC) дают точечную оценку DAG.
//   Bayesian approach даёт РАСПРЕДЕЛЕНИЕ по графам:
//   P(G | D) пропорционально P(D | G) * P(G)
//
//   Мы используем:
//   1. Bayesian Dirichlet equivalent uniform (BDeu) score:
//      P(D | G) = Product_i Product_parents Product_values
//                 (Gamma(alpha_ij) / Gamma(alpha_ij + N_ij)) *
//                 Product_k (Gamma(alpha_ijk + N_ijk) / Gamma(alpha_ijk))
//   2. MCMC по структуре: MH с операциями
//      (add edge, delete edge, reverse edge)
//   3. Posterior probabilities рёбер: P(A -> B | D)
//   4. Markov blanket based inference

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// === SCORING: BDEu ===

/**
 * Log Gamma function (Lanczos).
 */
function logGamma(z) {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Дискретизация с квантилями.
 */
function discretize(values, nBins = 3) {
  const valid = values.filter(v => !isNaN(v) && isFinite(v));
  if (valid.length === 0) return values.map(() => 0);
  const sorted = [...valid].sort((a, b) => a - b);
  const quantiles = [];
  for (let i = 1; i < nBins; i++) {
    quantiles.push(sorted[Math.floor(sorted.length * i / nBins)]);
  }
  return values.map(v => {
    if (isNaN(v) || !isFinite(v)) return 0;
    for (let i = 0; i < quantiles.length; i++) {
      if (v <= quantiles[i]) return i;
    }
    return nBins - 1;
  });
}

/**
 * BDeu (Bayesian Dirichlet equivalent uniform) score.
 *
 * P(D | G) = Product_i Product_pi_i [ Gamma(alpha_ij) / Gamma(alpha_ij + N_ij) ] *
 *            Product_k [ Gamma(alpha_ijk + N_ijk) / Gamma(alpha_ijk) ]
 *
 * где:
 *   i -- индекс переменной
 *   pi_i -- конфигурация родителей
 *   k -- значение переменной
 *   alpha_ijk = alpha / (r_i * q_i) -- equivalent sample size
 *   N_ijk -- наблюдаемые частоты
 *
 * @param {number} n -- число наблюдений
 * @param {Array} data -- дискретизированные ряды
 * @param {object} parents -- { nodeId: [parentIds] }
 * @param {number} nBins -- число бинов на переменную
 * @param {number} ess -- equivalent sample size (default: 10)
 */
function bdeuScore(data, parents, nBins, ess = 10) {
  let logScore = 0;

  for (const [nodeId, parentIds] of Object.entries(parents)) {
    const nodeData = data[nodeId];
    if (!nodeData) continue;

    const r_i = nBins;
    const q_i = Math.pow(nBins, parentIds.length);
    const alpha_ij = ess / q_i;
    const alpha_ijk = alpha_ij / r_i;

    // Собираем counts: N_ijk для каждой конфигурации родителей
    const parentConfigs = new Map();

    for (let t = 0; t < nodeData.length; t++) {
      const parentValues = parentIds.map(pid => data[pid]?.[t] ?? 0);
      const config = parentValues.join(',');
      const nodeValue = nodeData[t];

      if (!parentConfigs.has(config)) {
        parentConfigs.set(config, new Array(r_i).fill(0));
      }
      parentConfigs.get(config)[nodeValue]++;
    }

    for (const [_, counts] of parentConfigs) {
      const N_ij = counts.reduce((a, b) => a + b, 0);
      // Gamma(alpha_ij) / Gamma(alpha_ij + N_ij)
      logScore += logGamma(alpha_ij) - logGamma(alpha_ij + N_ij);

      for (let k = 0; k < r_i; k++) {
        const N_ijk = counts[k];
        // Gamma(alpha_ijk + N_ijk) / Gamma(alpha_ijk)
        logScore += logGamma(alpha_ijk + N_ijk) - logGamma(alpha_ijk);
      }
    }
  }

  return logScore;
}

// === DAG STRUCTURE ===

/**
 * Проверка создания цикла.
 */
function createsCycle(adjacency, from, to) {
  // Проверяем, есть ли путь to -> from
  const visited = new Set();
  const queue = [to];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === from) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const child of adjacency[node] || []) {
      queue.push(child);
    }
  }
  return false;
}

/**
 * Создание пустого DAG.
 */
function emptyDAG(nodeIds) {
  const adj = {};
  const parents = {};
  for (const id of nodeIds) {
    adj[id] = [];
    parents[id] = [];
  }
  return { adjacency: adj, parents };
}

/**
 * Операции над DAG.
 */
const OPERATIONS = {
  addEdge(dag, from, to) {
    if (from === to) return null;
    if (dag.parents[to].includes(from)) return null;
    if (createsCycle(dag.adjacency, from, to)) return null;

    const newAdj = {};
    const newParents = {};
    for (const k of Object.keys(dag.adjacency)) {
      newAdj[k] = [...dag.adjacency[k]];
      newParents[k] = [...dag.parents[k]];
    }
    newAdj[from].push(to);
    newParents[to].push(from);
    return { adjacency: newAdj, parents: newParents };
  },

  deleteEdge(dag, from, to) {
    if (!dag.parents[to].includes(from)) return null;

    const newAdj = {};
    const newParents = {};
    for (const k of Object.keys(dag.adjacency)) {
      newAdj[k] = [...dag.adjacency[k]];
      newParents[k] = [...dag.parents[k]];
    }
    newAdj[from] = newAdj[from].filter(x => x !== to);
    newParents[to] = newParents[to].filter(x => x !== from);
    return { adjacency: newAdj, parents: newParents };
  },

  reverseEdge(dag, from, to) {
    if (!dag.parents[to].includes(from)) return null;
    const without = OPERATIONS.deleteEdge(dag, from, to);
    if (!without) return null;
    return OPERATIONS.addEdge(without, to, from);
  },
};

// === MCMC ПО СТРУКТУРЕ ===

/**
 * MCMC (Metropolis-Hastings) по пространству DAG.
 *
 * Предложение: случайный выбор операции (add/delete/reverse)
 * и случайный выбор пары (from, to).
 * Принятие: min(1, exp(score(new) - score(old))).
 *
 * Возвращает выборку из P(G | D).
 *
 * @param {Array} data -- { nodeId: [discretized values] }
 * @param {number} nIterations
 * @param {number} burnIn
 * @param {number} thin
 * @param {number} ess
 */
function mcmcDAGStructure(data, opts = {}) {
  const {
    nIterations = 5000,
    burnIn = 1000,
    thin = 5,
    ess = 10,
    nBins = 3,
  } = opts;

  const nodeIds = Object.keys(data);
  let currentDag = emptyDAG(nodeIds);
  let currentScore = bdeuScore(data, currentDag.parents, nBins, ess);

  const samples = [];
  const scores = [];
  let accepted = 0;
  let total = 0;

  for (let iter = 0; iter < nIterations; iter++) {
    // Выбор операции
    const opKeys = Object.keys(OPERATIONS);
    const op = opKeys[Math.floor(Math.random() * opKeys.length)];

    // Случайные from, to
    const from = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    let to = nodeIds[Math.floor(Math.random() * nodeIds.length)];
    while (to === from) to = nodeIds[Math.floor(Math.random() * nodeIds.length)];

    const proposal = OPERATIONS[op](currentDag, from, to);

    if (proposal) {
      const proposalScore = bdeuScore(data, proposal.parents, nBins, ess);
      const logAlpha = proposalScore - currentScore;

      if (logAlpha > 0 || Math.random() < Math.exp(logAlpha)) {
        currentDag = proposal;
        currentScore = proposalScore;
        if (iter >= burnIn) accepted++;
      }
    }

    if (iter >= burnIn) {
      total++;
      if ((iter - burnIn) % thin === 0) {
        samples.push(JSON.parse(JSON.stringify(currentDag)));
        scores.push(currentScore);
      }
    }
  }

  // Posterior edge probabilities
  const edgeCounts = new Map();
  for (const dag of samples) {
    for (const from of nodeIds) {
      for (const to of dag.adjacency[from]) {
        const key = `${from}->${to}`;
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
      }
    }
  }

  const posteriorEdgeProbs = [];
  for (const [key, count] of edgeCounts) {
    const [from, to] = key.split('->');
    posteriorEdgeProbs.push({
      from,
      to,
      probability: count / samples.length,
    });
  }
  posteriorEdgeProbs.sort((a, b) => b.probability - a.probability);

  // MAP граф
  const mapDag = samples.reduce((best, dag) => {
    const s = bdeuScore(data, dag.parents, nBins, ess);
    return s > best.score ? { dag, score: s } : best;
  }, { dag: currentDag, score: -Infinity });

  return {
    samples: samples.length,
    acceptanceRate: total > 0 ? accepted / total : 0,
    posteriorEdgeProbs,
    mapDag: {
      adjacency: mapDag.dag.adjacency,
      parents: mapDag.dag.parents,
      score: mapDag.score,
    },
    scoreHistory: scores.slice(-50),
  };
}

// === MARKOV BLANKET INFERENCE ===

/**
 * Markov blanket узла: родители + дети + родители детей.
 * В байесовском DAG это минимальное множество, делающее узел
 * условно независимым от всех остальных.
 */
function markovBlanket(dag, nodeId) {
  const blanket = new Set();
  // Родители
  for (const p of dag.parents[nodeId]) blanket.add(p);
  // Дети + родители детей
  for (const c of dag.adjacency[nodeId]) {
    blanket.add(c);
    for (const pc of dag.parents[c]) {
      if (pc !== nodeId) blanket.add(pc);
    }
  }
  return [...blanket];
}

// === ИНТЕГРАЦИЯ С CRUCIX ===

/**
 * Извлечение дискретных переменных из истории.
 */
function extractDiscreteVariables(history, nBins = 3) {
  if (!history || history.length < 20) return null;

  const series = {
    vix: history.map(h => h.fred?.vix).filter(v => v !== undefined && !isNaN(v)),
    hySpread: history.map(h => h.fred?.hySpread).filter(v => v !== undefined && !isNaN(v)),
    conflictCount: history.map(h => h.gdelt?.conflictEvents?.length || 0),
    sanctionsCount: history.map(h => h.sanctions?.count || 0),
    newAlerts: history.map(h => h.delta?.newAlerts || 0),
    escalatedAlerts: history.map(h => h.delta?.escalatedAlerts || 0),
  };

  const minLen = Math.min(...Object.values(series).map(a => a.length));
  const aligned = {};
  for (const [k, v] of Object.entries(series)) {
    aligned[k] = v.slice(-minLen);
  }

  const discrete = {};
  for (const [k, v] of Object.entries(aligned)) {
    discrete[k] = discretize(v, nBins);
  }

  return discrete;
}

export function crucixBayesianCausalDiscovery(history, opts = {}) {
  const {
    nIterations = 3000,
    burnIn = 500,
    nBins = 3,
    ess = 10,
  } = opts;

  if (!history || history.length < 30) {
    return {
      module: 'bayesian_causal',
      available: false,
      reason: 'insufficient_history',
    };
  }

  const data = extractDiscreteVariables(history, nBins);
  if (!data) return { module: 'bayesian_causal', available: false };

  console.log(`[bayesian-causal] MCMC over DAG space (${nIterations} iterations)`);

  const startTime = Date.now();
  const result = mcmcDAGStructure(data, { nIterations, burnIn, thin: 5, ess, nBins });
  const elapsed = Date.now() - startTime;

  // Обогащаем: для каждого узла -- Markov blanket из MAP
  const blankets = {};
  for (const nodeId of Object.keys(data)) {
    blankets[nodeId] = markovBlanket(result.mapDag, nodeId);
  }

  const enriched = {
    module: 'bayesian_causal',
    available: true,
    elapsedMs: elapsed,
    nVariables: Object.keys(data).length,
    nObservations: Object.values(data)[0].length,
    nBins,
    ess,

    // Posterior probabilities: top-20 рёбер
    edgeProbabilities: result.posteriorEdgeProbs.slice(0, 20).map(e => ({
      ...e,
      confidence: e.probability > 0.7 ? 'high'
        : e.probability > 0.4 ? 'medium' : 'low',
    })),

    // Значимые рёбра (P > 0.5)
    significantEdges: result.posteriorEdgeProbs
      .filter(e => e.probability > 0.5)
      .map(e => ({
        from: e.from,
        to: e.to,
        probability: e.probability,
      })),

    // MAP DAG
    mapDag: {
      edges: Object.entries(result.mapDag.adjacency).flatMap(([from, tos]) =>
        tos.map(to => ({ from, to }))
      ),
      score: result.mapDag.score,
    },

    // Markov blankets
    markovBlankets: blankets,

    // Диагностика
    diagnostics: {
      samples: result.samples,
      acceptanceRate: result.acceptanceRate,
      converged: result.acceptanceRate > 0.15 && result.acceptanceRate < 0.6,
    },

    timestamp: new Date().toISOString(),
  };

  // Сохранение
  const dir = join(__dirname, '..', '..', 'runs', 'predictions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'bayesian_causal.json'),
    JSON.stringify(enriched, null, 2)
  );

  return enriched;
}

export {
  bdeuScore,
  mcmcDAGStructure,
  markovBlanket,
  discretize,
  logGamma,
  createsCycle,
  OPERATIONS,
};
