// apis/predict/models/neural.mjs
// MLP с обратным распространением ошибки — на чистом JS.
//
// Теоретическая основа:
//   Rumelhart, D. E., Hinton, G. E., & Williams, R. J. (1986).
//   "Learning representations by back-propagating errors". Nature, 323, 533-536.
//   Goodfellow, I., Bengio, Y., & Courville, A. (2016). "Deep Learning".
//   MIT Press. Главы 6-8.
//
//   Forward:  a^l = σ(W^l · a^{l-1} + b^l)
//   Backward: δ^L = ∇_a C ⊙ σ'(z^L)
//             δ^l = ((W^{l+1})ᵀ · δ^{l+1}) ⊙ σ'(z^l)
//             ∂C/∂W^l = δ^l · (a^{l-1})ᵀ
//
// Применение в Crucix:
//   Нелинейная классификация режима системы (stable/escalation/crisis)
//   по вектору признаков из sweep. Работает там, где линейные модели
//   не справляются — например, при сложных взаимодействиях признаков.

// ============================================================
// MLP
// ============================================================

class MLP {
  constructor({ layers, learningRate = 0.01, activation = 'relu' } = {}) {
    this.layers = layers;
    this.lr = learningRate;
    this.activation = activation;
    this.weights = [];
    this.biases = [];

    // He/Xavier инициализация
    for (let i = 0; i < layers.length - 1; i++) {
      const scale = Math.sqrt(2 / layers[i]);
      const w = Array.from({ length: layers[i + 1] }, () =>
        Array.from({ length: layers[i] }, () => (Math.random() * 2 - 1) * scale)
      );
      const b = new Array(layers[i + 1]).fill(0);
      this.weights.push(w);
      this.biases.push(b);
    }
  }

  _activate(x, layer) {
    const act = layer === this.weights.length - 1 ? 'sigmoid' : this.activation;
    switch (act) {
      case 'relu':
        return Math.max(0, x);
      case 'sigmoid':
        return 1 / (1 + Math.exp(-x));
      case 'tanh':
        return Math.tanh(x);
      case 'linear':
        return x;
      default:
        return Math.max(0, x);
    }
  }

  _activateDeriv(x, a, layer) {
    const act = layer === this.weights.length - 1 ? 'sigmoid' : this.activation;
    switch (act) {
      case 'relu':
        return x > 0 ? 1 : 0;
      case 'sigmoid':
        return a * (1 - a);
      case 'tanh':
        return 1 - a * a;
      case 'linear':
        return 1;
      default:
        return x > 0 ? 1 : 0;
    }
  }

  /**
   * Forward pass.
   * @param {number[]} input
   * @returns {{output, activations, preActivations}}
   */
  forward(input) {
    const activations = [input];
    const preActivations = [];

    let current = input;
    for (let l = 0; l < this.weights.length; l++) {
      const pre = new Array(this.weights[l].length).fill(0);
      const post = new Array(this.weights[l].length).fill(0);

      for (let j = 0; j < this.weights[l].length; j++) {
        let sum = this.biases[l][j];
        for (let i = 0; i < current.length; i++) {
          sum += this.weights[l][j][i] * current[i];
        }
        pre[j] = sum;
        post[j] = this._activate(sum, l);
      }

      preActivations.push(pre);
      activations.push(post);
      current = post;
    }

    return { output: current, activations, preActivations };
  }

  /**
   * Backward pass + обновление весов (SGD).
   */
  backward(input, target) {
    const { output, activations, preActivations } = this.forward(input);

    const deltas = new Array(this.weights.length);

    // Output layer
    const outputDelta = new Array(output.length);
    for (let i = 0; i < output.length; i++) {
      const err = output[i] - target[i];
      outputDelta[i] = err * this._activateDeriv(preActivations[this.weights.length - 1][i], output[i], this.weights.length - 1);
    }
    deltas[this.weights.length - 1] = outputDelta;

    // Hidden layers
    for (let l = this.weights.length - 2; l >= 0; l--) {
      deltas[l] = new Array(this.weights[l].length);
      for (let i = 0; i < this.weights[l].length; i++) {
        let sum = 0;
        for (let j = 0; j < this.weights[l + 1].length; j++) {
          sum += this.weights[l + 1][j][i] * deltas[l + 1][j];
        }
        deltas[l][i] = sum * this._activateDeriv(preActivations[l][i], activations[l + 1][i], l);
      }
    }

    // Update weights
    for (let l = 0; l < this.weights.length; l++) {
      for (let j = 0; j < this.weights[l].length; j++) {
        for (let i = 0; i < this.weights[l][j].length; i++) {
          this.weights[l][j][i] -= this.lr * deltas[l][j] * activations[l][i];
        }
        this.biases[l][j] -= this.lr * deltas[l][j];
      }
    }
  }

  /**
   * Обучение: мини-батч SGD.
   */
  fit(X, y, epochs = 100, batchSize = 32) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      const indices = Array.from({ length: X.length }, (_, i) => i)
        .sort(() => Math.random() - 0.5);

      for (let b = 0; b < indices.length; b += batchSize) {
        const batch = indices.slice(b, b + batchSize);
        for (const idx of batch) {
          this.backward(X[idx], y[idx]);
        }
      }
    }
    return this;
  }

  /**
   * Прогноз.
   */
  predict(input) {
    return this.forward(input).output;
  }

  /**
   * Оценка потерь (MSE).
   */
  loss(X, y) {
    let sum = 0;
    for (let i = 0; i < X.length; i++) {
      const pred = this.predict(X[i]);
      for (let j = 0; j < pred.length; j++) {
        sum += (pred[j] - y[i][j]) ** 2;
      }
    }
    return sum / X.length;
  }

  serialize() {
    return JSON.stringify({
      layers: this.layers,
      lr: this.lr,
      activation: this.activation,
      weights: this.weights,
      biases: this.biases,
    });
  }

  static deserialize(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    const mlp = new MLP({ layers: d.layers, learningRate: d.lr, activation: d.activation });
    mlp.weights = d.weights;
    mlp.biases = d.biases;
    return mlp;
  }
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * Обучение MLP на истории sweep для классификации режима.
 *
 * @param {Array} history — sweep-история
 * @param {Object} opts — {epochs, batchSize, hiddenDim}
 * @returns {Object}
 */
function crucixMLPAnalysis(history, opts = {}) {
  const { epochs = 50, batchSize = 16, hiddenDim = 8 } = opts;

  if (!Array.isArray(history) || history.length < 30) {
    return {
      available: false,
      reason: 'insufficient_history',
      count: history?.length || 0,
    };
  }

  // Подготовка данных
  const X = [];
  const y = [];
  const labels = ['stable', 'escalation', 'crisis'];

  for (const h of history) {
    const vix = (h.fred && h.fred.vix) || 20;
    const conflicts =
      (h.gdelt && h.gdelt.conflictEvents && h.gdelt.conflictEvents.length) || 0;
    const alerts = (h.delta && h.delta.newAlerts) || 0;

    X.push([
      Math.min(vix / 50, 1),
      Math.min(conflicts / 20, 1),
      Math.min(alerts / 15, 1),
    ]);

    if (vix > 35 || conflicts > 15) y.push([0, 0, 1]);
    else if (vix > 25 || conflicts > 8) y.push([0, 1, 0]);
    else y.push([1, 0, 0]);
  }

  const mlp = new MLP({
    layers: [3, hiddenDim, hiddenDim, 3],
    learningRate: 0.01,
    activation: 'relu',
  });

  mlp.fit(X, y, epochs, batchSize);

  // Прогноз на последнем sweep
  const lastFeatures = X[X.length - 1];
  const pred = mlp.predict(lastFeatures);
  const maxIdx = pred.indexOf(Math.max(...pred));

  const finalLoss = mlp.loss(X, y);

  return {
    available: true,
    nSamples: X.length,
    prediction: labels[maxIdx],
    confidence: parseFloat(pred[maxIdx].toFixed(3)),
    distribution: Object.fromEntries(labels.map((l, i) => [l, parseFloat(pred[i].toFixed(3))])),
    trainingLoss: parseFloat(finalLoss.toFixed(4)),
    epochs,
  };
}

export { MLP, crucixMLPAnalysis };
