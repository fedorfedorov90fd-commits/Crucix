// apis/predict/models/bayesnet.mjs
// Bayesian Networks — Pearl (1988) Probabilistic Reasoning in Intelligent Systems
//
// Дискретные байесовские сети: DAG + conditional probability tables.
// Три режима inference: exact enumeration, forward sampling, likelihood weighting.
// Обучение: MLE с Laplace smoothing + байесовское (Dirichlet prior).
// Метрика: DIC (Spiegelhalter et al. 2002) для сравнения сетей.
//
// Теоретическая основа:
//   - Pearl, J. (1988). "Probabilistic Reasoning in Intelligent Systems:
//     Networks of Plausible Inference". Morgan Kaufmann.
//   - Lauritzen, S. L., & Spiegelhalter, D. J. (1988). "Local Computations
//     with Probabilities on Graphical Structures and Their Application to
//     Expert Systems". JRSS B.
//   - Heckerman, D. (1998). "A Tutorial on Learning with Bayesian Networks".
//     NATO ASI Series.
//   - Spiegelhalter, D. J., et al. (2002). "Bayesian measures of model
//     complexity and fit". JRSS B.
//   - Koller, D., & Friedman, N. (2009). "Probabilistic Graphical Models:
//     Principles and Techniques". MIT Press.
//
// Версия: 6.0.1

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════════

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function saveJSON(fp, data) {
  ensureDir(dirname(fp));
  writeFileSync(fp, JSON.stringify(data, null, 2));
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr, ddof = 1) {
  const n = arr.length;
  if (n <= ddof) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (n - ddof));
}

function gaussianRandom(meanVal = 0, sd = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return meanVal + z * sd;
}

/**
 * Сэмпл из гамма-распределения (Marsaglia-Tsang).
 */
function gammaSample(shape, scale) {
  if (shape < 1) {
    return gammaSample(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  let x, v;
  do {
    do {
      x = gaussianRandom(0, 1);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
  } while (Math.random() >= 1 - 0.0331 * Math.pow(x, 4)
    && Math.log(Math.random()) >= 0.5 * x * x + d * (1 - v + Math.log(v)));
  return d * scale * v;
}

/**
 * Сэмпл из Dirichlet(alpha).
 */
function dirichletSample(alphas) {
  const gammas = alphas.map((a) => gammaSample(a, 1));
  const sum = gammas.reduce((a, b) => a + b, 0) || 1;
  return gammas.map((g) => g / sum);
}

// ═══════════════════════════════════════════════════════════════════
// 1. BAYESIAN NETWORK — ядро
// ═══════════════════════════════════════════════════════════════════

class BayesNode {
  constructor(name, states, parents = []) {
    this.name = name;
    this.states = states;
    this.parents = parents;
    this.K = states.length;

    const numParentCombos = this._estimateParentCombos();
    this.cpt = Array.from({ length: numParentCombos }, () =>
      new Array(this.K).fill(1 / this.K)
    );

    this.counts = Array.from({ length: numParentCombos }, () =>
      new Array(this.K).fill(0)
    );
  }

  _estimateParentCombos() {
    return Math.pow(2, this.parents.length);
  }

  setParentCombos(num) {
    if (this.cpt.length === num) return;
    this.cpt = Array.from({ length: num }, () =>
      new Array(this.K).fill(1 / this.K)
    );
    this.counts = Array.from({ length: num }, () =>
      new Array(this.K).fill(0)
    );
  }

  getDistribution(parentIdx) {
    return this.cpt[parentIdx] || new Array(this.K).fill(1 / this.K);
  }
}

class BayesianNetwork {
  constructor(name = 'bn') {
    this.name = name;
    this.nodes = new Map();
    this.edges = [];
    this._topoOrder = null;
    this._parentCombos = new Map();
  }

  addNode(name, states, parents = []) {
    for (const p of parents) {
      if (!this.nodes.has(p)) {
        throw new Error(`Parent '${p}' for node '${name}' not found. Add parents first.`);
      }
    }

    const node = new BayesNode(name, states, [...parents]);

    let numCombos = 1;
    for (const p of parents) {
      numCombos *= this.nodes.get(p).K;
    }
    node.setParentCombos(numCombos);
    this._parentCombos.set(name, numCombos);

    this.nodes.set(name, node);

    for (const p of parents) {
      this.edges.push({ from: p, to: name });
    }

    this._topoOrder = null;
    return this;
  }

  setCPT(name, cpt) {
    const node = this.nodes.get(name);
    if (!node) throw new Error(`Node '${name}' not found`);
    if (cpt.length !== node.cpt.length) {
      throw new Error(`CPT for '${name}' should have ${node.cpt.length} entries, got ${cpt.length}`);
    }
    for (let i = 0; i < cpt.length; i++) {
      const sum = cpt[i].reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 1e-6) {
        throw new Error(`CPT row ${i} for '${name}' sums to ${sum}, expected 1`);
      }
      if (cpt[i].length !== node.K) {
        throw new Error(`CPT row ${i} for '${name}' has ${cpt[i].length} values, expected ${node.K}`);
      }
    }
    node.cpt = cpt.map((row) => [...row]);
    return this;
  }

  _topologicalSort() {
    if (this._topoOrder) return this._topoOrder;

    const indeg = new Map();
    const adj = new Map();
    for (const name of this.nodes.keys()) {
      indeg.set(name, 0);
      adj.set(name, []);
    }
    for (const e of this.edges) {
      adj.get(e.from).push(e.to);
      indeg.set(e.to, indeg.get(e.to) + 1);
    }

    const queue = [...this.nodes.keys()].filter((n) => indeg.get(n) === 0);
    const sorted = [];
    while (queue.length > 0) {
      const u = queue.shift();
      sorted.push(u);
      for (const v of adj.get(u)) {
        indeg.set(v, indeg.get(v) - 1);
        if (indeg.get(v) === 0) queue.push(v);
      }
    }

    if (sorted.length !== this.nodes.size) {
      throw new Error('Network contains a cycle — not a valid DAG');
    }

    this._topoOrder = sorted;
    return sorted;
  }

  _parentIndex(node, assignment) {
    if (node.parents.length === 0) return 0;
    let idx = 0;
    let mult = 1;
    for (let i = 0; i < node.parents.length; i++) {
      const pName = node.parents[i];
      const pNode = this.nodes.get(pName);
      const pState = assignment[pName] || 0;
      idx += pState * mult;
      mult *= pNode.K;
    }
    return idx;
  }

  _jointProbability(assignment) {
    let prob = 1;
    for (const [name, node] of this.nodes) {
      const state = assignment[name];
      if (state === undefined) return 0;
      const pIdx = this._parentIndex(node, assignment);
      const dist = node.getDistribution(pIdx);
      prob *= dist[state] || 0;
      if (prob === 0) return 0;
    }
    return prob;
  }

  exactInference(target, evidence = {}) {
    const targetNode = this.nodes.get(target);
    if (!targetNode) throw new Error(`Node '${target}' not found`);

    const totalCombos = [...this.nodes.values()].reduce((a, n) => a * n.K, 1);
    if (totalCombos > 1e7) {
      return {
        target,
        error: 'network_too_large_for_exact',
        estimatedCombos: totalCombos,
        hint: 'Use likelihoodWeighting() or forwardSampling() instead',
      };
    }

    const topoOrder = this._topologicalSort();
    const result = new Array(targetNode.K).fill(0);
    const assignment = {};

    const enumerate = (idx) => {
      if (idx === topoOrder.length) {
        const prob = this._jointProbability(assignment);
        if (prob > 0) {
          result[assignment[target]] += prob;
        }
        return;
      }
      const name = topoOrder[idx];
      const node = this.nodes.get(name);

      if (evidence[name] !== undefined) {
        assignment[name] = evidence[name];
        enumerate(idx + 1);
        delete assignment[name];
      } else {
        for (let s = 0; s < node.K; s++) {
          assignment[name] = s;
          enumerate(idx + 1);
        }
        delete assignment[name];
      }
    };

    enumerate(0);

    const sum = result.reduce((a, b) => a + b, 0);
    const probabilities = sum > 0 ? result.map((p) => p / sum) : result.map(() => 1 / targetNode.K);

    return {
      target,
      states: [...targetNode.states],
      probabilities,
      evidence,
      method: 'exact_enumeration',
    };
  }

  forwardSampling(target, evidence = {}, nSamples = 10000) {
    const targetNode = this.nodes.get(target);
    if (!targetNode) throw new Error(`Node '${target}' not found`);

    const topoOrder = this._topologicalSort();
    const counts = new Array(targetNode.K).fill(0);
    let accepted = 0;

    for (let i = 0; i < nSamples; i++) {
      const assignment = {};
      let consistentWithEvidence = true;

      for (const name of topoOrder) {
        const node = this.nodes.get(name);

        if (evidence[name] !== undefined) {
          assignment[name] = evidence[name];
          continue;
        }

        const pIdx = this._parentIndex(node, assignment);
        const dist = node.getDistribution(pIdx);
        const r = Math.random();
        let cum = 0;
        let sampledState = node.K - 1;
        for (let k = 0; k < node.K; k++) {
          cum += dist[k];
          if (r < cum) { sampledState = k; break; }
        }
        assignment[name] = sampledState;
      }

      for (const [name, state] of Object.entries(evidence)) {
        if (assignment[name] !== state) {
          consistentWithEvidence = false;
          break;
        }
      }

      if (consistentWithEvidence) {
        counts[assignment[target]]++;
        accepted++;
      }
    }

    const probabilities = accepted > 0
      ? counts.map((c) => c / accepted)
      : counts.map(() => 1 / targetNode.K);

    return {
      target,
      states: [...targetNode.states],
      probabilities,
      evidence,
      nSamples,
      acceptedSamples: accepted,
      acceptanceRate: accepted / nSamples,
      method: 'forward_sampling',
    };
  }

  likelihoodWeighting(target, evidence = {}, nSamples = 10000) {
    const targetNode = this.nodes.get(target);
    if (!targetNode) throw new Error(`Node '${target}' not found`);

    const topoOrder = this._topologicalSort();
    const weightedCounts = new Array(targetNode.K).fill(0);
    let totalWeight = 0;

    for (let i = 0; i < nSamples; i++) {
      const assignment = {};
      let weight = 1;

      for (const name of topoOrder) {
        const node = this.nodes.get(name);

        if (evidence[name] !== undefined) {
          assignment[name] = evidence[name];
          const pIdx = this._parentIndex(node, assignment);
          const dist = node.getDistribution(pIdx);
          weight *= dist[evidence[name]] || 1e-10;
        } else {
          const pIdx = this._parentIndex(node, assignment);
          const dist = node.getDistribution(pIdx);
          const r = Math.random();
          let cum = 0;
          let sampledState = node.K - 1;
          for (let k = 0; k < node.K; k++) {
            cum += dist[k];
            if (r < cum) { sampledState = k; break; }
          }
          assignment[name] = sampledState;
        }
      }

      if (weight > 0) {
        weightedCounts[assignment[target]] += weight;
        totalWeight += weight;
      }
    }

    const probabilities = totalWeight > 0
      ? weightedCounts.map((c) => c / totalWeight)
      : weightedCounts.map(() => 1 / targetNode.K);

    return {
      target,
      states: [...targetNode.states],
      probabilities,
      evidence,
      nSamples,
      effectiveSampleSize: totalWeight > 0
        ? (totalWeight * totalWeight) / Math.max(weightedCounts.reduce((s, c) => s + c * c, 0), 1e-10)
        : 0,
      method: 'likelihood_weighting',
    };
  }

  infer(target, evidence = {}, options = {}) {
    const nNodes = this.nodes.size;
    const totalCombos = [...this.nodes.values()].reduce((a, n) => a * n.K, 1);

    if (nNodes <= 15 && totalCombos <= 1e6) {
      return this.exactInference(target, evidence);
    }

    const nSamples = options.nSamples || 10000;
    if (Object.keys(evidence).length > 0) {
      return this.likelihoodWeighting(target, evidence, nSamples);
    }
    return this.forwardSampling(target, evidence, nSamples);
  }

  learnFromDataMLE(data, alpha = 1) {
    for (const node of this.nodes.values()) {
      for (let i = 0; i < node.counts.length; i++) {
        for (let k = 0; k < node.K; k++) node.counts[i][k] = alpha;
      }
    }

    for (const row of data) {
      for (const [name, node] of this.nodes) {
        const state = row[name];
        if (state === undefined || state < 0 || state >= node.K) continue;
        const pIdx = this._parentIndex(node, row);
        node.counts[pIdx][state]++;
      }
    }

    for (const node of this.nodes.values()) {
      for (let i = 0; i < node.counts.length; i++) {
        const sum = node.counts[i].reduce((a, b) => a + b, 0) || 1;
        node.cpt[i] = node.counts[i].map((c) => c / sum);
      }
    }

    return this;
  }

  learnFromDataBayesian(data, priorAlpha = 1) {
    return this.learnFromDataMLE(data, priorAlpha);
  }

  logLikelihood(data) {
    let ll = 0;
    for (const row of data) {
      const prob = this._jointProbability(row);
      if (prob > 0) {
        ll += Math.log(prob);
      } else {
        ll += Math.log(1e-10);
      }
    }
    return ll;
  }

  dic(data) {
    const ll = this.logLikelihood(data);
    const Dhat = -2 * ll;
    const nParams = [...this.nodes.values()].reduce((s, n) =>
      s + n.cpt.length * (n.K - 1), 0);
    const pD = nParams;
    return {
      dic: Dhat + 2 * pD,
      Dhat,
      pD,
      nParams,
      logLikelihood: ll,
      nData: data.length,
    };
  }

  static enumerateDAGs(variables, statesPerVar) {
    const n = variables.length;
    const possibleEdges = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        possibleEdges.push([i, j]);
      }
    }

    const numEdges = possibleEdges.length;
    if (numEdges > 12) return { error: 'too_many_edges', numEdges };

    const dags = [];
    const maxMask = 1 << numEdges;
    for (let mask = 0; mask < maxMask; mask++) {
      const edges = [];
      for (let e = 0; e < numEdges; e++) {
        if (mask & (1 << e)) {
          edges.push(possibleEdges[e]);
        }
      }
      if (BayesianNetwork._isAcyclic(n, edges)) {
        dags.push(edges);
      }
    }
    return { dags, numDAGs: dags.length };
  }

  static _isAcyclic(n, edges) {
    const adj = Array.from({ length: n }, () => []);
    for (const [from, to] of edges) adj[from].push(to);

    const state = new Array(n).fill(0);
    const dfs = (u) => {
      state[u] = 1;
      for (const v of adj[u]) {
        if (state[v] === 1) return false;
        if (state[v] === 0 && !dfs(v)) return false;
      }
      state[u] = 2;
      return true;
    };

    for (let i = 0; i < n; i++) {
      if (state[i] === 0 && !dfs(i)) return false;
    }
    return true;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ГОТОВЫЕ СЕТИ ДЛЯ CRUCIX
// ═══════════════════════════════════════════════════════════════════

/**
 * Причинная сеть: конфликт → санкции → напряжение → VIX.
 * 4 узла, каждое по 3 состояния.
 */
function buildCrucixCausalNetwork() {
  const bn = new BayesianNetwork('crucix_causal');

  bn.addNode('conflict', ['low', 'medium', 'high'], []);
  bn.addNode('sanctions', ['low', 'medium', 'high'], ['conflict']);
  bn.addNode('tension', ['low', 'medium', 'high'], ['conflict', 'sanctions']);
  bn.addNode('vix', ['low', 'medium', 'high'], ['tension']);

  bn.setCPT('conflict', [
    [0.6, 0.3, 0.1],
  ]);
  bn.setCPT('sanctions', [
    [0.8, 0.18, 0.02],
    [0.3, 0.55, 0.15],
    [0.05, 0.30, 0.65],
  ]);
  bn.setCPT('tension', [
    [0.85, 0.13, 0.02],
    [0.60, 0.35, 0.05],
    [0.40, 0.45, 0.15],
    [0.50, 0.40, 0.10],
    [0.30, 0.50, 0.20],
    [0.15, 0.40, 0.45],
    [0.20, 0.40, 0.40],
    [0.10, 0.35, 0.55],
    [0.02, 0.18, 0.80],
  ]);
  bn.setCPT('vix', [
    [0.75, 0.22, 0.03],
    [0.35, 0.50, 0.15],
    [0.05, 0.25, 0.70],
  ]);

  return bn;
}

/**
 * Рыночная сеть: VIX → спреды → валюты → золото.
 * 4 узла, каждое по 3 состояния.
 */
function buildCrucixMarketNetwork() {
  const bn = new BayesianNetwork('crucix_market');

  bn.addNode('vix', ['low', 'medium', 'high'], []);
  bn.addNode('hySpread', ['low', 'medium', 'high'], ['vix']);
  bn.addNode('dxy', ['low', 'medium', 'high'], ['vix', 'hySpread']);
  bn.addNode('gold', ['low', 'medium', 'high'], ['vix', 'dxy']);

  bn.setCPT('vix', [
    [0.7, 0.25, 0.05],
  ]);
  bn.setCPT('hySpread', [
    [0.85, 0.13, 0.02],
    [0.40, 0.50, 0.10],
    [0.10, 0.35, 0.55],
  ]);
  bn.setCPT('dxy', [
    [0.65, 0.30, 0.05],
    [0.50, 0.40, 0.10],
    [0.30, 0.50, 0.20],
    [0.40, 0.45, 0.15],
    [0.35, 0.45, 0.20],
    [0.20, 0.45, 0.35],
    [0.25, 0.50, 0.25],
    [0.15, 0.45, 0.40],
    [0.10, 0.35, 0.55],
  ]);
  bn.setCPT('gold', [
    [0.55, 0.35, 0.10],
    [0.45, 0.45, 0.10],
    [0.35, 0.50, 0.15],
    [0.35, 0.45, 0.20],
    [0.25, 0.50, 0.25],
    [0.20, 0.45, 0.35],
    [0.15, 0.40, 0.45],
    [0.10, 0.35, 0.55],
    [0.05, 0.25, 0.70],
  ]);

  return bn;
}

/**
 * Геополитическая сеть: конфликты + санкции → эскалация.
 * 3 узла, каждое по 3 состояния.
 */
function buildCrucixGeopoliticalNetwork() {
  const bn = new BayesianNetwork('crucix_geopolitical');

  bn.addNode('conflictCount', ['low', 'medium', 'high'], []);
  bn.addNode('sanctionsPressure', ['low', 'medium', 'high'], ['conflictCount']);
  bn.addNode('escalationRisk', ['low', 'medium', 'high'], ['conflictCount', 'sanctionsPressure']);

  bn.setCPT('conflictCount', [
    [0.60, 0.30, 0.10],
  ]);
  bn.setCPT('sanctionsPressure', [
    [0.80, 0.18, 0.02],
    [0.30, 0.55, 0.15],
    [0.05, 0.30, 0.65],
  ]);
  bn.setCPT('escalationRisk', [
    [0.90, 0.08, 0.02],
    [0.70, 0.25, 0.05],
    [0.40, 0.45, 0.15],
    [0.55, 0.35, 0.10],
    [0.30, 0.50, 0.20],
    [0.10, 0.40, 0.50],
    [0.20, 0.40, 0.40],
    [0.08, 0.32, 0.60],
    [0.02, 0.18, 0.80],
  ]);

  return bn;
}

// ═══════════════════════════════════════════════════════════════════
// ИНТЕГРАЦИЯ С CRUCIX — главная функция
// ═══════════════════════════════════════════════════════════════════

/**
 * Байесовская сеть для Crucix: авто-выбор сети, обучение из истории,
 * inference (exact + sampling + likelihood weighting), DIC.
 *
 * @param {Object} latest — текущий sweep
 * @param {Array} history — история sweep'ов
 * @param {Object} options — { network, nSamples }
 * @returns {Object}
 */
export function crucixBayesNet(latest, history = [], options = {}) {
  if (!latest) {
    return { module: 'bayesnet', available: false, reason: 'no_latest_data' };
  }

  const t0 = Date.now();
  const networkType = options.network || 'auto';
  const nSamples = options.nSamples || 1000;

  let bn;
  let networkName;

  if (networkType === 'auto') {
    const vix = latest.fred?.vix ?? 20;
    const hySpread = latest.fred?.hySpread ?? 2;
    const conflict = latest.gdelt?.conflictEvents?.length ?? 0;

    if (vix > 25 || hySpread > 4) {
      bn = buildCrucixMarketNetwork();
      networkName = 'market';
    } else if (conflict > 8) {
      bn = buildCrucixGeopoliticalNetwork();
      networkName = 'geopolitical';
    } else {
      bn = buildCrucixCausalNetwork();
      networkName = 'causal';
    }
  } else if (networkType === 'market') {
    bn = buildCrucixMarketNetwork();
    networkName = 'market';
  } else if (networkType === 'geopolitical') {
    bn = buildCrucixGeopoliticalNetwork();
    networkName = 'geopolitical';
  } else {
    bn = buildCrucixCausalNetwork();
    networkName = 'causal';
  }

  // ─── Обучение CPT из истории ───
  let learned = false;
  let learnError = null;

  if (Array.isArray(history) && history.length >= 20) {
    try {
      const trainingData = [];

      for (const s of history) {
        const vix = s.fred?.vix ?? 20;
        const hySpread = s.fred?.hySpread ?? 3;
        const dxy = s.dxy?.value ?? 100;
        const gold = s.gold?.price ?? 1900;
        const conflict = s.gdelt?.conflictEvents?.length ?? 0;
        const sanctions = s.sanctions?.count ?? 0;

        const row = {};

        if (networkName === 'market') {
          row.vix = vix > 30 ? 2 : vix > 22 ? 1 : 0;
          row.hySpread = hySpread > 5 ? 2 : hySpread > 3 ? 1 : 0;
          row.dxy = dxy > 105 ? 2 : dxy > 100 ? 1 : 0;
          row.gold = gold > 2200 ? 2 : gold > 1900 ? 1 : 0;
        } else if (networkName === 'geopolitical') {
          row.conflictCount = conflict > 10 ? 2 : conflict > 4 ? 1 : 0;
          row.sanctionsPressure = sanctions > 5 ? 2 : sanctions > 1 ? 1 : 0;
          row.escalationRisk = conflict > 10 && sanctions > 5 ? 2
            : conflict > 4 || sanctions > 1 ? 1 : 0;
        } else {
          row.conflict = conflict > 10 ? 2 : conflict > 4 ? 1 : 0;
          row.sanctions = sanctions > 5 ? 2 : sanctions > 1 ? 1 : 0;
          row.tension = (vix > 30 || conflict > 10) ? 2 : (vix > 22 || conflict > 4) ? 1 : 0;
          row.vix = vix > 30 ? 2 : vix > 22 ? 1 : 0;
        }

        trainingData.push(row);
      }

      if (trainingData.length >= 10) {
        bn.learnFromDataMLE(trainingData, 1);
        learned = true;
      }
    } catch (e) {
      learnError = e.message;
    }
  }

  // ─── Формирование evidence ───
  const evidence = {};
  const vix = latest.fred?.vix ?? 20;
  const hySpread = latest.fred?.hySpread ?? 3;
  const conflict = latest.gdelt?.conflictEvents?.length ?? 0;
  const sanctions = latest.sanctions?.count ?? 0;

  if (networkName === 'market') {
    evidence.vix = vix > 30 ? 2 : vix > 22 ? 1 : 0;
    evidence.hySpread = hySpread > 5 ? 2 : hySpread > 3 ? 1 : 0;
  } else if (networkName === 'geopolitical') {
    evidence.conflictCount = conflict > 10 ? 2 : conflict > 4 ? 1 : 0;
    evidence.sanctionsPressure = sanctions > 5 ? 2 : sanctions > 1 ? 1 : 0;
  } else {
    evidence.conflict = conflict > 10 ? 2 : conflict > 4 ? 1 : 0;
    evidence.sanctions = sanctions > 5 ? 2 : sanctions > 1 ? 1 : 0;
    evidence.tension = (vix > 30 || conflict > 10) ? 2 : (vix > 22 || conflict > 4) ? 1 : 0;
  }

  // ─── Query-цель ───
  let queryTarget;
  if (networkName === 'market') {
    queryTarget = 'hySpread';
  } else if (networkName === 'geopolitical') {
    queryTarget = 'escalationRisk';
  } else {
    queryTarget = 'vix';
  }

  // ─── Inference ───
  let exactResult = null;
  let exactError = null;
  try {
    exactResult = bn.exactInference(queryTarget, evidence);
  } catch (e) {
    exactError = e.message;
  }

  let sampledResult = null;
  let sampledError = null;
  try {
    sampledResult = bn.forwardSampling(queryTarget, evidence, nSamples);
  } catch (e) {
    sampledError = e.message;
  }

  let lwResult = null;
  let lwError = null;
  try {
    lwResult = bn.likelihoodWeighting(queryTarget, evidence, nSamples);
  } catch (e) {
    lwError = e.message;
  }

  // ─── DIC ───
  let dicValue = null;
  if (Array.isArray(history) && history.length >= 10) {
    try {
      const dicData = history.slice(-20).map((s) => {
        const row = {};
        if (networkName === 'market') {
          const v = s.fred?.vix ?? 20;
          const h = s.fred?.hySpread ?? 3;
          const d = s.dxy?.value ?? 100;
          const g = s.gold?.price ?? 1900;
          row.vix = v > 30 ? 2 : v > 22 ? 1 : 0;
          row.hySpread = h > 5 ? 2 : h > 3 ? 1 : 0;
          row.dxy = d > 105 ? 2 : d > 100 ? 1 : 0;
          row.gold = g > 2200 ? 2 : g > 1900 ? 1 : 0;
        } else if (networkName === 'geopolitical') {
          const c = s.gdelt?.conflictEvents?.length ?? 0;
          const sc = s.sanctions?.count ?? 0;
          row.conflictCount = c > 10 ? 2 : c > 4 ? 1 : 0;
          row.sanctionsPressure = sc > 5 ? 2 : sc > 1 ? 1 : 0;
          row.escalationRisk = c > 10 && sc > 5 ? 2 : (c > 4 || sc > 1) ? 1 : 0;
        } else {
          const v = s.fred?.vix ?? 20;
          const c = s.gdelt?.conflictEvents?.length ?? 0;
          const sc = s.sanctions?.count ?? 0;
          row.conflict = c > 10 ? 2 : c > 4 ? 1 : 0;
          row.sanctions = sc > 5 ? 2 : sc > 1 ? 1 : 0;
          row.tension = (v > 30 || c > 10) ? 2 : (v > 22 || c > 4) ? 1 : 0;
          row.vix = v > 30 ? 2 : v > 22 ? 1 : 0;
        }
        return row;
      });
      dicValue = bn.dic(dicData);
    } catch (e) {
      dicValue = { error: e.message };
    }
  }

  // ─── Доминирующее состояние ───
  const targetNode = bn.nodes.get(queryTarget);
  const targetStates = targetNode ? [...targetNode.states] : [];

  let dominantState = 'unknown';
  let dominantProbability = 0;

  const extractProbabilities = (res) => {
    if (!res || res.error) return null;
    if (Array.isArray(res.probabilities)) return res.probabilities;
    return null;
  };

  const probs = extractProbabilities(exactResult)
    || extractProbabilities(lwResult)
    || extractProbabilities(sampledResult);

  if (probs && probs.length > 0) {
    const maxIdx = probs.indexOf(Math.max(...probs));
    dominantState = targetStates[maxIdx] || `state_${maxIdx}`;
    dominantProbability = probs[maxIdx];
  }

  // ─── Формирование результата ───
  const result = {
    module: 'bayesnet',
    available: true,
    version: '6.0.1',
    timestamp: new Date().toISOString(),
    elapsedMs: Date.now() - t0,
    network: {
      type: networkName,
      name: bn.name,
      nNodes: bn.nodes.size,
      nEdges: bn.edges.length,
      nodes: [...bn.nodes.entries()].map(([name, node]) => ({
        name,
        states: [...node.states],
        parents: [...node.parents],
        K: node.K,
      })),
      edges: bn.edges.map((e) => ({ from: e.from, to: e.to })),
      learnedFromHistory: learned,
      learnError,
    },
    evidence: Object.fromEntries(
      Object.entries(evidence).map(([k, v]) => {
        const node = bn.nodes.get(k);
        const st = node ? node.states[v] : `state_${v}`;
        return [k, st];
      })
    ),
    query: {
      target: queryTarget,
      targetStates,
      exact: exactResult && !exactResult.error
        ? {
            method: exactResult.method,
            probabilities: exactResult.probabilities.map((p, i) => ({
              state: targetStates[i] || `state_${i}`,
              probability: Math.round(p * 10000) / 10000,
            })),
          }
        : { error: exactError || (exactResult && exactResult.error) || 'unavailable' },
      sampled: sampledResult && !sampledResult.error
        ? {
            method: sampledResult.method,
            nSamples: sampledResult.nSamples,
            acceptedSamples: sampledResult.acceptedSamples,
            acceptanceRate: Math.round(sampledResult.acceptanceRate * 10000) / 10000,
            probabilities: sampledResult.probabilities.map((p, i) => ({
              state: targetStates[i] || `state_${i}`,
              probability: Math.round(p * 10000) / 10000,
            })),
          }
        : { error: sampledError || 'unavailable' },
      likelihoodWeighting: lwResult && !lwResult.error
        ? {
            method: lwResult.method,
            nSamples: lwResult.nSamples,
            effectiveSampleSize: Math.round(lwResult.effectiveSampleSize),
            probabilities: lwResult.probabilities.map((p, i) => ({
              state: targetStates[i] || `state_${i}`,
              probability: Math.round(p * 10000) / 10000,
            })),
          }
        : { error: lwError || 'unavailable' },
    },
    dominantState,
    dominantProbability: Math.round(dominantProbability * 10000) / 10000,
    dic: dicValue,
    interpretation:
      `Bayesian Network (${networkName}): ` +
      `P(${queryTarget}=${dominantState}) = ${(dominantProbability * 100).toFixed(1)}%. ` +
      `Сеть: ${bn.nodes.size} узлов, ${bn.edges.length} рёбер. ` +
      `Обучение из истории: ${learned ? 'да' : 'нет'}.`,
  };

  try {
    const outDir = join(__dirname, '..', '..', '..', 'runs', 'predictions');
    saveJSON(join(outDir, 'bayesnet.json'), result);
  } catch (e) {
    // Работает даже без диска
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// ЭКСПОРТЫ
// ═══════════════════════════════════════════════════════════════════

export {
  BayesNode,
  BayesianNetwork,
  buildCrucixCausalNetwork,
  buildCrucixMarketNetwork,
  buildCrucixGeopoliticalNetwork,
  dirichletSample,
  gammaSample,
};
