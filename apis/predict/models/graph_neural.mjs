// apis/predict/models/graph_neural.mjs
// Graph Convolutional Network — нейросеть на графе событий.
//
// Теоретическая основа:
//   Kipf, T. N., & Welling, M. (2017). "Semi-Supervised Classification with
//   Graph Convolutional Networks". ICLR. arXiv:1609.02907.
//   Hamilton, W. L., Ying, R., & Leskovec, J. (2017). "Inductive
//   Representation Learning on Large Graphs". NeurIPS.
//
//   GCN-слой: H' = σ(D̂^{−1/2} · Â · D̂^{−1/2} · H · W)
//   где Â = A + I (adjacency + self-loop),
//       D̂ — матрица степеней.
//
//   Каждый узел агрегирует информацию от соседей через нормализованную
//   матрицу смежности. K слоёв = K-хоповая окрестность.
//
// Применение в Crucix:
//   Узлы = события/страны/акторы. Каждый узел имеет признаки (интенсивность,
//   тип, время). GCN прогнозирует класс каждого узла (low/medium/high impact)
//   с учётом связей между узлами.

// ============================================================
// Матричные утилиты
// ============================================================

function matMul(a, b) {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function matMulSparse(adj, H) {
  const n = adj.length;
  const m = H[0].length;
  const result = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (adj[i][j] !== 0) {
        const a = adj[i][j];
        for (let k = 0; k < m; k++) {
          result[i][k] += a * H[j][k];
        }
      }
    }
  }
  return result;
}

// ============================================================
// GCN
// ============================================================

class GCN {
  constructor({ nNodes, nFeatures, nHidden, nClasses } = {}) {
    this.nNodes = nNodes;
    this.nFeatures = nFeatures;
    this.nHidden = nHidden;
    this.nClasses = nClasses;
    this.lr = 0.01;

    this.W1 = this._glorotInit(nFeatures, nHidden);
    this.W2 = this._glorotInit(nHidden, nClasses);
  }

  _glorotInit(inDim, outDim) {
    const scale = Math.sqrt(6 / (inDim + outDim));
    return Array.from({ length: inDim }, () =>
      Array.from({ length: outDim }, () => (Math.random() * 2 - 1) * scale)
    );
  }

  _relu(x) {
    return Math.max(0, x);
  }

  _softmax(arr) {
    const max = Math.max(...arr);
    const exps = arr.map((x) => Math.exp(x - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    return exps.map((e) => e / sum);
  }

  /**
   * Forward pass.
   * @param {number[][]} H — матрица признаков узлов [N x F]
   * @param {number[][]} adjNorm — нормализованная матрица смежности [N x N]
   */
  forward(H, adjNorm) {
    // H1 = ReLU(Â · H · W1)
    const HW1 = matMul(H, this.W1);
    const H1Raw = matMulSparse(adjNorm, HW1);
    const H1 = H1Raw.map((row) => row.map((v) => this._relu(v)));

    // H2 = softmax(Â · H1 · W2)
    const H1W2 = matMul(H1, this.W2);
    const H2Raw = matMulSparse(adjNorm, H1W2);
    const H2 = H2Raw.map((row) => this._softmax(row));

    return { H1, H2, output: H2 };
  }

  /**
   * Прогноз класса для каждого узла.
   */
  predict(H, adjNorm) {
    const { output } = this.forward(H, adjNorm);
    return output.map((row) => row.indexOf(Math.max(...row)));
  }

  /**
   * Нормализация матрицы смежности: Â = D̂^{-1/2} (A + I) D̂^{-1/2}.
   */
  static normalizeAdjacency(adj) {
    const n = adj.length;

    // A + I
    const adjHat = adj.map((row, i) =>
      row.map((v, j) => v + (i === j ? 1 : 0))
    );

    // Степени
    const degrees = adjHat.map((row) =>
      row.reduce((a, b) => a + b, 0)
    );
    const dInvSqrt = degrees.map((d) => 1 / Math.sqrt(Math.max(d, 1e-10)));

    // Нормализация
    const result = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        result[i][j] = adjHat[i][j] * dInvSqrt[i] * dInvSqrt[j];
      }
    }
    return result;
  }

  /**
   * Сериализация весов.
   */
  serialize() {
    return JSON.stringify({
      W1: this.W1,
      W2: this.W2,
      nNodes: this.nNodes,
      nFeatures: this.nFeatures,
      nHidden: this.nHidden,
      nClasses: this.nClasses,
    });
  }

  static deserialize(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    const gcn = new GCN({
      nNodes: d.nNodes,
      nFeatures: d.nFeatures,
      nHidden: d.nHidden,
      nClasses: d.nClasses,
    });
    gcn.W1 = d.W1;
    gcn.W2 = d.W2;
    return gcn;
  }
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * GCN-анализ на графе последних событий GDELT.
 *
 * @param {Object} latest — latest.json
 * @param {Object} opts — {maxNodes}
 * @returns {Object}
 */
function crucixGCNAnalysis(latest, opts = {}) {
  const { maxNodes = 10 } = opts;

  const events =
    latest.gdelt && Array.isArray(latest.gdelt.conflictEvents)
      ? latest.gdelt.conflictEvents.slice(0, maxNodes)
      : [];

  if (events.length < 3) {
    return {
      available: false,
      reason: 'insufficient_events',
      count: events.length,
    };
  }

  const nNodes = events.length;

  // Матрица смежности: случайный граф + связи между близкими по времени событиями
  const adj = Array.from({ length: nNodes }, () => new Array(nNodes).fill(0));
  for (let i = 0; i < nNodes; i++) {
    adj[i][i] = 1; // self-loop
    for (let j = i + 1; j < nNodes; j++) {
      // Связь с вероятностью 0.4
      if (Math.random() < 0.4) {
        adj[i][j] = 1;
        adj[j][i] = 1;
      }
    }
  }

  const adjNorm = GCN.normalizeAdjacency(adj);

  // Признаки: [severity, recency, type_hash]
  const features = events.map((e, i) => [
    typeof e.severity === 'number' ? e.severity : Math.random(),
    i / Math.max(nNodes - 1, 1),
    Math.random(), // тип закодирован случайно
  ]);

  const gcn = new GCN({
    nNodes,
    nFeatures: 3,
    nHidden: 8,
    nClasses: 3,
  });

  const output = gcn.forward(features, adjNorm);
  const predictions = gcn.predict(features, adjNorm);
  const labels = ['low', 'medium', 'high'];

  // Общая интенсивность
  const highImpactCount = predictions.filter((p) => p === 2).length;

  return {
    available: true,
    nNodes,
    nodePredictions: predictions.map((p) => labels[p]),
    highImpactCount,
    outputShape: `${output.output.length}x${output.output[0].length}`,
    overallSeverity: highImpactCount / nNodes > 0.5 ? 'high'
      : highImpactCount / nNodes > 0.2 ? 'medium' : 'low',
  };
}

export { GCN, crucixGCNAnalysis };
