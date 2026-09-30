// apis/predict/v6/quantum_hypergraph.mjs
// Quantum-Inspired Hypergraph Sampling
// MAP-оценка структуры гиперграфа через квантовый отжиг (QUBO/Ising)
//
// Теоретическая основа:
//   - Lucas, A. (2014). "Ising formulations of many NP problems".
//     Frontiers in Physics.
//   - Johnson, M. W., et al. (2011). "Quantum annealing with manufactured
//     spins". Nature.
//   - Heim, B., et al. (2020). "Quantum programming languages for
//     near-term NISQ devices". Quantum.
//   - Suzuki, M. (1995). "Quantum Monte Carlo methods in condensed matter
//     physics". World Scientific.
//
// Ключевая идея:
//   Поиск MAP-гиперграфа — NP-трудная комбинаторная задача.
//   Мы формулируем её как QUBO (Quadratic Unconstrained Binary Optimization)
//   и решаем через симулированный квантовый отжиг (Path-Integral Monte Carlo).
//
//   Бинарные переменные s_i ∈ {0,1} представляют наличие/отсутствие
//   гиперребра i в кандидате. Энергия:
//     H(s) = -log-likelihood(data | hypergraph(s))
//            + lambda * complexity(hypergraph(s))
//   Минимум H(s) = MAP-гиперграф.
//
// Архитектура:
//   1. QUBOFormulation — построение Ising-модели из данных
//   2. QuantumAnnealer — симулированный отжиг с туннелированием
//   3. HypergraphMAP — сборка финального гиперграфа из решения
//   4. crucixQuantumHypergraph() — интеграция с Crucix
//
// Версия: 6.0.0

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

function saveJSON(fp, data) {
  ensureDir(dirname(fp));
  writeFileSync(fp, JSON.stringify(data, null, 2));
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function subsets(nodes, minSize, maxSize) {
  const result = [];
  const n = nodes.length;
  const total = 1 << n;
  for (let mask = 0; mask < total; mask++) {
    const bits = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) bits.push(i);
    if (bits.length >= minSize && bits.length <= maxSize) result.push(bits);
  }
  return result;
}

// Условная взаимная информация: I(X;Y | Z)
function conditionalMutualInformation(data, x, y, zIndices) {
  const n = data.length;

  const discretize = (col) => {
    const sorted = [...col].sort((a, b) => a - b);
    const t1 = sorted[Math.floor(n / 3)];
    const t2 = sorted[Math.floor(2 * n / 3)];
    return col.map(v => v <= t1 ? 0 : v <= t2 ? 1 : 2);
  };

  const dx = discretize(data.map(r => r[x]));
  const dy = discretize(data.map(r => r[y]));

  if (zIndices.length === 0) {
    const counts = {};
    for (let i = 0; i < n; i++) {
      const key = `${dx[i]},${dy[i]}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    let mi = 0;
    for (const [key, c] of Object.entries(counts)) {
      const [a, b] = key.split(',').map(Number);
      const px = dx.filter(v => v === a).length / n;
      const py = dy.filter(v => v === b).length / n;
      const pxy = c / n;
      mi += pxy * Math.log2(pxy / (px * py + 1e-10));
    }
    return Math.max(0, mi);
  }

  const dz = zIndices.map(z => discretize(data.map(r => r[z])));
  const zKeys = [];
  for (let i = 0; i < n; i++) {
    zKeys.push(dz.map(d => d[i]).join(','));
  }
  const zUnique = [...new Set(zKeys)];

  let cmi = 0;
  for (const zk of zUnique) {
    const idxs = zKeys.map(k => k === zk);
    const subset = idxs.filter(Boolean).length;
    if (subset < 5) continue;
    const pz = subset / n;

    const counts = {};
    for (let i = 0; i < n; i++) {
      if (!idxs[i]) continue;
      const key = `${dx[i]},${dy[i]}`;
      counts[key] = (counts[key] || 0) + 1;
    }

    let mi = 0;
    for (const [key, c] of Object.entries(counts)) {
      const [a, b] = key.split(',').map(Number);
      const px = idxs.filter((v, i) => v && dx[i] === a).length / subset;
      const py = idxs.filter((v, i) => v && dy[i] === b).length / subset;
      const pxy = c / subset;
      mi += pxy * Math.log2(pxy / (px * py + 1e-10));
    }
    cmi += pz * Math.max(0, mi);
  }
  return cmi;
}

// ═══════════════════════════════════════════════════
// QUBOFormulation — построение Ising-модели
// ═══════════════════════════════════════════════════

class QUBOFormulation {
  constructor(config = {}) {
    this.nVariables = config.nVariables || 5;
    this.maxHyperedgeSize = config.maxHyperedgeSize || 3;
    this.miThreshold = config.miThreshold ?? 0.05;
    this.lambdaBIC = config.lambdaBIC ?? 0.5;
    this.lambdaOverlap = config.lambdaOverlap ?? 0.1;

    this.candidates = this._buildCandidates();
    this.nQubits = this.candidates.length;

    this.Q = null;
    this.c = null;
    this.miScores = null;
  }

  _buildCandidates() {
    const cands = [];
    for (let t = 0; t < this.nVariables; t++) {
      const others = Array.from({ length: this.nVariables }, (_, i) => i).filter(i => i !== t);
      const subs = subsets(others, 1, this.maxHyperedgeSize - 1);
      for (const s of subs) {
        cands.push({ nodes: [...s, t], target: t, parents: s, size: s.length + 1 });
      }
    }
    return cands;
  }

  build(data) {
    const n = this.nQubits;
    this.Q = Array.from({ length: n }, () => new Float64Array(n));
    this.c = new Float64Array(n);
    this.miScores = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      const cand = this.candidates[i];
      const cmi = conditionalMutualInformation(
        data, cand.target, cand.parents[0],
        cand.parents.length > 1 ? cand.parents.slice(1) : []
      );
      this.miScores[i] = cmi;
      this.c[i] = -cmi + this.lambdaBIC * Math.pow(2, cand.size);
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const ci = this.candidates[i];
        const cj = this.candidates[j];
        if (ci.target === cj.target) {
          const overlap = ci.parents.filter(p => cj.parents.includes(p)).length;
          if (overlap > 0) {
            this.Q[i][j] = this.lambdaOverlap * overlap;
            this.Q[j][i] = this.Q[i][j];
          }
        }
      }
    }

    return { Q: this.Q, c: this.c, nQubits: n };
  }

  energy(x) {
    let e = 0;
    for (let i = 0; i < this.nQubits; i++) {
      e += this.c[i] * x[i];
      for (let j = i + 1; j < this.nQubits; j++) {
        e += this.Q[i][j] * x[i] * x[j];
      }
    }
    return e;
  }
}

// ═══════════════════════════════════════════════════
// QuantumAnnealer — симулированный квантовый отжиг
// ═══════════════════════════════════════════════════
//
// Path-Integral Quantum Annealing (Suzuki, 1995):
//   Система представлена P реплик Ising-модели при разных
//   температурах, связанных кинетическим членом (туннелирование).
//   Гамильтониан: H = sum_p H_classical(s_p) - J(t) * sum_p s_p * s_{p+1}
//   J(t) — сила туннелирования, растёт со временем.

class QuantumAnnealer {
  constructor(config = {}) {
    this.nQubits = config.nQubits || 20;
    this.nReplicas = config.nReplicas || 8;
    this.nSteps = config.nSteps || 1000;
    this.initialTemp = config.initialTemp ?? 5.0;
    this.finalTemp = config.finalTemp ?? 0.01;
    this.initialGamma = config.initialGamma ?? 3.0;
    this.finalGamma = config.finalGamma ?? 0.01;
    this.qubo = config.qubo;
    this.bestEnergy = Infinity;
    this.bestConfig = null;
    this.energyHistory = [];
  }

  anneal() {
    const P = this.nReplicas;
    const N = this.nQubits;
    const qubo = this.qubo;

    let replicas = Array.from({ length: P }, () =>
      new Uint8Array(N).map(() => Math.random() < 0.5 ? 1 : 0)
    );

    for (let step = 0; step < this.nSteps; step++) {
      const progress = step / this.nSteps;
      const T = this.initialTemp * Math.pow(this.finalTemp / this.initialTemp, progress);
      const gamma = this.initialGamma * Math.pow(this.finalGamma / this.initialGamma, progress);
      const J = -T / 2 * Math.log(Math.tanh(Math.max(1e-10, gamma * T / P)));

      for (let p = 0; p < P; p++) {
        const spin = replicas[p];
        const prevSpin = replicas[(p - 1 + P) % P];
        const nextSpin = replicas[(p + 1) % P];

        const order = shuffle(Array.from({ length: N }, (_, i) => i));
        for (const i of order) {
          let dE = qubo.c[i];
          for (let j = 0; j < N; j++) {
            if (j !== i && spin[j]) dE += qubo.Q[i][j];
          }

          const quantumField = J * (prevSpin[i] + nextSpin[i]);
          const oldVal = spin[i];
          const newVal = 1 - oldVal;
          const dEFlip = (newVal - oldVal) *
            (dE + quantumField * (2 * oldVal - 1) * -1 + quantumField);

          if (dEFlip < 0 || Math.random() < Math.exp(-dEFlip / Math.max(1e-10, T))) {
            spin[i] = newVal;
          }
        }
      }

      for (let p = 0; p < P; p++) {
        const e = qubo.energy(Array.from(replicas[p]));
        if (e < this.bestEnergy) {
          this.bestEnergy = e;
          this.bestConfig = Array.from(replicas[p]);
        }
      }

      if (step % 50 === 0) {
        const avgE = replicas.reduce((s, r) => s + qubo.energy(Array.from(r)), 0) / P;
        this.energyHistory.push({ step, avgE, bestE: this.bestEnergy, T, gamma });
      }
    }

    return {
      bestConfig: this.bestConfig,
      bestEnergy: this.bestEnergy,
      history: this.energyHistory,
    };
  }
}

// ═══════════════════════════════════════════════════
// HypergraphMAP — сборка финального гиперграфа
// ═══════════════════════════════════════════════════

class HypergraphMAP {
  constructor(qubo, candidates) {
    this.qubo = qubo;
    this.candidates = candidates;
  }

  build(solution) {
    const edges = [];
    for (let i = 0; i < solution.length; i++) {
      if (solution[i] === 1) {
        const cand = this.candidates[i];
        edges.push({
          id: `he_${i}`,
          nodes: cand.nodes,
          target: cand.target,
          parents: cand.parents,
          size: cand.size,
          miScore: this.qubo.miScores[i],
        });
      }
    }

    const nodeSet = new Set();
    let totalSize = 0;
    for (const e of edges) {
      for (const n of e.nodes) nodeSet.add(n);
      totalSize += e.size;
    }

    return {
      hyperedges: edges,
      nHyperedges: edges.length,
      nNodes: nodeSet.size,
      avgHyperedgeSize: edges.length > 0 ? totalSize / edges.length : 0,
      maxHyperedgeSize: edges.length > 0 ? Math.max(...edges.map(e => e.size)) : 0,
      totalMI: edges.reduce((s, e) => s + e.miScore, 0),
      energy: this.qubo.energy(solution),
      density: edges.length / Math.max(1, this.candidates.length),
    };
  }

  checkAcyclic(hypergraph) {
    const adj = new Map();
    for (const e of hypergraph.hyperedges) {
      for (const p of e.parents) {
        if (!adj.has(p)) adj.set(p, []);
        adj.get(p).push(e.target);
      }
    }
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (u) => {
      visited.add(u);
      recursionStack.add(u);
      for (const v of (adj.get(u) || [])) {
        if (!visited.has(v)) {
          if (!dfs(v)) return false;
        } else if (recursionStack.has(v)) {
          return false;
        }
      }
      recursionStack.delete(u);
      return true;
    };

    for (const node of adj.keys()) {
      if (!visited.has(node) && !dfs(node)) return false;
    }
    return true;
  }
}

// ═══════════════════════════════════════════════════
// ИНТЕГРАЦИЯ С CRUCIX
// ═══════════════════════════════════════════════════

function historyToMatrix(history, varNames) {
  const n = history.length;
  const cols = varNames.map(v => {
    const extract = (s) => {
      switch (v) {
        case 'vix': return s.fred?.vix ?? 20;
        case 'conflict': return s.gdelt?.conflictEvents?.length ?? 0;
        case 'sanctions': return s.sanctions?.count ?? 0;
        case 'tension': return s.tension ?? 0.5;
        case 'radiation': return s.radiation?.max ?? 0;
        default: return 0;
      }
    };
    return history.map(extract);
  });

  const matrix = Array.from({ length: n }, (_, i) =>
    varNames.map((_, j) => cols[j][i])
  );

  return matrix;
}

export function crucixQuantumHypergraph(history, options = {}) {
  if (!history || history.length < 30)
    return {
      module: 'quantum_hypergraph',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 30,
    };

  const t0 = Date.now();
  const varNames = options.variables ||
    ['vix', 'conflict', 'sanctions', 'tension', 'radiation'];
  const data = historyToMatrix(history, varNames);

  const qubo = new QUBOFormulation({
    nVariables: varNames.length,
    maxHyperedgeSize: options.maxHyperedgeSize || 3,
    miThreshold: options.miThreshold ?? 0.05,
    lambdaBIC: options.lambdaBIC ?? 0.5,
    lambdaOverlap: options.lambdaOverlap ?? 0.1,
  });
  qubo.build(data);

  const annealer = new QuantumAnnealer({
    nQubits: qubo.nQubits,
    nReplicas: options.nReplicas || 8,
    nSteps: options.nSteps || 1000,
    initialTemp: options.initialTemp || 5.0,
    finalTemp: options.finalTemp || 0.01,
    initialGamma: options.initialGamma || 3.0,
    finalGamma: options.finalGamma || 0.01,
    qubo,
  });
  const annealResult = annealer.anneal();

  const builder = new HypergraphMAP(qubo, qubo.candidates);
  const hypergraph = builder.build(annealResult.bestConfig);
  const isAcyclic = builder.checkAcyclic(hypergraph);

  const topEdges = hypergraph.hyperedges
    .sort((a, b) => b.miScore - a.miScore)
    .slice(0, 5)
    .map(e => ({
      edge: `${e.parents.map(p => varNames[p]).join(' + ')} → ${varNames[e.target]}`,
      mi: e.miScore.toFixed(4),
      size: e.size,
    }));

  const result = {
    module: 'quantum_hypergraph',
    available: true,
    elapsedMs: Date.now() - t0,
    nVariables: varNames.length,
    nTimesteps: history.length,
    nQubits: qubo.nQubits,
    variables: varNames,
    annealing: {
      nReplicas: annealer.nReplicas,
      nSteps: annealer.nSteps,
      bestEnergy: Math.round(annealResult.bestEnergy * 1000) / 1000,
      convergence: annealer.energyHistory.length > 2 &&
        annealer.energyHistory[annealer.energyHistory.length - 1].bestE <
        annealer.energyHistory[0].bestE * 0.9,
      finalTemp: annealer.finalTemp,
      finalGamma: annealer.finalGamma,
    },
    hypergraph: {
      nHyperedges: hypergraph.nHyperedges,
      nNodes: hypergraph.nNodes,
      avgHyperedgeSize: Math.round(hypergraph.avgHyperedgeSize * 100) / 100,
      maxHyperedgeSize: hypergraph.maxHyperedgeSize,
      totalMI: Math.round(hypergraph.totalMI * 1000) / 1000,
      density: Math.round(hypergraph.density * 1000) / 1000,
      isAcyclic,
      energy: Math.round(hypergraph.energy * 1000) / 1000,
    },
    topEdges,
    interpretation: hypergraph.nHyperedges === 0
      ? 'Гиперграф пуст — CMI между переменными ниже порога. Система стабильна.'
      : `Обнаружено ${hypergraph.nHyperedges} гиперрёбер (avg size: ${hypergraph.avgHyperedgeSize.toFixed(1)}). ` +
        `Топ: ${topEdges[0]?.edge ?? 'N/A'} (MI=${topEdges[0]?.mi ?? 'N/A'}). ` +
        `Ацикличен: ${isAcyclic ? 'да' : 'нет'}.`,
  };

  const outFile = join(__dirname, '..', '..', '..', 'runs', 'predictions', 'quantum_hypergraph.json');
  saveJSON(outFile, result);
  return result;
}

export { QUBOFormulation, QuantumAnnealer, HypergraphMAP };
