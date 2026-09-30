// apis/predict/anomaly_detection.mjs
// Anomaly Detection для прогностического слоя Crucix
// Пять методов + ансамбль: Isolation Forest, LOF, Mahalanobis,
// One-Class SVM (RBF), DBSCAN
//
// Теоретическая основа:
//   Isolation Forest:
//     - Liu, F. T., Ting, K. M., & Zhou, Z. H. (2008). "Isolation Forest".
//       ICDM 2008.
//     - Liu, F. T., Ting, K. M., & Zhou, Z. H. (2012). "Isolation-Based
//       Anomaly Detection". ACM TKDD.
//
//   LOF (Local Outlier Factor):
//     - Breunig, M. M., Kriegel, H. P., Ng, R. T., & Sander, J. (2000).
//       "LOF: Identifying Density-Based Local Outliers". SIGMOD 2000.
//
//   Mahalanobis:
//     - Mahalanobis, P. C. (1936). "On the generalised distance in
//       statistics". Proceedings of the National Institute of Sciences
//       of India.
//
//   One-Class SVM (упрощённый через RBF):
//     - Schölkopf, B., et al. (2001). "Estimating the support of a
//       high-dimensional distribution". Neural Computation.
//
//   DBSCAN:
//     - Ester, M., Kriegel, H. P., Sander, J., & Xu, X. (1996).
//       "A density-based algorithm for discovering clusters in large
//       spatial databases with noise". KDD 1996.
//
// Ансамбль:
//   - Голосование пяти детекторов (majority >= 2).
//   - Взвешенный скор по каждому детектору.
//   - Объяснение аномалий через z-score признаков.
//
// Версия: 6.0.0

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

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

function euclidean(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

function quantile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function standardize(X) {
  if (X.length === 0) return { X: [], means: [], stds: [] };
  const n = X.length;
  const d = X[0].length;
  const means = new Array(d).fill(0);
  const stds = new Array(d).fill(0);

  for (let j = 0; j < d; j++) {
    const col = X.map(row => row[j]);
    means[j] = mean(col);
    stds[j] = std(col) || 1;
  }

  const Xs = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));
  return { X: Xs, means, stds };
}

/**
 * Обращение матрицы через Gauss-Jordan с частичным пивотированием.
 */
function matInverse(A) {
  const n = A.length;
  const M = A.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[maxRow][i])) maxRow = k;
    }
    [M[i], M[maxRow]] = [M[maxRow], M[i]];
    if (Math.abs(M[i][i]) < 1e-12) M[i][i] += 1e-8;

    const pivot = M[i][i];
    for (let j = 0; j < 2 * n; j++) M[i][j] /= pivot;

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = M[k][i];
      for (let j = 0; j < 2 * n; j++) M[k][j] -= factor * M[i][j];
    }
  }

  return M.map(row => row.slice(n));
}

/**
 * Ковариационная матрица + средние.
 */
function covarianceMatrix(X) {
  const n = X.length;
  const d = X[0].length;
  const means = new Array(d).fill(0);
  for (let j = 0; j < d; j++) {
    means[j] = mean(X.map(row => row[j]));
  }

  const C = Array.from({ length: d }, () => new Array(d).fill(0));
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += (X[k][i] - means[i]) * (X[k][j] - means[j]);
      }
      C[i][j] = sum / (n - 1 || 1);
    }
  }

  return { matrix: C, means };
}

// ═══════════════════════════════════════════════════
// 1. ISOLATION FOREST
// ═══════════════════════════════════════════════════

class ITreeNode {
  constructor(depth, size) {
    this.depth = depth;
    this.size = size;
    this.feature = null;
    this.threshold = null;
    this.left = null;
    this.right = null;
  }

  get isLeaf() {
    return this.left === null && this.right === null;
  }
}

function buildITree(X, depth, maxDepth) {
  const node = new ITreeNode(depth, X.length);

  if (depth >= maxDepth || X.length <= 1) return node;

  const d = X[0].length;
  const feature = Math.floor(Math.random() * d);
  const values = X.map(row => row[feature]);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  if (minV === maxV) return node;

  const threshold = minV + Math.random() * (maxV - minV);
  const left = [];
  const right = [];

  for (const row of X) {
    if (row[feature] < threshold) left.push(row);
    else right.push(row);
  }

  if (left.length === 0 || right.length === 0) return node;

  node.feature = feature;
  node.threshold = threshold;
  node.left = buildITree(left, depth + 1, maxDepth);
  node.right = buildITree(right, depth + 1, maxDepth);

  return node;
}

function pathLength(x, node, depth = 0) {
  if (node.isLeaf) return depth + cFactor(node.size);
  if (x[node.feature] < node.threshold) return pathLength(x, node.left, depth + 1);
  return pathLength(x, node.right, depth + 1);
}

function cFactor(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
}

class IsolationForest {
  constructor(config = {}) {
    this.nTrees = config.nTrees || 100;
    this.sampleSize = config.sampleSize || 256;
    this.contamination = config.contamination ?? 0.05;
    this.trees = [];
    this.threshold = 0;
    this.trained = false;
  }

  fit(X) {
    if (X.length < 2) {
      this.trees = [];
      this.trained = false;
      return this;
    }

    const n = X.length;
    const sampleSize = Math.min(this.sampleSize, n);
    const maxDepth = Math.ceil(Math.log2(sampleSize));
    this.maxDepth = maxDepth;

    this.trees = [];
    for (let i = 0; i < this.nTrees; i++) {
      const sample = [];
      for (let j = 0; j < sampleSize; j++) {
        sample.push(X[Math.floor(Math.random() * n)]);
      }
      this.trees.push(buildITree(sample, 0, maxDepth));
    }

    const scores = X.map(x => this._score(x));
    this.threshold = quantile(scores, 1 - this.contamination);
    this.trained = true;

    return this;
  }

  _score(x) {
    if (this.trees.length === 0) return 0.5;
    const avgPath = mean(this.trees.map(t => pathLength(x, t)));
    const c = cFactor(this.sampleSize);
    return Math.pow(2, -avgPath / Math.max(c, 1e-10));
  }

  predictOne(x) {
    const score = this._score(x);
    return {
      score,
      isAnomaly: score > this.threshold,
      threshold: this.threshold,
    };
  }

  predict(X) {
    return X.map(x => this.predictOne(x));
  }
}

// ═══════════════════════════════════════════════════
// 2. LOCAL OUTLIER FACTOR (LOF)
// ═══════════════════════════════════════════════════

class LocalOutlierFactor {
  constructor(config = {}) {
    this.k = config.k || 20;
    this.X = null;
    this.lofValues = null;
    this.lrd = null;
    this.kDistances = null;
    this.kNeighbors = null;
    this.threshold = 1.5;
  }

  fit(X) {
    this.X = X;
    const n = X.length;
    const k = Math.min(this.k, n - 1);

    if (k < 1) {
      this.lofValues = new Array(n).fill(1);
      return this;
    }

    this.kDistances = new Array(n);
    this.kNeighbors = new Array(n);

    for (let i = 0; i < n; i++) {
      const distances = [];
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        distances.push({ j, d: euclidean(X[i], X[j]) });
      }
      distances.sort((a, b) => a.d - b.d);
      this.kDistances[i] = distances[k - 1].d;
      this.kNeighbors[i] = distances.slice(0, k);
    }

    this.lrd = new Array(n);
    for (let i = 0; i < n; i++) {
      let sumReach = 0;
      for (const { j, d } of this.kNeighbors[i]) {
        sumReach += Math.max(this.kDistances[j], d);
      }
      this.lrd[i] = this.kNeighbors[i].length / Math.max(sumReach, 1e-10);
    }

    this.lofValues = new Array(n);
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (const { j } of this.kNeighbors[i]) {
        sum += this.lrd[j] / Math.max(this.lrd[i], 1e-10);
      }
      this.lofValues[i] = sum / Math.max(this.kNeighbors[i].length, 1);
    }

    this.threshold = quantile(this.lofValues, 0.95);
    return this;
  }

  scoreOne(x) {
    if (!this.X) return 1;
    const n = this.X.length;
    const k = Math.min(this.k, n);

    const distances = this.X.map((xi, j) => ({ j, d: euclidean(x, xi) }));
    distances.sort((a, b) => a.d - b.d);
    const neighbors = distances.slice(0, k);

    let sumReach = 0;
    for (const { j, d } of neighbors) {
      sumReach += Math.max(this.kDistances[j], d);
    }
    const lrdX = k / Math.max(sumReach, 1e-10);

    let sumRatio = 0;
    for (const { j } of neighbors) {
      sumRatio += this.lrd[j] / Math.max(lrdX, 1e-10);
    }
    return sumRatio / k;
  }

  predictOne(x) {
    const lof = this.scoreOne(x);
    return { lof, isAnomaly: lof > this.threshold, threshold: this.threshold };
  }

  predict(X) {
    return X.map(x => this.predictOne(x));
  }
}

// ═══════════════════════════════════════════════════
// 3. MAHALANOBIS DISTANCE
// ═══════════════════════════════════════════════════

class MahalanobisDetector {
  constructor(config = {}) {
    this.contamination = config.contamination ?? 0.05;
    this.meanVec = null;
    this.covMatrix = null;
    this.covInv = null;
    this.threshold = 0;
  }

  fit(X) {
    if (X.length < 3) return this;

    const { matrix, means } = covarianceMatrix(X);

    const d = matrix.length;
    const regularized = matrix.map((row, i) =>
      row.map((v, j) => v + (i === j ? 1e-6 : 0))
    );

    this.meanVec = means;
    this.covMatrix = regularized;

    try {
      this.covInv = matInverse(regularized);
    } catch (e) {
      this.covInv = regularized.map((row, i) =>
        row.map((_, j) => i === j ? 1 / Math.max(regularized[i][i], 1e-6) : 0)
      );
    }

    const distances = X.map(x => this._distance(x));
    this.threshold = quantile(distances, 1 - this.contamination);

    return this;
  }

  _distance(x) {
    if (!this.covInv) return 0;
    const d = x.length;
    const diff = x.map((xi, i) => xi - this.meanVec[i]);

    let sum = 0;
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        sum += diff[i] * this.covInv[i][j] * diff[j];
      }
    }
    return Math.sqrt(Math.max(sum, 0));
  }

  predictOne(x) {
    const distance = this._distance(x);
    return { distance, isAnomaly: distance > this.threshold, threshold: this.threshold };
  }

  predict(X) {
    return X.map(x => this.predictOne(x));
  }
}

// ═══════════════════════════════════════════════════
// 4. ONE-CLASS SVM (RBF approximation)
// ═══════════════════════════════════════════════════

class OneClassSVM {
  constructor(config = {}) {
    this.gamma = config.gamma ?? 0.1;
    this.contamination = config.contamination ?? 0.05;
    this.supportVectors = null;
    this.threshold = 0;
  }

  fit(X) {
    const maxSV = 100;
    this.supportVectors = X.length <= maxSV ? X : this._subsample(X, maxSV);

    const scores = X.map(x => this._score(x));
    this.threshold = quantile(scores, this.contamination);

    return this;
  }

  _subsample(X, n) {
    const indices = new Set();
    while (indices.size < n) {
      indices.add(Math.floor(Math.random() * X.length));
    }
    return [...indices].map(i => X[i]);
  }

  _score(x) {
    if (!this.supportVectors) return 0;
    let sum = 0;
    for (const sv of this.supportVectors) {
      const dist2 = sv.reduce((s, v, i) => s + (v - x[i]) ** 2, 0);
      sum += Math.exp(-this.gamma * dist2);
    }
    return sum / this.supportVectors.length;
  }

  predictOne(x) {
    const score = this._score(x);
    return { score, isAnomaly: score < this.threshold, threshold: this.threshold };
  }

  predict(X) {
    return X.map(x => this.predictOne(x));
  }
}

// ═══════════════════════════════════════════════════
// 5. DBSCAN-BASED OUTLIER DETECTION
// ═══════════════════════════════════════════════════

class DBSCANOutlier {
  constructor(config = {}) {
    this.eps = config.eps ?? 1;
    this.minPts = config.minPts ?? 5;
    this.labels = null;
    this.clusters = 0;
  }

  fit(X) {
    const n = X.length;
    const labels = new Array(n).fill(-1);
    let clusterId = 0;

    const visited = new Array(n).fill(false);

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      visited[i] = true;

      const neighbors = this._regionQuery(X, i);

      if (neighbors.length < this.minPts) {
        labels[i] = -1;
      } else {
        this._expandCluster(X, labels, i, neighbors, clusterId, visited);
        clusterId++;
      }
    }

    this.labels = labels;
    this.clusters = clusterId;
    return this;
  }

  _regionQuery(X, i) {
    const neighbors = [];
    for (let j = 0; j < X.length; j++) {
      if (euclidean(X[i], X[j]) <= this.eps) neighbors.push(j);
    }
    return neighbors;
  }

  _expandCluster(X, labels, i, neighbors, clusterId, visited) {
    labels[i] = clusterId;
    const queue = [...neighbors];

    while (queue.length > 0) {
      const j = queue.shift();
      if (!visited[j]) {
        visited[j] = true;
        const newNeighbors = this._regionQuery(X, j);
        if (newNeighbors.length >= this.minPts) {
          for (const k of newNeighbors) {
            if (!queue.includes(k) && labels[k] === -1) queue.push(k);
          }
        }
      }
      if (labels[j] === -1) labels[j] = clusterId;
    }
  }

  isOutlier(i) {
    return this.labels && this.labels[i] === -1;
  }
}

// ═══════════════════════════════════════════════════
// 6. АНСАМБЛЬ
// ═══════════════════════════════════════════════════

class AnomalyEnsemble {
  constructor(config = {}) {
    this.contamination = config.contamination ?? 0.05;
    this.isolationForest = new IsolationForest({ contamination: this.contamination });
    this.lof = new LocalOutlierFactor({ k: config.lofK || 20 });
    this.mahalanobis = new MahalanobisDetector({ contamination: this.contamination });
    this.oneClassSVM = new OneClassSVM({ contamination: this.contamination });
    this.dbscan = new DBSCANOutlier({
      eps: config.dbscanEps || 1.5,
      minPts: config.dbscanMinPts || 5,
    });
    this.trained = false;
  }

  fit(X) {
    this.isolationForest.fit(X);
    this.lof.fit(X);
    this.mahalanobis.fit(X);
    this.oneClassSVM.fit(X);
    this.dbscan.fit(X);
    this.trained = true;
    return this;
  }

  predictOne(x, dbscanIndex = null) {
    const ifResult = this.isolationForest.predictOne(x);
    const lofResult = this.lof.predictOne(x);
    const mahResult = this.mahalanobis.predictOne(x);
    const svmResult = this.oneClassSVM.predictOne(x);
    const dbResult = dbscanIndex !== null
      ? { isAnomaly: this.dbscan.isOutlier(dbscanIndex) }
      : { isAnomaly: false };

    const votes = [
      ifResult.isAnomaly,
      lofResult.isAnomaly,
      mahResult.isAnomaly,
      svmResult.isAnomaly,
      dbResult.isAnomaly,
    ].filter(Boolean).length;

    const avgScore = (
      ifResult.score * 0.3 +
      Math.min(1, lofResult.lof / 2) * 0.25 +
      Math.min(1, mahResult.distance / 5) * 0.2 +
      (1 - svmResult.score) * 0.15 +
      (dbResult.isAnomaly ? 1 : 0) * 0.1
    );

    return {
      isAnomaly: votes >= 2,
      votes,
      totalDetectors: 5,
      avgScore,
      details: {
        isolationForest: ifResult,
        lof: lofResult,
        mahalanobis: mahResult,
        oneClassSVM: svmResult,
        dbscan: dbResult,
      },
    };
  }

  predict(X) {
    return X.map((x, i) => this.predictOne(x, i));
  }
}

// ═══════════════════════════════════════════════════
// 7. ИНТЕГРАЦИЯ С CRUCIX
// ═══════════════════════════════════════════════════

function sweepToFeatureVector(s) {
  return [
    (s.fred?.vix ?? 20) / 50,
    (s.fred?.hySpread ?? 3) / 10,
    (s.fred?.treasury10y ?? 4) / 6,
    (s.gdelt?.conflictEvents?.length ?? 0) / 20,
    (s.sanctions?.count ?? 0) / 10,
    (s.energy?.oilPrice ?? 70) / 120,
    (s.gold?.price ?? 1900) / 2200,
    (s.dxy?.value ?? 100) / 110,
    (s.radiation ? Math.max(...Object.values(s.radiation).map(r => r.cpm || 0)) : 0) / 200,
    (s.delta?.newAlerts ?? 0) / 10,
    (s.delta?.escalatedAlerts ?? 0) / 5,
  ];
}

export function crucixAnomalyDetection(history, options = {}) {
  if (!history || history.length < 20) {
    return {
      module: 'anomaly_detection',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 20,
      actual: history.length,
    };
  }

  const t0 = Date.now();
  console.log(`[anomaly_detection] Запуск на ${history.length} sweep'ах`);

  const result = {
    module: 'anomaly_detection',
    available: true,
    timestamp: new Date().toISOString(),
    nSweeps: history.length,
  };

  const X = history.map(sweepToFeatureVector);
  const { X: Xs } = standardize(X);

  const ensemble = new AnomalyEnsemble({
    contamination: options.contamination ?? 0.05,
    lofK: options.lofK || 20,
    dbscanEps: options.dbscanEps || 1.5,
    dbscanMinPts: options.dbscanMinPts || 5,
  });

  try {
    ensemble.fit(Xs);
  } catch (e) {
    result.error = `ensemble fit failed: ${e.message}`;
    result.elapsedMs = Date.now() - t0;
    return result;
  }

  const predictions = ensemble.predict(Xs);

  const ifAnomalies = predictions.filter(p => p.details.isolationForest.isAnomaly).length;
  const lofAnomalies = predictions.filter(p => p.details.lof.isAnomaly).length;
  const mahAnomalies = predictions.filter(p => p.details.mahalanobis.isAnomaly).length;
  const svmAnomalies = predictions.filter(p => p.details.oneClassSVM.isAnomaly).length;
  const dbAnomalies = predictions.filter(p => p.details.dbscan.isAnomaly).length;

  const anomalies = [];
  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i].isAnomaly) {
      anomalies.push({
        index: i,
        timestamp: history[i].timestamp,
        votes: predictions[i].votes,
        score: Math.round(predictions[i].avgScore * 1000) / 1000,
        features: X[i].map(v => Math.round(v * 100) / 100),
      });
    }
  }

  const lastPrediction = predictions[predictions.length - 1];

  const topAnomalies = [...predictions]
    .map((p, i) => ({ index: i, ...p }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 5)
    .map(p => ({
      index: p.index,
      timestamp: history[p.index].timestamp,
      score: Math.round(p.avgScore * 1000) / 1000,
      votes: p.votes,
    }));

  let anomalyExplanation = null;
  if (lastPrediction.isAnomaly) {
    const lastVec = Xs[Xs.length - 1];
    const featureNames = [
      'vix', 'hySpread', 'treasury10y', 'conflicts', 'sanctions',
      'oilPrice', 'goldPrice', 'dxy', 'radiation', 'newAlerts', 'escalatedAlerts',
    ];
    const deviations = lastVec.map((z, j) => ({
      feature: featureNames[j],
      zScore: Math.round(z * 100) / 100,
      rawValue: X[X.length - 1][j],
    })).sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));

    anomalyExplanation = {
      topDeviations: deviations.slice(0, 5),
      interpretation: `Последний sweep аномален. Отклонения: ${deviations.slice(0, 3).map(d => `${d.feature} (z=${d.zScore})`).join(', ')}`,
    };
  }

  result.summary = {
    nAnomalies: anomalies.length,
    anomalyRate: Math.round(anomalies.length / history.length * 1000) / 1000,
    detectors: {
      isolationForest: ifAnomalies,
      lof: lofAnomalies,
      mahalanobis: mahAnomalies,
      oneClassSVM: svmAnomalies,
      dbscan: dbAnomalies,
    },
  };

  result.lastSweep = {
    isAnomaly: lastPrediction.isAnomaly,
    votes: lastPrediction.votes,
    score: Math.round(lastPrediction.avgScore * 1000) / 1000,
  };

  result.topAnomalies = topAnomalies;
  result.anomalies = anomalies.slice(-20);
  result.explanation = anomalyExplanation;

  result.interpretation = lastPrediction.isAnomaly
    ? `⚠ Последний sweep аномален (${lastPrediction.votes}/5 детекторов)`
    : `Нормальный режим. Всего аномалий: ${anomalies.length} (${(anomalies.length / history.length * 100).toFixed(1)}%)`;

  result.elapsedMs = Date.now() - t0;

  const dir = join(__dirname, '..', '..', 'runs', 'predictions');
  ensureDir(dir);
  saveJSON(join(dir, 'anomaly_detection.json'), result);

  console.log(`[anomaly_detection] Цикл завершён за ${result.elapsedMs}ms`);
  return result;
}

export {
  IsolationForest,
  LocalOutlierFactor,
  MahalanobisDetector,
  OneClassSVM,
  DBSCANOutlier,
  AnomalyEnsemble,
  standardize,
  covarianceMatrix,
};
