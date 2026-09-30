// apis/predict/models/actor_critic.mjs
// Advantage Actor-Critic (A2C) with Generalized Advantage Estimation (GAE)
//
// Теоретическая основа:
//   - Mnih, V., et al. (2016). "Asynchronous Methods for Deep Reinforcement
//     Learning". ICML 2016. — A3C/A2C.
//   - Schulman, J., Moritz, P., Levine, S., Jordan, M., & Abbeel, P. (2016).
//     "High-Dimensional Continuous Control Using Generalized Advantage
//     Estimation". ICLR 2016. — GAE(γ,λ).
//   - Sutton, R. S., & Barto, A. G. (2018). "Reinforcement Learning:
//     An Introduction" (2nd ed.). MIT Press.
//
// Отличие от DQN (в reinforcement.mjs):
//   DQN — off-policy, обучается на replay buffer, дискретные действия.
//   A2C — on-policy, обучается на свежих траекториях, работает с
//         непрерывными и дискретными действиями, стохастическая политика.
//
// Применение в Crucix:
//   1. AlertPolicyEnv — когда отправлять алерты (silent/normal/critical)
//   2. SourceSelectionEnv — какие источники опрашивать в данном sweep
//   3. ThresholdEnv — оптимизация порогов срабатывания сигналов
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

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch { return fallback; }
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

function dot(a, b) {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

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

function relu(x) {
  return Math.max(0, x);
}

function reluDeriv(x) {
  return x > 0 ? 1 : 0;
}

function tanh(x) {
  return Math.tanh(x);
}

function tanhDeriv(x) {
  const t = Math.tanh(x);
  return 1 - t * t;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
}

function softmax(arr) {
  const m = Math.max(...arr);
  const e = arr.map(v => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

function logSoftmax(arr) {
  const m = Math.max(...arr);
  const lse = m + Math.log(arr.reduce((s, v) => s + Math.exp(v - m), 0));
  return arr.map(v => v - lse);
}

// ═══════════════════════════════════════════════════════════════════
// MLP CORE — с полным backprop
// ═══════════════════════════════════════════════════════════════════

/**
 * Многослойный перцептрон с ReLU и поддержкой Adam.
 * Используется как backbone и как отдельные heads для A2C.
 */
class MLP {
  constructor({ layers, activation = 'relu', seed = 42 }) {
    this.layers = layers;
    this.activation = activation;
    this.seed = seed;

    this.W = [];
    this.b = [];

    let s = seed;
    for (let i = 0; i < layers.length - 1; i++) {
      const fanIn = layers[i];
      const fanOut = layers[i + 1];
      this.W.push(xavierInit(fanOut, fanIn, s++));
      this.b.push(zerosVec(fanOut));
    }

    // Adam state
    this.mW = this.W.map(Wl => Wl.map(row => new Float64Array(row.length)));
    this.vW = this.W.map(Wl => Wl.map(row => new Float64Array(row.length)));
    this.mb = this.b.map(bl => zerosVec(bl.length));
    this.vb = this.b.map(bl => zerosVec(bl.length));
    this.t = 0;
  }

  /**
   * Forward pass. Возвращает все активации и пре-активации для backprop.
   */
  forward(x) {
    const activations = [new Float64Array(x)];
    const preActivations = [];

    let current = new Float64Array(x);

    for (let i = 0; i < this.W.length; i++) {
      const z = new Float64Array(this.b[i].length);
      for (let o = 0; o < this.W[i].length; o++) {
        let sum = this.b[i][o];
        for (let j = 0; j < this.W[i][o].length; j++) {
          sum += this.W[i][o][j] * current[j];
        }
        z[o] = sum;
      }
      preActivations.push(z);

      // Activation
      const a = new Float64Array(z.length);
      if (i === this.W.length - 1) {
        // Last layer — линейная (для logits)
        for (let o = 0; o < z.length; o++) a[o] = z[o];
      } else {
        for (let o = 0; o < z.length; o++) {
          if (this.activation === 'relu') a[o] = relu(z[o]);
          else if (this.activation === 'tanh') a[o] = tanh(z[o]);
          else a[o] = z[o];
        }
      }

      activations.push(a);
      current = a;
    }

    return { output: current, activations, preActivations };
  }

  /**
   * Backward pass — градиенты по W и b.
   */
  backward(dOutput, activations, preActivations) {
    const nLayers = this.W.length;
    const dW = this.W.map(Wl => Wl.map(row => new Float64Array(row.length)));
    const db = this.b.map(bl => new Float64Array(bl.length));

    let dCurrent = new Float64Array(dOutput);

    for (let l = nLayers - 1; l >= 0; l--) {
      // dZ через производную активации (кроме последнего слоя)
      let dZ;
      if (l === nLayers - 1) {
        dZ = dCurrent;
      } else {
        dZ = new Float64Array(dCurrent.length);
        for (let o = 0; o < dCurrent.length; o++) {
          if (this.activation === 'relu') dZ[o] = dCurrent[o] * reluDeriv(preActivations[l][o]);
          else if (this.activation === 'tanh') dZ[o] = dCurrent[o] * tanhDeriv(preActivations[l][o]);
          else dZ[o] = dCurrent[o];
        }
      }

      // dW = dZ · a_prev^T
      const aPrev = activations[l];
      for (let o = 0; o < this.W[l].length; o++) {
        for (let j = 0; j < this.W[l][o].length; j++) {
          dW[l][o][j] = dZ[o] * aPrev[j];
        }
        db[l][o] = dZ[o];
      }

      // dInput = W^T · dZ
      if (l > 0) {
        const dInput = new Float64Array(aPrev.length);
        for (let j = 0; j < aPrev.length; j++) {
          let sum = 0;
          for (let o = 0; o < this.W[l].length; o++) {
            sum += this.W[l][o][j] * dZ[o];
          }
          dInput[j] = sum;
        }
        dCurrent = dInput;
      }
    }

    return { dW, db };
  }

  /**
   * Adam update.
   */
  update(grads, lr = 0.001) {
    this.t++;
    const beta1 = 0.9, beta2 = 0.999, eps = 1e-8;
    const bc1 = 1 - Math.pow(beta1, this.t);
    const bc2 = 1 - Math.pow(beta2, this.t);

    for (let l = 0; l < this.W.length; l++) {
      for (let o = 0; o < this.W[l].length; o++) {
        for (let j = 0; j < this.W[l][o].length; j++) {
          const g = grads.dW[l][o][j];
          this.mW[l][o][j] = beta1 * this.mW[l][o][j] + (1 - beta1) * g;
          this.vW[l][o][j] = beta2 * this.vW[l][o][j] + (1 - beta2) * g * g;
          const mHat = this.mW[l][o][j] / bc1;
          const vHat = this.vW[l][o][j] / bc2;
          this.W[l][o][j] -= lr * mHat / (Math.sqrt(vHat) + eps);
        }
        const gb = grads.db[l][o];
        this.mb[l][o] = beta1 * this.mb[l][o] + (1 - beta1) * gb;
        this.vb[l][o] = beta2 * this.vb[l][o] + (1 - beta2) * gb * gb;
        const mHat = this.mb[l][o] / bc1;
        const vHat = this.vb[l][o] / bc2;
        this.b[l][o] -= lr * mHat / (Math.sqrt(vHat) + eps);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// ACTOR-CRITIC NETWORK
// ═══════════════════════════════════════════════════════════════════

/**
 * Единая сеть A2C: общий backbone + две головы (actor, critic).
 *
 *                ┌─→ Actor Head → π(a|s) — softmax
 *   s → Backbone ┤
 *                └─→ Critic Head → V(s) — linear
 */
class ActorCriticNetwork {
  constructor({ stateDim, actionDim, hiddenDim = 64, nHiddenLayers = 2, seed = 42 }) {
    this.stateDim = stateDim;
    this.actionDim = actionDim;

    // Backbone: MLP [stateDim → hidden × n → hidden]
    const backboneLayers = [stateDim];
    for (let i = 0; i < nHiddenLayers; i++) backboneLayers.push(hiddenDim);
    this.backbone = new MLP({ layers: backboneLayers, activation: 'relu', seed });

    // Actor head: [hidden → actionDim]
    this.actorHead = new MLP({ layers: [hiddenDim, actionDim], activation: 'linear', seed: seed + 100 });

    // Critic head: [hidden → 1]
    this.criticHead = new MLP({ layers: [hiddenDim, 1], activation: 'linear', seed: seed + 200 });
  }

  /**
   * Forward pass: возвращает π(a|s) и V(s).
   */
  forward(state) {
    const backboneResult = this.backbone.forward(state);
    const features = backboneResult.output;

    const actorResult = this.actorHead.forward(features);
    const logits = actorResult.output;
    const probs = softmax(Array.from(logits));

    const criticResult = this.criticHead.forward(features);
    const value = criticResult.output[0];

    return {
      probs,
      logits: Array.from(logits),
      value,
      cache: {
        state,
        backbone: backboneResult,
        features,
        actor: actorResult,
        critic: criticResult,
      },
    };
  }

  /**
   * Sample action из политики.
   */
  sampleAction(state) {
    const { probs, value, cache } = this.forward(state);
    const r = Math.random();
    let cum = 0;
    let action = 0;
    for (let i = 0; i < probs.length; i++) {
      cum += probs[i];
      if (r < cum) { action = i; break; }
    }
    return { action, prob: probs[action], probs, value, cache };
  }

  /**
   * Полный backward pass:
   *   L = policy_loss + value_coef · value_loss - entropy_coef · entropy
   *
   * policy_loss = -log π(a|s) · A(s,a)
   * value_loss = (V(s) - target)²
   * entropy = -Σ π(a|s) · log π(a|s)
   */
  backward(action, advantage, valueTarget, cache, config = {}) {
    const { valueCoef = 0.5, entropyCoef = 0.01 } = config;
    const { probs, value, cache: innerCache } = cache;
    const logProbs = logSoftmax(innerCache.actor.output);

    // ─── Actor gradients ───
    // dL_actor/dlogits = probs - one_hot(action)
    // умножаем на advantage (с минусом, т.к. loss = -advantage · logπ)
    const dLogits = new Float64Array(this.actionDim);
    for (let i = 0; i < this.actionDim; i++) {
      dLogits[i] = probs[i] - (i === action ? 1 : 0);
    }
    // Градиент с учётом advantage
    for (let i = 0; i < this.actionDim; i++) {
      dLogits[i] *= -advantage;
    }

    // Entropy gradient: d(-H)/dlogits = -probs · (log probs + H)
    // H = -Σ p·log p
    let H = 0;
    for (let i = 0; i < this.actionDim; i++) {
      H -= probs[i] * logProbs[i];
    }
    for (let i = 0; i < this.actionDim; i++) {
      // d(-entropyCoef · H)/dlogits[i] = entropyCoef · probs[i] · (logProbs[i] + H)
      dLogits[i] += entropyCoef * probs[i] * (logProbs[i] + H);
    }

    const actorGrads = this.actorHead.backward(
      dLogits,
      innerCache.actor.activations,
      innerCache.actor.preActivations
    );

    // ─── Critic gradients ───
    // dL_critic/dValue = 2 · valueCoef · (V - target)
    const dValue = new Float64Array([2 * valueCoef * (value - valueTarget)]);
    const criticGrads = this.criticHead.backward(
      dValue,
      innerCache.critic.activations,
      innerCache.critic.preActivations
    );

    // ─── Backbone gradients ───
    // Собираем dFeatures из обеих голов
    const dFeatures = new Float64Array(innerCache.features.length);
    const actorDInput = this._getInputGrad(actorGrads.dW, innerCache.actor.activations, 0);
    // Упрощённо — используем dConcat через прямой backward
    // В actorHead последний слой → features, dW[0] уже посчитан
    // Правильный путь: backward на MLP возвращает градиент по входу.
    // Здесь мы вызываем ещё раз для получения dInput.
    const actorBackward = this._computeInputGrad(this.actorHead, dLogits, innerCache.actor);
    const criticBackward = this._computeInputGrad(this.criticHead, dValue, innerCache.critic);

    for (let i = 0; i < dFeatures.length; i++) {
      dFeatures[i] = actorBackward[i] + criticBackward[i];
    }

    const backboneGrads = this.backbone.backward(
      dFeatures,
      innerCache.backbone.activations,
      innerCache.backbone.preActivations
    );

    return {
      actor: actorGrads,
      critic: criticGrads,
      backbone: backboneGrads,
      entropy: H,
      valueLoss: (value - valueTarget) ** 2,
    };
  }

  _computeInputGrad(mlp, dOutput, cache) {
    // Прямой проход backward, собираем градиент по входу
    const dInput = new Float64Array(mlp.layers[0]);
    // Начинаем с dOutput
    let dCurrent = dOutput;

    for (let l = mlp.W.length - 1; l >= 0; l--) {
      // Производная активации (кроме последнего слоя)
      let dZ;
      if (l === mlp.W.length - 1) {
        dZ = dCurrent;
      } else {
        dZ = new Float64Array(dCurrent.length);
        for (let o = 0; o < dCurrent.length; o++) {
          if (mlp.activation === 'relu') dZ[o] = dCurrent[o] * reluDeriv(cache.preActivations[l][o]);
          else if (mlp.activation === 'tanh') dZ[o] = dCurrent[o] * tanhDeriv(cache.preActivations[l][o]);
          else dZ[o] = dCurrent[o];
        }
      }

      // dInput = W^T · dZ
      const aPrev = cache.activations[l];
      const dIn = new Float64Array(aPrev.length);
      for (let j = 0; j < aPrev.length; j++) {
        let sum = 0;
        for (let o = 0; o < mlp.W[l].length; o++) {
          sum += mlp.W[l][o][j] * dZ[o];
        }
        dIn[j] = sum;
      }
      dCurrent = dIn;
    }

    return dCurrent;
  }

  /**
   * Обновление весов.
   */
  update(grads, lr = 0.001) {
    this.backbone.update(grads.backbone, lr);
    this.actorHead.update(grads.actor, lr);
    this.criticHead.update(grads.critic, lr);
  }

  serialize() {
    return {
      config: { stateDim: this.stateDim, actionDim: this.actionDim },
      backbone: {
        W: this.backbone.W.map(Wl => Wl.map(r => Array.from(r))),
        b: this.backbone.b.map(bl => Array.from(bl)),
      },
      actor: {
        W: this.actorHead.W.map(Wl => Wl.map(r => Array.from(r))),
        b: this.actorHead.b.map(bl => Array.from(bl)),
      },
      critic: {
        W: this.criticHead.W.map(Wl => Wl.map(r => Array.from(r))),
        b: this.criticHead.b.map(bl => Array.from(bl)),
      },
    };
  }

  static deserialize(data) {
    const net = new ActorCriticNetwork({
      stateDim: data.config.stateDim,
      actionDim: data.config.actionDim,
      hiddenDim: data.backbone.W[0].length, // fan-out
    });
    net.backbone.W = data.backbone.W.map(Wl => Wl.map(r => new Float64Array(r)));
    net.backbone.b = data.backbone.b.map(bl => new Float64Array(bl));
    net.actorHead.W = data.actor.W.map(Wl => Wl.map(r => new Float64Array(r)));
    net.actorHead.b = data.actor.b.map(bl => new Float64Array(bl));
    net.criticHead.W = data.critic.W.map(Wl => Wl.map(r => new Float64Array(r)));
    net.criticHead.b = data.critic.b.map(bl => new Float64Array(bl));
    return net;
  }
}

// ═══════════════════════════════════════════════════════════════════
// GAE — Generalized Advantage Estimation
// ═══════════════════════════════════════════════════════════════════

/**
 * GAE(γ, λ):
 *   δ_t = r_t + γ·V(s_{t+1}) - V(s_t)
 *   A_t = Σ_{l=0}^{∞} (γλ)^l · δ_{t+l}
 *
 * λ=0 → одношаговый advantage (низкая variance, высокий bias).
 * λ=1 → полный Monte-Carlo return (низкий bias, высокая variance).
 * Обычно λ=0.95.
 *
 * @param {Object[]} trajectory — [{ state, action, reward, value, done }]
 * @param {number} gamma — дисконт (0.99)
 * @param {number} lambda — GAE λ (0.95)
 * @param {number} lastValue — V(s_T) для bootstrap
 * @returns {Object} — { advantages, returns }
 */
function computeGAE(trajectory, gamma = 0.99, lambda = 0.95, lastValue = 0) {
  const T = trajectory.length;
  const advantages = new Float64Array(T);
  const returns = new Float64Array(T);

  let gae = 0;
  for (let t = T - 1; t >= 0; t--) {
    const { reward, value, done } = trajectory[t];
    const nextValue = t === T - 1 ? lastValue : trajectory[t + 1].value;
    const delta = reward + gamma * nextValue * (done ? 0 : 1) - value;
    gae = delta + gamma * lambda * (done ? 0 : 1) * gae;
    advantages[t] = gae;
    returns[t] = gae + value;
  }

  return { advantages, returns };
}

// ═══════════════════════════════════════════════════════════════════
// A2C AGENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Advantage Actor-Critic агент.
 *
 * On-policy: собирает траекторию, обновляется, очищает буфер.
 * Может работать с n-step returns или GAE.
 */
class A2CAgent {
  constructor(config = {}) {
    this.stateDim = config.stateDim || 10;
    this.actionDim = config.actionDim || 3;
    this.hiddenDim = config.hiddenDim || 64;
    this.nHiddenLayers = config.nHiddenLayers || 2;
    this.learningRate = config.learningRate || 0.0007;
    this.gamma = config.gamma ?? 0.99;
    this.lambda = config.lambda ?? 0.95;
    this.valueCoef = config.valueCoef ?? 0.5;
    this.entropyCoef = config.entropyCoef ?? 0.01;
    this.maxGradNorm = config.maxGradNorm ?? 0.5;
    this.useGAE = config.useGAE !== false;

    this.network = new ActorCriticNetwork({
      stateDim: this.stateDim,
      actionDim: this.actionDim,
      hiddenDim: this.hiddenDim,
      nHiddenLayers: this.nHiddenLayers,
    });

    this.trajectory = [];
    this.stats = {
      episodes: 0,
      steps: 0,
      avgReward: 0,
      avgEntropy: 0,
      avgValueLoss: 0,
    };
    this.history = [];
  }

  /**
   * Выбор действия.
   */
  selectAction(state) {
    const { action, prob, probs, value, cache } = this.network.sampleAction(state);
    return { action, prob, probs, value, cache };
  }

  /**
   * Сохранение шага.
   */
  store(state, action, reward, value, done, cache = null) {
    this.trajectory.push({ state, action, reward, value, done, cache });
    this.stats.steps++;
  }

  /**
   * Обновление сети после эпизода.
   */
  update(lastValue = 0) {
    const T = this.trajectory.length;
    if (T < 2) return { updated: false, reason: 'trajectory_too_short' };

    // GAE
    const { advantages, returns } = computeGAE(
      this.trajectory,
      this.gamma,
      this.lambda,
      lastValue
    );

    // Нормализация advantages
    const meanAdv = mean(Array.from(advantages));
    const stdAdv = std(Array.from(advantages)) || 1;
    const normalizedAdv = Array.from(advantages).map(a => (a - meanAdv) / stdAdv);

    // Обучение
    let totalEntropy = 0;
    let totalValueLoss = 0;
    let totalPolicyLoss = 0;

    for (let t = 0; t < T; t++) {
      const step = this.trajectory[t];

      // Forward для получения свежего cache
      const forward = this.network.forward(step.state);
      const cache = {
        probs: forward.probs,
        value: forward.value,
        cache: forward.cache,
      };

      const grads = this.network.backward(
        step.action,
        normalizedAdv[t],
        returns[t],
        cache,
        { valueCoef: this.valueCoef, entropyCoef: this.entropyCoef }
      );

      // Gradient clipping
      const gradsClipped = this._clipGrads(grads, this.maxGradNorm);

      // Update
      this.network.update(gradsClipped, this.learningRate);

      totalEntropy += grads.entropy;
      totalValueLoss += grads.valueLoss;
      // Policy loss: -log π(a|s) · A(s,a)
      const logProb = Math.log(Math.max(cache.probs[step.action], 1e-10));
      totalPolicyLoss += -logProb * normalizedAdv[t];
    }

    const avgReward = mean(this.trajectory.map(t => t.reward));

    this.stats.episodes++;
    this.stats.avgReward = (this.stats.avgReward * (this.stats.episodes - 1) + avgReward) / this.stats.episodes;
    this.stats.avgEntropy = totalEntropy / T;
    this.stats.avgValueLoss = totalValueLoss / T;

    this.history.push({
      episode: this.stats.episodes,
      avgReward,
      policyLoss: totalPolicyLoss / T,
      valueLoss: totalValueLoss / T,
      entropy: totalEntropy / T,
      steps: T,
    });

    // Очистка
    this.trajectory = [];

    return {
      updated: true,
      avgReward,
      policyLoss: totalPolicyLoss / T,
      valueLoss: totalValueLoss / T,
      entropy: totalEntropy / T,
      steps: T,
    };
  }

  _clipGrads(grads, maxNorm) {
    // Собираем все градиенты, считаем норму
    let totalNormSq = 0;
    const collect = (mats) => {
      for (const M of mats) {
        for (const row of M) {
          for (const v of row) {
            totalNormSq += v * v;
          }
        }
      }
    };
    const collectVecs = (vecs) => {
      for (const v of vecs) {
        for (const x of v) totalNormSq += x * x;
      }
    };

    collect(grads.backbone.dW);
    collect(grads.actor.dW);
    collect(grads.critic.dW);
    collectVecs(grads.backbone.db);
    collectVecs(grads.actor.db);
    collectVecs(grads.critic.db);

    const norm = Math.sqrt(totalNormSq);
    if (norm <= maxNorm) return grads;

    const scale = maxNorm / norm;
    const scaleMat = (mats) => mats.map(M => M.map(row => row.map(v => v * scale)));
    const scaleVecs = (vecs) => vecs.map(v => v.map(x => x * scale));

    return {
      backbone: {
        dW: scaleMat(grads.backbone.dW),
        db: scaleVecs(grads.backbone.db),
      },
      actor: {
        dW: scaleMat(grads.actor.dW),
        db: scaleVecs(grads.actor.db),
      },
      critic: {
        dW: scaleMat(grads.critic.dW),
        db: scaleVecs(grads.critic.db),
      },
      entropy: grads.entropy,
      valueLoss: grads.valueLoss,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// СРЕДЫ ДЛЯ CRUCIX
// ═══════════════════════════════════════════════════════════════════

/**
 * AlertPolicyEnv: решает когда отправлять алерты.
 *
 * Действия:
 *   0 — silent (не отправлять)
 *   1 — normal_alert
 *   2 — critical_alert
 *
 * State (10 признаков):
 *   [vix/50, hySpread/10, conflicts/20, sanctions/10, newAlerts/10,
 *    escalated/5, radiation/200, oil/120, gold/2200, dxy/110]
 *
 * Reward:
 *   - Правильный алерт на серьёзное событие: +1..+2
 *   - Ложный алерт: -0.4..-0.6
 *   - Молчание когда надо было: -0.8
 *   - Молчание когда не надо было: +0.2
 */
class AlertPolicyEnv {
  constructor(history) {
    this.history = history;
    this.currentStep = 0;
    this.maxSteps = history.length - 2;
  }

  reset() {
    this.currentStep = 0;
    return this._getState();
  }

  _getState() {
    const h = this.history[this.currentStep];
    if (!h) return new Float64Array(10);

    return new Float64Array([
      (h.fred?.vix ?? 20) / 50,
      (h.fred?.hySpread ?? 3) / 10,
      (h.gdelt?.conflictEvents?.length ?? 0) / 20,
      (h.sanctions?.count ?? 0) / 10,
      (h.delta?.newAlerts ?? 0) / 10,
      (h.delta?.escalatedAlerts ?? 0) / 5,
      (h.radiation ? Math.max(...Object.values(h.radiation).map(r => r.cpm || 0)) : 0) / 200,
      (h.energy?.oilPrice ?? 70) / 120,
      (h.gold?.price ?? 1900) / 2200,
      (h.dxy?.value ?? 100) / 110,
    ]);
  }

  step(action) {
    const next = this.history[this.currentStep + 1];
    const future = this.history[this.currentStep + 2];

    if (!next) {
      return {
        nextState: this._getState(),
        reward: 0,
        done: true,
      };
    }

    const nextVix = next.fred?.vix ?? 20;
    const futureVix = future?.fred?.vix ?? nextVix;
    const nextConflicts = next.gdelt?.conflictEvents?.length ?? 0;

    const isSerious = nextVix > 28 || nextConflicts > 12 || futureVix > 32;

    let reward;
    if (action === 0) {
      reward = isSerious ? -0.8 : 0.2;
    } else if (action === 1) {
      reward = isSerious ? 1.0 : -0.4;
    } else {
      reward = (isSerious && nextVix > 30) ? 2.0 : -0.6;
    }

    this.currentStep++;
    const done = this.currentStep >= this.maxSteps;

    return {
      nextState: this._getState(),
      reward,
      done,
      info: { isSerious, nextVix, nextConflicts },
    };
  }
}

/**
 * SourceSelectionEnv: какие источники опрашивать.
 *
 * Действия:
 *   0 — normal sweep (только базовые)
 *   1 — add extra sources (medium)
 *   2 — deep scan (все)
 *
 * State — те же 10 признаков.
 * Reward — за точность прогноза при заданном уровне сканирования.
 */
class SourceSelectionEnv {
  constructor(history) {
    this.history = history;
    this.currentStep = 0;
    this.maxSteps = history.length - 2;
  }

  reset() {
    this.currentStep = 0;
    return this._getState();
  }

  _getState() {
    const h = this.history[this.currentStep];
    if (!h) return new Float64Array(10);
    return new Float64Array([
      (h.fred?.vix ?? 20) / 50,
      (h.fred?.hySpread ?? 3) / 10,
      (h.gdelt?.conflictEvents?.length ?? 0) / 20,
      (h.sanctions?.count ?? 0) / 10,
      (h.delta?.newAlerts ?? 0) / 10,
      (h.delta?.escalatedAlerts ?? 0) / 5,
      (h.radiation ? Math.max(...Object.values(h.radiation).map(r => r.cpm || 0)) : 0) / 200,
      (h.energy?.oilPrice ?? 70) / 120,
      (h.gold?.price ?? 1900) / 2200,
      (h.dxy?.value ?? 100) / 110,
    ]);
  }

  step(action) {
    const next = this.history[this.currentStep + 1];
    if (!next) {
      return { nextState: this._getState(), reward: 0, done: true };
    }

    const vix = next.fred?.vix ?? 20;
    const conflicts = next.gdelt?.conflictEvents?.length ?? 0;
    const isHighRisk = vix > 28 || conflicts > 12;

    // Reward: правильное использование ресурсов
    let reward;
    if (isHighRisk) {
      // В высоком риске нужно больше данных
      reward = action === 2 ? 1.0 : action === 1 ? 0.6 : -0.5;
    } else {
      // В спокойствии не тратим ресурсы
      reward = action === 0 ? 0.5 : action === 1 ? -0.1 : -0.4;
    }

    this.currentStep++;
    return {
      nextState: this._getState(),
      reward,
      done: this.currentStep >= this.maxSteps,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// ОБУЧЕНИЕ
// ═══════════════════════════════════════════════════════════════════

/**
 * Обучение A2C агента на среде.
 */
function trainA2C(env, { episodes = 100, stateDim = 10, actionDim = 3, verbose = false } = {}) {
  const agent = new A2CAgent({
    stateDim,
    actionDim,
    hiddenDim: 64,
    learningRate: 0.0007,
    gamma: 0.99,
    lambda: 0.95,
    valueCoef: 0.5,
    entropyCoef: 0.01,
  });

  const history = [];

  for (let ep = 0; ep < episodes; ep++) {
    let state = env.reset();
    let done = false;
    let episodeReward = 0;

    while (!done) {
      const { action, value } = agent.selectAction(state);
      const { nextState, reward, done: isDone } = env.step(action);

      agent.store(state, action, reward, value, isDone);
      episodeReward += reward;
      state = nextState;
      done = isDone;
    }

    // Bootstrap value для последнего состояния
    const lastState = state;
    const { value: lastValue } = agent.network.forward(lastState);

    const updateResult = agent.update(lastValue);

    history.push({
      episode: ep,
      reward: episodeReward,
      ...updateResult,
    });

    if (verbose && ep % 10 === 0) {
      console.log(`[a2c] episode ${ep}: reward=${episodeReward.toFixed(2)}, policyLoss=${updateResult.policyLoss?.toFixed(4)}, entropy=${updateResult.entropy?.toFixed(4)}`);
    }
  }

  return { agent, history };
}

/**
 * Оценка обученной политики.
 */
function evaluateA2C(agent, env, nEpisodes = 20) {
  let totalReward = 0;
  const actionCounts = new Array(agent.actionDim).fill(0);

  for (let ep = 0; ep < nEpisodes; ep++) {
    let state = env.reset();
    let done = false;

    while (!done) {
      const { probs } = agent.network.forward(state);
      const action = probs.indexOf(Math.max(...probs)); // greedy
      actionCounts[action]++;
      const { nextState, reward, done: isDone } = env.step(action);
      totalReward += reward;
      state = nextState;
      done = isDone;
    }
  }

  const actionDistribution = actionCounts.map(c => c / actionCounts.reduce((a, b) => a + b, 0));

  return {
    avgReward: totalReward / nEpisodes,
    actionDistribution,
    nEpisodes,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ
// ═══════════════════════════════════════════════════════════════════

/**
 * Полный A2C-цикл для Crucix.
 *
 * @param {Array} history — массив sweep-объектов
 * @param {Object} options — параметры
 * @returns {Object} — результат обучения и политика
 */
export function crucixActorCritic(history, options = {}) {
  if (!history || history.length < 30) {
    return {
      module: 'actor_critic',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 30,
      actual: history.length,
    };
  }

  const t0 = Date.now();
  console.log(`[actor_critic] Запуск на ${history.length} sweep'ах`);

  const result = {
    module: 'actor_critic',
    available: true,
    timestamp: new Date().toISOString(),
    nSweeps: history.length,
  };

  // ─── Alert Policy ───
  try {
    const env = new AlertPolicyEnv(history);
    const { agent, history: trainHistory } = trainA2C(env, {
      episodes: options.episodes || 50,
      stateDim: 10,
      actionDim: 3,
      verbose: false,
    });

    const evalResult = evaluateA2C(agent, env, 20);
    const actionNames = ['silent', 'normal_alert', 'critical_alert'];

    result.alertPolicy = {
      avgReward: Math.round(evalResult.avgReward * 1000) / 1000,
      actionDistribution: {
        silent: Math.round(evalResult.actionDistribution[0] * 1000) / 1000,
        normal_alert: Math.round(evalResult.actionDistribution[1] * 1000) / 1000,
        critical_alert: Math.round(evalResult.actionDistribution[2] * 1000) / 1000,
      },
      trainingEpisodes: trainHistory.length,
      finalReward: Math.round((trainHistory[trainHistory.length - 1]?.reward ?? 0) * 100) / 100,
      firstReward: Math.round((trainHistory[0]?.reward ?? 0) * 100) / 100,
      learningProgress: trainHistory.length > 0
        ? Math.round((trainHistory[trainHistory.length - 1]?.reward ?? 0) -
                     (trainHistory[0]?.reward ?? 0)) * 100 / 100
        : 0,
      finalEntropy: Math.round((trainHistory[trainHistory.length - 1]?.entropy ?? 0) * 1000) / 1000,
    };

    // Сохранение модели
    const dir = join(__dirname, '..', '..', '..', 'runs', 'predictions');
    ensureDir(dir);
    saveJSON(join(dir, 'actor_critic_alert.json'), agent.network.serialize());
  } catch (e) {
    result.alertPolicy = { error: e.message };
  }

  // ─── Source Selection ───
  try {
    const env = new SourceSelectionEnv(history);
    const { agent, history: trainHistory } = trainA2C(env, {
      episodes: options.episodes || 50,
      stateDim: 10,
      actionDim: 3,
      verbose: false,
    });

    const evalResult = evaluateA2C(agent, env, 20);

    result.sourceSelection = {
      avgReward: Math.round(evalResult.avgReward * 1000) / 1000,
      actionDistribution: {
        normal_sweep: Math.round(evalResult.actionDistribution[0] * 1000) / 1000,
        add_sources: Math.round(evalResult.actionDistribution[1] * 1000) / 1000,
        deep_scan: Math.round(evalResult.actionDistribution[2] * 1000) / 1000,
      },
      finalReward: Math.round((trainHistory[trainHistory.length - 1]?.reward ?? 0) * 100) / 100,
      firstReward: Math.round((trainHistory[0]?.reward ?? 0) * 100) / 100,
    };

    const dir = join(__dirname, '..', '..', '..', 'runs', 'predictions');
    ensureDir(dir);
    saveJSON(join(dir, 'actor_critic_source.json'), agent.network.serialize());
  } catch (e) {
    result.sourceSelection = { error: e.message };
  }

  result.interpretation = result.alertPolicy?.avgReward > 0
    ? `A2C обучен. Alert policy avg reward: ${result.alertPolicy.avgReward}`
    : 'A2C не смог обучиться';

  result.elapsedMs = Date.now() - t0;

  // Сохранение общего результата
  const dir = join(__dirname, '..', '..', '..', 'runs', 'predictions');
  ensureDir(dir);
  saveJSON(join(dir, 'actor_critic.json'), result);

  console.log(`[actor_critic] Цикл завершён за ${result.elapsedMs}ms`);
  return result;
}

// ═══════════════════════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════════════════════

export {
  A2CAgent,
  ActorCriticNetwork,
  MLP,
  AlertPolicyEnv,
  SourceSelectionEnv,
  computeGAE,
  trainA2C,
  evaluateA2C,
};
