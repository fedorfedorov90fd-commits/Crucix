// apis/predict/models/graph_sage.mjs
// GraphSAGE — Inductive Representation Learning on Large Graphs
// Hamilton, Ying, Leskovec (NeurIPS 2017)
//
// Отличие от GCN:
//   GCN — transductive (нужна вся матрица смежности при обучении)
//   GraphSAGE — inductive (новые узлы эмбеддятся через те же агрегаторы)
//
// Теоретическая основа:
//   - Hamilton, W. L., Ying, R., & Leskovec, J. (2017). "Inductive
//     Representation Learning on Large Graphs". NeurIPS 2017.
//   - Hamilton, W. L., Ying, R., & Leskovec, J. (2017). "Representation
//     Learning on Graphs: Methods and Applications". IEEE Data Eng. Bull.
//
// Ключевая идея:
//   h_v^(k) = σ(W_k · CONCAT(h_v^(k-1), AGG_k({h_u^(k-1) : u ∈ N(v)})))
//
//   где AGG — агрегатор соседей (mean, LSTM, pooling, max).
//   Обучение по mini-batch узлам, а не всей матрице.
//
// Применение в Crucix:
//   - Граф стран/акторов
//   - Прогноз риска каждой страны с учётом соседей
//   - Inductive: может работать с новыми странами без переобучения
//
// Версия: 6.0.0

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

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function l2norm(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s) || 1e-10;
}

function l2normalize(v) {
  const n = l2norm(v);
  return v.map(x => x / n);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
}

function relu(x) {
  return Math.max(0, x);
}

function reluDerivative(x) {
  return x > 0 ? 1 : 0;
}

function tanh(x) {
  return Math.tanh(x);
}

function softmax(arr) {
  const m = Math.max(...arr);
  const e = arr.map(v => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

/**
 * Xavier/Glorot инициализация весов.
 */
function xavierInit(rows, cols, seed = 42) {
  const scale = Math.sqrt(6 / (rows + cols));
  const W = [];
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < rows; i++) {
    const row = new Float64Array(cols);
    for (let j = 0; j < cols; j++) {
      row[j] = (rand() * 2 - 1) * scale;
    }
    W.push(row);
  }
  return W;
}

function zerosMatrix(rows, cols) {
  return Array.from({ length: rows }, () => new Float64Array(cols));
}

function zerosVec(n) {
  return new Float64Array(n);
}

function cloneMatrix(M) {
  return M.map(row => new Float64Array(row));
}

// ═══════════════════════════════════════════════════════════════════
// АГРЕГАТОРЫ
// ═══════════════════════════════════════════════════════════════════

/**
 * Mean aggregator: усреднение признаков соседей.
 * Самый простой и быстрый. Используется по умолчанию.
 */
function meanAggregator(neighborFeatures) {
  if (neighborFeatures.length === 0) {
    const dim = 1; // fallback
    return new Float64Array(dim);
  }
  const dim = neighborFeatures[0].length;
  const result = new Float64Array(dim);
  for (const f of neighborFeatures) {
    for (let i = 0; i < dim; i++) result[i] += f[i];
  }
  for (let i = 0; i < dim; i++) result[i] /= neighborFeatures.length;
  return result;
}

/**
 * Max-pooling aggregator: поэлементный максимум после нелинейности.
 * Более выразительный, чем mean, но требует MLP.
 */
function maxPoolingAggregator(neighborFeatures, poolWeights, poolBias) {
  if (neighborFeatures.length === 0) return new Float64Array(poolWeights.length);

  const outDim = poolWeights.length;
  const inDim = neighborFeatures[0].length;
  const result = new Float64Array(outDim).fill(-Infinity);

  for (const f of neighborFeatures) {
    // MLP: h = relu(W · f + b)
    const h = new Float64Array(outDim);
    for (let o = 0; o < outDim; o++) {
      let sum = poolBias[o];
      for (let i = 0; i < inDim; i++) sum += poolWeights[o][i] * f[i];
      h[o] = relu(sum);
    }
    // Max-pool
    for (let o = 0; o < outDim; o++) {
      if (h[o] > result[o]) result[o] = h[o];
    }
  }

  return result;
}

/**
 * LSTM aggregator (упрощённый):
 * Применяем LSTM-ячейку к перемешанной последовательности соседей.
 * В полной версии — настоящий LSTM, здесь — упрощённая аппроксимация
 * через взвешенную сумму с обучаемыми весами и tanh.
 */
function lstmAggregator(neighborFeatures, W, U, b) {
  if (neighborFeatures.length === 0) return new Float64Array(W.length);

  const outDim = W.length;
  const inDim = neighborFeatures[0].length;
  let h = new Float64Array(outDim);
  let c = new Float64Array(outDim);

  // Shuffle neighbors (важно для LSTM-агрегатора)
  const shuffled = [...neighborFeatures].sort(() => Math.random() - 0.5);

  for (const f of shuffled) {
    // Упрощённый LSTM: 3 гейта
    const input = new Float64Array(outDim);
    const forget = new Float64Array(outDim);
    const output = new Float64Array(outDim);
    const candidate = new Float64Array(outDim);

    for (let o = 0; o < outDim; o++) {
      let wx = 0, uh = 0;
      for (let i = 0; i < inDim; i++) wx += W[o][i] * f[i];
      for (let i = 0; i < outDim; i++) uh += U[o][i] * h[i];
      const z = wx + uh + b[o];
      input[o] = sigmoid(z);
      forget[o] = sigmoid(z * 0.5);
      output[o] = sigmoid(z * 0.7);
      candidate[o] = tanh(z);
    }

    for (let o = 0; o < outDim; o++) {
      c[o] = forget[o] * c[o] + input[o] * candidate[o];
      h[o] = output[o] * tanh(c[o]);
    }
  }

  return h;
}

// ═══════════════════════════════════════════════════════════════════
// GRAPHSAGE СЛОЙ
// ═══════════════════════════════════════════════════════════════════

/**
 * Один слой GraphSAGE.
 * concat(h_v, AGG(N(v))) → W → σ
 */
class SAGESageLayer {
  constructor(inputDim, outputDim, aggregatorType = 'mean', seed = 42) {
    this.inputDim = inputDim;
    this.outputDim = outputDim;
    this.aggregatorType = aggregatorType;

    // W: [outputDim × (inputDim * 2)] — concat(self, agg)
    const concatDim = inputDim * 2;
    this.W = xavierInit(outputDim, concatDim, seed);
    this.b = zerosVec(outputDim);

    // Pool weights (для pooling aggregator)
    if (aggregatorType === 'pool') {
      this.poolW = xavierInit(outputDim, inputDim, seed + 100);
      this.poolB = zerosVec(outputDim);
    }

    // LSTM weights (для lstm aggregator)
    if (aggregatorType === 'lstm') {
      this.lstmW = xavierInit(outputDim, inputDim, seed + 200);
      this.lstmU = xavierInit(outputDim, outputDim, seed + 300);
      this.lstmB = zerosVec(outputDim);
    }

    // Adam state
    this.mW = zerosMatrix(outputDim, concatDim);
    this.vW = zerosMatrix(outputDim, concatDim);
    this.mb = zerosVec(outputDim);
    this.vb = zerosVec(outputDim);
    this.t = 0;
  }

  /**
   * Forward pass для одного узла.
   * @returns {Object} — { output, cache }
   */
  forward(selfFeature, neighborFeatures) {
    // 1. Агрегация соседей
    let agg;
    if (this.aggregatorType === 'mean') {
      agg = meanAggregator(neighborFeatures);
    } else if (this.aggregatorType === 'pool') {
      agg = maxPoolingAggregator(neighborFeatures, this.poolW, this.poolB);
    } else if (this.aggregatorType === 'lstm') {
      agg = lstmAggregator(neighborFeatures, this.lstmW, this.lstmU, this.lstmB);
    } else {
      agg = meanAggregator(neighborFeatures);
    }

    // 2. Concatenation [self | agg]
    const concat = new Float64Array(this.inputDim + agg.length);
    for (let i = 0; i < this.inputDim; i++) concat[i] = selfFeature[i];
    for (let i = 0; i < agg.length; i++) concat[this.inputDim + i] = agg[i];

    // 3. Linear transform + activation
    const z = new Float64Array(this.outputDim);
    for (let o = 0; o < this.outputDim; o++) {
      let sum = this.b[o];
      for (let i = 0; i < concat.length; i++) {
        sum += this.W[o][i] * concat[i];
      }
      z[o] = sum;
    }

    const output = new Float64Array(this.outputDim);
    for (let o = 0; o < this.outputDim; o++) {
      output[o] = relu(z[o]);
    }

    // L2-нормализация (важно для стабильности)
    const normalized = l2normalize(output);

    return {
      output: normalized,
      cache: {
        selfFeature,
        neighborFeatures,
        agg,
        concat,
        z,
        output,
      },
    };
  }

  /**
   * Backward pass (упрощённый — градиент по W и b).
   * В полной версии граф распространяет через агрегаторы,
   * здесь — только через линейный слой.
   */
  backward(dOutput, cache) {
    const { concat, z } = cache;
    const dW = zerosMatrix(this.outputDim, concat.length);
    const db = zerosVec(this.outputDim);
    const dConcat = new Float64Array(concat.length);

    // Через ReLU
    const dZ = new Float64Array(this.outputDim);
    for (let o = 0; o < this.outputDim; o++) {
      dZ[o] = dOutput[o] * reluDerivative(z[o]);
    }

    // dW = dZ · concat^T, db = dZ
    for (let o = 0; o < this.outputDim; o++) {
      for (let i = 0; i < concat.length; i++) {
        dW[o][i] = dZ[o] * concat[i];
      }
      db[o] = dZ[o];
    }

    // dConcat = W^T · dZ
    for (let i = 0; i < concat.length; i++) {
      let sum = 0;
      for (let o = 0; o < this.outputDim; o++) {
        sum += this.W[o][i] * dZ[o];
      }
      dConcat[i] = sum;
    }

    return { dW, db, dConcat };
  }

  /**
   * Adam update.
   */
  update(grads, lr = 0.01) {
    this.t++;
    const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
    const bc1 = 1 - Math.pow(beta1, this.t);
    const bc2 = 1 - Math.pow(beta2, this.t);

    for (let o = 0; o < this.outputDim; o++) {
      for (let i = 0; i < this.W[o].length; i++) {
        this.mW[o][i] = beta1 * this.mW[o][i] + (1 - beta1) * grads.dW[o][i];
        this.vW[o][i] = beta2 * this.vW[o][i] + (1 - beta2) * grads.dW[o][i] ** 2;
        const mHat = this.mW[o][i] / bc1;
        const vHat = this.vW[o][i] / bc2;
        this.W[o][i] -= lr * mHat / (Math.sqrt(vHat) + eps);
      }
      this.mb[o] = beta1 * this.mb[o] + (1 - beta1) * grads.db[o];
      this.vb[o] = beta2 * this.vb[o] + (1 - beta2) * grads.db[o] ** 2;
      const mHat = this.mb[o] / bc1;
      const vHat = this.vb[o] / bc2;
      this.b[o] -= lr * mHat / (Math.sqrt(vHat) + eps);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// GRAPHSAGE MODEL
// ═══════════════════════════════════════════════════════════════════

/**
 * Полная GraphSAGE модель: два слоя SAGE + выходной слой.
 */
class GraphSAGE {
  constructor(config = {}) {
    this.inputDim = config.inputDim || 10;
    this.hiddenDim = config.hiddenDim || 32;
    this.outputDim = config.outputDim || 16;
    this.nLayers = config.nLayers || 2;
    this.aggregatorType = config.aggregatorType || 'mean';
    this.learningRate = config.learningRate || 0.01;
    this.l2Reg = config.l2Reg || 1e-4;
    this.seed = config.seed || 42;

    // Слои
    this.layers = [];
    let prevDim = this.inputDim;
    for (let i = 0; i < this.nLayers; i++) {
      const layerDim = i === this.nLayers - 1 ? this.outputDim : this.hiddenDim;
      this.layers.push(new SAGESageLayer(prevDim, layerDim, this.aggregatorType, this.seed + i * 10));
      prevDim = layerDim;
    }

    // Выходной классификатор (для supervised)
    this.classifierW = xavierInit(3, this.outputDim, this.seed + 999);
    this.classifierB = zerosVec(3);
    this.t = 0;

    // История обучения
    this.lossHistory = [];
  }

  /**
   * Forward pass: эмбеддинг узлов через слои.
   * @param {Object} node — { features: Float64Array, neighbors: Array<{features}> }
   * @returns {Object} — { embedding, layerCaches }
   */
  embedNode(node) {
    let current = new Float64Array(node.features);
    const layerCaches = [];

    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers[i];
      // Соседи на этом слое — их признаки из предыдущего слоя
      // (упрощение: используем исходные признаки соседей)
      const neighborFeatures = node.neighbors.map(n => {
        if (i === 0) return n.features;
        return n.embedding || n.features;
      });

      const { output, cache } = layer.forward(current, neighborFeatures);
      layerCaches.push(cache);
      current = output;
    }

    return { embedding: current, layerCaches };
  }

  /**
   * Классификация эмбеддинга.
   * @returns {Float64Array} — вероятности трёх классов [stable, elevated, crisis]
   */
  classify(embedding) {
    const logits = new Float64Array(3);
    for (let c = 0; c < 3; c++) {
      let sum = this.classifierB[c];
      for (let i = 0; i < this.outputDim; i++) {
        sum += this.classifierW[c][i] * embedding[i];
      }
      logits[c] = sum;
    }
    return softmax(Array.from(logits));
  }

  /**
   * Предсказание для узла.
   */
  predict(node) {
    const { embedding } = this.embedNode(node);
    const probs = this.classify(embedding);
    const classes = ['stable', 'elevated', 'crisis'];
    const idx = probs.indexOf(Math.max(...probs));
    return {
      embedding: Array.from(embedding),
      probabilities: {
        stable: probs[0],
        elevated: probs[1],
        crisis: probs[2],
      },
      predicted: classes[idx],
      confidence: probs[idx],
    };
  }

  /**
   * Supervised обучение на одном узле.
   * @param {Object} node — { features, neighbors }
   * @param {number} label — 0=stable, 1=elevated, 2=crisis
   */
  trainStep(node, label) {
    const { embedding, layerCaches } = this.embedNode(node);
    const probs = this.classify(embedding);

    // Cross-entropy loss
    const loss = -Math.log(Math.max(probs[label], 1e-10));
    this.lossHistory.push(loss);

    // Backward через classifier
    const dLogits = new Float64Array(3);
    for (let c = 0; c < 3; c++) {
      dLogits[c] = probs[c] - (c === label ? 1 : 0);
    }

    const dClassifierW = zerosMatrix(3, this.outputDim);
    const dClassifierB = zerosVec(3);
    const dEmbedding = new Float64Array(this.outputDim);

    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < this.outputDim; i++) {
        dClassifierW[c][i] = dLogits[c] * embedding[i];
      }
      dClassifierB[c] = dLogits[c];
    }

    for (let i = 0; i < this.outputDim; i++) {
      let sum = 0;
      for (let c = 0; c < 3; c++) {
        sum += this.classifierW[c][i] * dLogits[c];
      }
      dEmbedding[i] = sum;
    }

    // Update classifier
    this.t++;
    const lr = this.learningRate;
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < this.outputDim; i++) {
        this.classifierW[c][i] -= lr * dClassifierW[c][i];
      }
      this.classifierB[c] -= lr * dClassifierB[c];
    }

    // Backward через слои
    let dCurrent = dEmbedding;
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i];
      const grads = layer.backward(dCurrent, layerCaches[i]);
      layer.update(grads, lr);
      // Только первые inputDim — градиент по selfFeature
      dCurrent = new Float64Array(layer.inputDim);
      for (let j = 0; j < layer.inputDim; j++) {
        dCurrent[j] = grads.dConcat[j];
      }
    }

    return { loss, probs };
  }

  /**
   * Обучение на батче узлов.
   */
  fit(nodes, labels, { epochs = 50, batchSize = 16, verbose = false } = {}) {
    const n = nodes.length;
    for (let epoch = 0; epoch < epochs; epoch++) {
      let epochLoss = 0;
      const indices = Array.from({ length: n }, (_, i) => i);

      // Shuffle
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      for (let start = 0; start < n; start += batchSize) {
        const batchIdx = indices.slice(start, start + batchSize);
        for (const idx of batchIdx) {
          const { loss } = this.trainStep(nodes[idx], labels[idx]);
          epochLoss += loss;
        }
      }

      const avgLoss = epochLoss / n;
      if (verbose && epoch % 10 === 0) {
        console.log(`[graph_sage] epoch ${epoch}: loss=${avgLoss.toFixed(4)}`);
      }
    }

    return {
      finalLoss: this.lossHistory[this.lossHistory.length - 1],
      avgLoss: mean(this.lossHistory.slice(-20)),
    };
  }

  serialize() {
    return {
      config: {
        inputDim: this.inputDim,
        hiddenDim: this.hiddenDim,
        outputDim: this.outputDim,
        nLayers: this.nLayers,
        aggregatorType: this.aggregatorType,
      },
      layers: this.layers.map(l => ({
        W: l.W.map(r => Array.from(r)),
        b: Array.from(l.b),
      })),
      classifierW: this.classifierW.map(r => Array.from(r)),
      classifierB: Array.from(this.classifierB),
    };
  }

  static deserialize(data) {
    const model = new GraphSAGE(data.config);
    model.layers.forEach((l, i) => {
      l.W = data.layers[i].W.map(r => new Float64Array(r));
      l.b = new Float64Array(data.layers[i].b);
    });
    model.classifierW = data.classifierW.map(r => new Float64Array(r));
    model.classifierB = new Float64Array(data.classifierB);
    return model;
  }
}

// ═══════════════════════════════════════════════════════════════════
// ИНТЕГРАЦИЯ С CRUCIX
// ═══════════════════════════════════════════════════════════════════

/**
 * Граф стран с весами рёбер.
 * Узлы — страны, рёбра — связи (торговля, дипломатия, конфликт).
 */
function buildCrucixCountryGraph() {
  const nodes = [
    { id: 'usa', name: 'USA' },
    { id: 'china', name: 'China' },
    { id: 'russia', name: 'Russia' },
    { id: 'eu', name: 'EU' },
    { id: 'uk', name: 'UK' },
    { id: 'japan', name: 'Japan' },
    { id: 'india', name: 'India' },
    { id: 'brazil', name: 'Brazil' },
    { id: 'saudi', name: 'Saudi Arabia' },
    { id: 'iran', name: 'Iran' },
    { id: 'turkey', name: 'Turkey' },
    { id: 'israel', name: 'Israel' },
    { id: 'ukraine', name: 'Ukraine' },
    { id: 'taiwan', name: 'Taiwan' },
    { id: 'n_korea', name: 'North Korea' },
    { id: 's_korea', name: 'South Korea' },
  ];

  const edges = [
    { from: 'usa', to: 'eu', weight: 1.0 },
    { from: 'usa', to: 'uk', weight: 1.0 },
    { from: 'usa', to: 'japan', weight: 0.9 },
    { from: 'usa', to: 's_korea', weight: 0.9 },
    { from: 'usa', to: 'israel', weight: 0.8 },
    { from: 'eu', to: 'uk', weight: 0.9 },
    { from: 'japan', to: 's_korea', weight: 0.7 },
    { from: 'china', to: 'russia', weight: 0.8 },
    { from: 'china', to: 'iran', weight: 0.6 },
    { from: 'china', to: 'n_korea', weight: 0.5 },
    { from: 'russia', to: 'iran', weight: 0.6 },
    { from: 'russia', to: 'n_korea', weight: 0.5 },
    // Конфликтные
    { from: 'usa', to: 'china', weight: 0.3 },
    { from: 'usa', to: 'russia', weight: 0.2 },
    { from: 'china', to: 'taiwan', weight: 0.1 },
    { from: 'russia', to: 'ukraine', weight: 0.1 },
    { from: 'israel', to: 'iran', weight: 0.1 },
    { from: 'n_korea', to: 's_korea', weight: 0.1 },
    // Торговые
    { from: 'china', to: 'brazil', weight: 0.5 },
    { from: 'china', to: 'saudi', weight: 0.4 },
    { from: 'india', to: 'russia', weight: 0.5 },
    { from: 'turkey', to: 'russia', weight: 0.3 },
    { from: 'turkey', to: 'eu', weight: 0.2 },
  ];

  // Adjacency map
  const adj = new Map();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    adj.get(edge.from)?.push({ id: edge.to, weight: edge.weight });
    adj.get(edge.to)?.push({ id: edge.from, weight: edge.weight });
  }

  return { nodes, edges, adj };
}

/**
 * Признаки узла-страны из последнего sweep.
 * Упрощение: используем глобальные метрики для всех стран.
 * В полной версии — per-country из GDELT.
 */
function extractNodeFeatures(latest, countryId, graph) {
  const vix = (latest.fred?.vix ?? 20) / 50;
  const hySpread = (latest.fred?.hySpread ?? 3) / 10;
  const conflicts = (latest.gdelt?.conflictEvents?.length ?? 0) / 20;
  const sanctions = (latest.sanctions?.count ?? 0) / 10;
  const oil = (latest.energy?.oilPrice ?? 70) / 120;
  const gold = (latest.gold?.price ?? 1900) / 2200;
  const dxy = (latest.dxy?.value ?? 100) / 110;
  const radiation = latest.radiation
    ? Math.max(...Object.values(latest.radiation).map(r => r.cpm || 0)) / 200
    : 0;
  const newAlerts = (latest.delta?.newAlerts ?? 0) / 10;
  const escalatedAlerts = (latest.delta?.escalatedAlerts ?? 0) / 5;

  // Специфичные для страны поправки
  const countryFactors = {
    russia: 1.2,
    china: 1.0,
    iran: 1.3,
    ukraine: 1.5,
    israel: 1.2,
    n_korea: 1.4,
    taiwan: 1.1,
    usa: 0.7,
    eu: 0.8,
    japan: 0.6,
    s_korea: 0.9,
    india: 0.8,
    brazil: 0.7,
    saudi: 0.9,
    turkey: 1.0,
    uk: 0.7,
  };
  const factor = countryFactors[countryId] || 1.0;

  return new Float64Array([
    vix * factor,
    hySpread,
    conflicts * factor,
    sanctions * factor,
    oil,
    gold,
    dxy,
    radiation,
    newAlerts,
    escalatedAlerts,
  ]);
}

/**
 * Определение метки для страны из исторических данных.
 * Простая эвристика: высокий глобальный риск + страна в зоне конфликта → crisis.
 */
function countryLabel(latest, countryId) {
  const vix = latest.fred?.vix ?? 20;
  const conflicts = latest.gdelt?.conflictEvents?.length ?? 0;

  const riskCountries = ['russia', 'ukraine', 'iran', 'israel', 'n_korea', 'taiwan'];
  const isRiskCountry = riskCountries.includes(countryId);

  if (vix > 35 || (isRiskCountry && conflicts > 15)) return 2; // crisis
  if (vix > 25 || (isRiskCountry && conflicts > 8)) return 1; // elevated
  return 0; // stable
}

/**
 * Построение узла для GraphSAGE.
 */
function buildNode(nodeId, latest, graph) {
  const features = extractNodeFeatures(latest, nodeId, graph);
  const neighbors = (graph.adj.get(nodeId) || []).map(n => ({
    id: n.id,
    features: extractNodeFeatures(latest, n.id, graph),
    weight: n.weight,
  }));

  return { id: nodeId, features, neighbors };
}

// ═══════════════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ
// ═══════════════════════════════════════════════════════════════════

/**
 * Полный GraphSAGE-цикл для Crucix.
 *
 * @param {Array} history — массив sweep-объектов
 * @param {Object} options — параметры
 * @returns {Object} — предсказания для всех стран
 */
export function crucixGraphSAGE(history, options = {}) {
  if (!history || history.length < 20) {
    return {
      module: 'graph_sage',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 20,
      actual: history.length,
    };
  }

  const t0 = Date.now();
  console.log(`[graph_sage] Запуск на ${history.length} sweep'ах`);

  const graph = buildCrucixCountryGraph();
  const latest = history[history.length - 1];

  // Построение узлов
  const nodes = graph.nodes.map(n => buildNode(n.id, latest, graph));
  const labels = graph.nodes.map(n => countryLabel(latest, n.id));

  // Модель
  const model = new GraphSAGE({
    inputDim: 10,
    hiddenDim: 32,
    outputDim: 16,
    nLayers: 2,
    aggregatorType: options.aggregatorType || 'mean',
    learningRate: options.learningRate || 0.01,
  });

  // Обучение на исторических sweep'ах (уплотнение — по 5 sweep'ов)
  const trainSetSize = Math.min(Math.floor(history.length / 5), 30);
  const trainData = [];
  for (let i = 0; i < trainSetSize; i++) {
    const sweep = history[Math.floor(i * history.length / trainSetSize)];
    for (const node of graph.nodes) {
      const nodeData = buildNode(node.id, sweep, graph);
      const label = countryLabel(sweep, node.id);
      trainData.push({ node: nodeData, label });
    }
  }

  console.log(`[graph_sage] Обучаем на ${trainData.length} примерах`);
  model.fit(
    trainData.map(d => d.node),
    trainData.map(d => d.label),
    {
      epochs: options.epochs || 30,
      batchSize: 16,
      verbose: false,
    }
  );

  // Предсказание для каждой страны
  const predictions = [];
  for (const node of nodes) {
    const pred = model.predict(node);
    predictions.push({
      id: node.id,
      probabilities: pred.probabilities,
      predicted: pred.predicted,
      confidence: Math.round(pred.confidence * 1000) / 1000,
      crisisProbability: Math.round(pred.probabilities.crisis * 1000) / 1000,
    });
  }

  predictions.sort((a, b) => b.crisisProbability - a.crisisProbability);

  const result = {
    module: 'graph_sage',
    available: true,
    timestamp: new Date().toISOString(),
    nSweeps: history.length,
    nNodes: graph.nodes.length,
    nEdges: graph.edges.length,
    aggregatorType: model.aggregatorType,
    trainingSetSize: trainData.length,
    finalLoss: model.lossHistory.length > 0
      ? Math.round(model.lossHistory[model.lossHistory.length - 1] * 10000) / 10000
      : null,
    topRiskCountries: predictions.slice(0, 8),
    allPredictions: predictions,
    interpretation: predictions[0]
      ? `Топ-риск: ${predictions[0].id.toUpperCase()} (P(crisis)=${predictions[0].crisisProbability})`
      : 'Нет данных',
    elapsedMs: Date.now() - t0,
  };

  // Сохранение
  const dir = join(__dirname, '..', '..', '..', 'runs', 'predictions');
  ensureDir(dir);
  saveJSON(join(dir, 'graph_sage.json'), result);

  console.log(`[graph_sage] Цикл завершён за ${result.elapsedMs}ms`);
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════════════════════

export {
  GraphSAGE,
  SAGESageLayer,
  meanAggregator,
  maxPoolingAggregator,
  lstmAggregator,
  buildCrucixCountryGraph,
  buildNode,
  extractNodeFeatures,
  countryLabel,
};
