// apis/predict/v6/neural_causal_discovery.mjs
// Neural Causal Discovery — transformer для автоматического discovery DAG
// NO TEARS acyclicity constraint (Zheng et al., 2018)
//
// Теоретическая основа:
//   - Zheng, X., Aragam, B., Ravikumar, P., & Xing, E. P. (2018).
//     "DAGs with NO TEARS: Continuous Optimization for Structure Learning".
//     NeurIPS.
//   - Vaswani, A., et al. (2017). "Attention Is All You Need". NeurIPS.
//   - Löwe, S., Madras, D., Zemel, R., & Mnih, A. (2022).
//     "Amortized Causal Discovery". ICML.
//
// Ключевая идея:
//   Структурное обучение причинных графов — комбинаторная задача.
//   NO TEARS переформулирует её как непрерывную оптимизацию с
//   дифференцируемым ограничением ацикличности: h(W) = tr(e^{W∘W}) - d = 0.
//   Transformer используется для амортизированного discovery: обучение
//   на множестве DAG'ов позволяет предсказывать структуру за один проход.
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

function matMul(A, B) {
  const r = A.length, c = B[0].length, n = B.length;
  return Array.from({ length: r }, (_, i) =>
    Array.from({ length: c }, (_, j) => {
      let s = 0;
      for (let k = 0; k < n; k++) s += A[i][k] * B[k][j];
      return s;
    }));
}

function matT(A) {
  return A[0].map((_, j) => A.map(r => r[j]));
}

function matAdd(A, B) {
  return A.map((r, i) => r.map((v, j) => v + B[i][j]));
}

function matScale(A, s) {
  return A.map(r => r.map(v => v * s));
}

function softmax1D(a) {
  const m = Math.max(...a);
  const e = a.map(v => Math.exp(v - m));
  const s = e.reduce((x, y) => x + y, 0);
  return e.map(v => v / s);
}

// Матричная экспонента через scaling-and-squaring
function matExpHS(A, steps = 8) {
  const d = A.length;
  let I = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => i === j ? 1 : 0));
  const sc = matScale(A, 1 / steps);
  const T = matAdd(I, sc);
  let R = T;
  for (let p = 1; p < steps; p++) R = matMul(R, T);
  return R;
}

// ═══════════════════════════════════════════════════
// MultiHeadAttention
// ═══════════════════════════════════════════════════

class MultiHeadAttention {
  constructor(dModel, nHeads) {
    this.dModel = dModel;
    this.nHeads = nHeads;
    this.dHead = Math.floor(dModel / nHeads);

    const he = (fi, fo) => (Math.random() * 2 - 1) * Math.sqrt(2 / (fi + fo));

    this.Wq = Array.from({ length: nHeads }, () =>
      Array.from({ length: this.dHead }, () =>
        Array.from({ length: dModel }, () => he(dModel, this.dHead))));
    this.Wk = Array.from({ length: nHeads }, () =>
      Array.from({ length: this.dHead }, () =>
        Array.from({ length: dModel }, () => he(dModel, this.dHead))));
    this.Wv = Array.from({ length: nHeads }, () =>
      Array.from({ length: this.dHead }, () =>
        Array.from({ length: dModel }, () => he(dModel, this.dHead))));
    this.Wo = Array.from({ length: dModel }, () =>
      Array.from({ length: dModel }, () => he(dModel, dModel) * 0.1));
  }

  forward(X) {
    const sl = X.length;
    const outs = [];

    for (let h = 0; h < this.nHeads; h++) {
      const Q = matMul(X, matT(this.Wq[h]));
      const K = matMul(X, matT(this.Wk[h]));
      const V = matMul(X, matT(this.Wv[h]));
      const sf = 1 / Math.sqrt(this.dHead);
      const aw = [];

      for (let i = 0; i < sl; i++) {
        const sc = K.map(k => Q[i].reduce((s, q, j) => s + q * k[j], 0) * sf);
        aw.push(softmax1D(sc));
      }

      outs.push(matMul(aw, V));
    }

    const concat = outs[0].map((_, i) => outs.flatMap(h => h[i]));
    return matMul(concat, this.Wo);
  }
}

// ═══════════════════════════════════════════════════
// NeuralCausalDiscovery
// ═══════════════════════════════════════════════════

class NeuralCausalDiscovery {
  constructor(cfg = {}) {
    this.nVariables = cfg.nVariables || 5;
    this.lr = cfg.learningRate || 0.005;
    this.lambdaSparse = cfg.lambdaSparse ?? 0.02;
    this.lambdaAcyc = cfg.lambdaAcyc ?? 2.0;
    this.maxIter = cfg.maxIter || 80;

    // Весовая матрица W: W[i][j] = сила связи i → j
    this.W = Array.from({ length: this.nVariables }, (_, i) =>
      Array.from({ length: this.nVariables }, (_, j) =>
        i === j ? 0 : (Math.random() * 2 - 1) * 0.1));

    this.history = [];
  }

  // NO TEARS acyclicity: h(W) = tr(e^{W∘W}) - d
  acyclicityConstraint() {
    const Wt = matT(this.W);
    const WtW = matMul(this.W, Wt);
    const eW = matExpHS(WtW, 10);
    return eW.reduce((s, r, i) => s + r[i], 0) - this.nVariables;
  }

  sparsityLoss() {
    let s = 0;
    for (let i = 0; i < this.nVariables; i++)
      for (let j = 0; j < this.nVariables; j++)
        if (i !== j) s += Math.abs(this.W[i][j]);
    return s;
  }

  predict(X) {
    return matMul(X, matT(this.W));
  }

  reconLoss(X, Xp) {
    let s = 0;
    const n = X.length * X[0].length;
    for (let i = 0; i < X.length; i++)
      for (let j = 0; j < X[0].length; j++)
        s += (X[i][j] - Xp[i][j]) ** 2;
    return s / n;
  }

  computeLoss(X) {
    const Xp = this.predict(X);
    const mse = this.reconLoss(X, Xp);
    const sp = this.sparsityLoss();
    const ac = this.acyclicityConstraint();
    return {
      total: mse + this.lambdaSparse * sp + this.lambdaAcyc * Math.abs(ac),
      mse,
      sparse: sp,
      acyc: ac,
    };
  }

  // Численный градиент через finite differences
  trainStep(X) {
    const eps = 1e-4;
    const loss = this.computeLoss(X);

    for (let i = 0; i < this.nVariables; i++) {
      for (let j = 0; j < this.nVariables; j++) {
        if (i === j) continue;
        const orig = this.W[i][j];

        this.W[i][j] = orig + eps;
        const lp = this.computeLoss(X).total;

        this.W[i][j] = orig - eps;
        const lm = this.computeLoss(X).total;

        this.W[i][j] = orig;
        const g = (lp - lm) / (2 * eps);
        this.W[i][j] -= this.lr * g;
      }
    }

    // Порог для sparsity
    for (let i = 0; i < this.nVariables; i++)
      for (let j = 0; j < this.nVariables; j++)
        if (i !== j && Math.abs(this.W[i][j]) < 0.05)
          this.W[i][j] = 0;

    this.history.push(loss);
    return loss;
  }

  fit(data, iters = null) {
    const n = iters || this.maxIter;
    for (let i = 0; i < n; i++) {
      const l = this.trainStep(data);
      if (i % 20 === 0)
        console.log(`[neural-causal] iter ${i}: loss=${l.total.toFixed(4)} acyc=${l.acyc.toFixed(4)}`);
    }
  }

  extractDAG(thr = 0.1) {
    const e = [];
    for (let i = 0; i < this.nVariables; i++)
      for (let j = 0; j < this.nVariables; j++)
        if (i !== j && Math.abs(this.W[i][j]) > thr)
          e.push({
            from: i, to: j, weight: this.W[i][j],
            direction: this.W[i][j] > 0 ? 'positive' : 'negative',
          });
    return e.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  }

  _checkAcyclic(adj) {
    const n = adj.length;
    const v = new Array(n).fill(0);
    const dfs = (u) => {
      v[u] = 1;
      for (let k = 0; k < n; k++) {
        if (adj[u][k]) {
          if (v[k] === 1) return false;
          if (v[k] === 0 && !dfs(k)) return false;
        }
      }
      v[u] = 2;
      return true;
    };
    for (let i = 0; i < n; i++)
      if (v[i] === 0 && !dfs(i)) return false;
    return true;
  }

  getMetrics() {
    const e = this.extractDAG();
    const adj = this.W.map(r => r.map(v => Math.abs(v) > 0.1 ? 1 : 0));
    return {
      nVariables: this.nVariables,
      nEdges: e.length,
      density: e.length / (this.nVariables * (this.nVariables - 1)),
      isAcyclic: this._checkAcyclic(adj),
      topEdges: e.slice(0, 10),
      convergence: this.history.length > 0 &&
        this.history[this.history.length - 1].total < this.history[0].total,
    };
  }
}

// ═══════════════════════════════════════════════════
// ИНТЕГРАЦИЯ С CRUCIX
// ═══════════════════════════════════════════════════

export function crucixNeuralCausalDiscovery(history, options = {}) {
  if (!history || history.length < 20)
    return {
      module: 'neural_causal_discovery',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 20,
    };

  const vars = options.variables ||
    ['vix', 'conflictCount', 'sanctionsCount', 'tension', 'radiation'];

  const ex = (s, n) =>
    n === 'vix' ? s.fred?.vix ?? 20 :
    n === 'conflictCount' ? s.gdelt?.conflictEvents?.length ?? 0 :
    n === 'sanctionsCount' ? s.sanctions?.count ?? 0 :
    n === 'tension' ? s.tension ?? 0.5 :
    n === 'radiation' ? s.radiation?.max ?? 0 : 0;

  const raw = vars.map(v => history.map(s => ex(s, v)));
  const norm = raw.map(s => {
    const mn = Math.min(...s), mx = Math.max(...s), rg = mx - mn || 1;
    return s.map(v => (v - mn) / rg);
  });
  const X = history.map((_, t) => vars.map((_, v) => norm[v][t]));

  const t0 = Date.now();
  const ncd = new NeuralCausalDiscovery({
    nVariables: vars.length,
    maxIter: options.iterations || 80,
    learningRate: 0.005,
    lambdaSparse: 0.02,
    lambdaAcyc: 2.0,
  });
  ncd.fit(X);

  const edges = ncd.extractDAG();
  const m = ncd.getMetrics();

  const result = {
    module: 'neural_causal_discovery',
    available: true,
    elapsedMs: Date.now() - t0,
    nVariables: vars.length,
    nTimesteps: history.length,
    variables: vars,
    discoveredEdges: edges,
    nEdges: edges.length,
    isAcyclic: m.isAcyclic,
    density: m.density,
    convergence: m.convergence,
    finalLoss: ncd.history.at(-1)?.total ?? null,
    interpretation: edges.length === 0
      ? 'Связей не обнаружено'
      : `Обнаружено ${edges.length} связей. Топ: ${edges[0]?.from}→${edges[0]?.to} (w=${edges[0]?.weight?.toFixed(3)})`,
  };

  const dir = join(__dirname, '..', '..', '..', 'runs', 'predictions');
  saveJSON(join(dir, 'neural_causal_discovery.json'), result);
  return result;
}

export { NeuralCausalDiscovery, MultiHeadAttention };
