// apis/predict/v7/world_model.mjs
// World Models (Ha & Schmidhuber, 2018) + DreamerV3 упрощённый
//
// Теоретическая основа:
//   - Ha, D., & Schmidhuber, J. (2018). "Recurrent World Models
//     Facilitate Policy Evolution". NeurIPS 2018.
//   - Kingma, D. P., & Welling, M. (2013). "Auto-Encoding Variational
//     Bayes". ICLR 2014.
//   - Bishop, C. M. (1994). "Mixture Density Networks". NCRG Report.
//   - Hafner, D., et al. (2023). "Mastering Diverse Domains through
//     World Models". arXiv:2301.04104.
//
// Ключевая идея:
//   Агент учится "воображать" будущее в сжатом латентном пространстве:
//
//     1. VAE — сжимает наблюдение (sweep) в латентный вектор z ∈ R^32.
//        Encoder: x (inputDim) → h (hiddenDim) → (mu, logvar) → z (latentDim).
//        Decoder: z → h → x̂.
//
//     2. MDN-RNN — предсказывает распределение z_{t+1} при заданном
//        (z_t, a_t). Не точка, а смесь гауссов: MDN даёт
//        P(z_{t+1} | z_t, a_t) = Σ_i π_i · N(μ_i, σ_i²).
//
//     3. Controller — линейная политика a = tanh(W·[z;h] + b).
//
//   "Dreaming": взять z_0 из реального sweep, развернуть N шагов
//   через MDN-RNN без реальных данных. Получается симуляция.
//
// Размерности (ВАЖНО — от них всё зависит):
//   We1: [hiddenDim][inputDim]    matVec(We1, x_inputDim) → h_hiddenDim
//   Wmu: [latentDim][hiddenDim]   matVec(Wmu, h_hiddenDim) → mu_latentDim
//   Wlv: [latentDim][hiddenDim]   matVec(Wlv, h_hiddenDim) → logvar_latentDim
//   Wd1: [hiddenDim][latentDim]   matVec(Wd1, z_latentDim) → h_hiddenDim
//   Wd2: [inputDim][hiddenDim]    matVec(Wd2, h_hiddenDim) → x̂_inputDim
//
// Версия: 7.0.0

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

function ensureDir(d) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function saveJSON(fp, data) {
  ensureDir(dirname(fp));
  writeFileSync(fp, JSON.stringify(data, null, 2));
}

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch {
    return fallback;
  }
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function isFiniteArray(arr) {
  if (!Array.isArray(arr)) return false;
  for (const v of arr) {
    if (typeof v === 'number') {
      if (Number.isFinite(v) === false) return false;
    } else if (Array.isArray(v)) {
      if (isFiniteArray(v) === false) return false;
    }
  }
  return true;
}

function gaussianRandom(mu = 0, sigma = 1) {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + z * sigma;
}

function heInit(fanIn, fanOut) {
  return (Math.random() * 2 - 1) * Math.sqrt(2 / (fanIn + fanOut));
}

function xavierInit(fanIn, fanOut) {
  return (Math.random() * 2 - 1) * Math.sqrt(6 / (fanIn + fanOut));
}

/**
 * matVec(A, x): A имеет форму [outDim][inDim], x имеет длину inDim.
 * Возвращает вектор длины outDim.
 *
 * КРИТИЧНО: используем row.length (а не x.length) как длину строки,
 * и проверяем совпадение размерностей. Если inDim != x.length — NaN.
 */
function matVec(A, x) {
  const out = new Array(A.length);
  const inDim = A.length > 0 ? A[0].length : 0;
  if (inDim !== x.length) {
    // Явная ошибка вместо тихого NaN
    throw new Error(`matVec dimension mismatch: A rows have ${inDim} cols, x has ${x.length}`);
  }
  for (let i = 0; i < A.length; i++) {
    let s = 0;
    const row = A[i];
    for (let j = 0; j < inDim; j++) {
      s += row[j] * x[j];
    }
    out[i] = s;
  }
  return out;
}

function matT(A) {
  if (A.length === 0) return [];
  return A[0].map((_, i) => A.map(row => row[i]));
}

function tanh(x) {
  return Math.tanh(x);
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, x))));
}

function softmax(arr) {
  const m = Math.max(...arr);
  const e = arr.map(v => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0) || 1e-10;
  return e.map(v => v / s);
}

function softplus(x) {
  return Math.log(1 + Math.exp(Math.max(-10, Math.min(3, x)))) + 1e-6;
}

// ═══════════════════════════════════════════════════
// SECTION 1: VAE (Variational Autoencoder)
// ═══════════════════════════════════════════════════
//
// Encoder: x (inputDim) → tanh(We1·x + be1) → h (hiddenDim)
//          → mu = Wmu·h + bmu (latentDim)
//          → logvar = Wlv·h + blv (latentDim)
//          → z = mu + exp(0.5·logvar)·ε (deterministic: z = mu)
//
// Decoder: z (latentDim) → tanh(Wd1·z + bd1) → h (hiddenDim)
//          → x̂ = Wd2·h + bd2 (inputDim)
//
// Loss: MSE(x, x̂) + β·KL(q(z|x) || N(0, I))
//    где KL = -0.5 · mean(1 + logvar - mu² - exp(logvar))

class VAE {
  constructor(config = {}) {
    this.inputDim = config.inputDim || 11;
    this.hiddenDim = config.hiddenDim || 64;
    this.latentDim = config.latentDim || 32;
    this.lr = config.learningRate || 0.001;
    this.beta = config.beta ?? 0.5;

    // Encoder: We1 [hiddenDim][inputDim]
    this.We1 = Array.from({ length: this.hiddenDim }, () =>
      Array.from({ length: this.inputDim }, () => heInit(this.inputDim, this.hiddenDim)));
    this.be1 = new Array(this.hiddenDim).fill(0);

    // Wmu, Wlv: [latentDim][hiddenDim]
    this.Wmu = Array.from({ length: this.latentDim }, () =>
      Array.from({ length: this.hiddenDim }, () => xavierInit(this.hiddenDim, this.latentDim)));
    this.bmu = new Array(this.latentDim).fill(0);

    this.Wlv = Array.from({ length: this.latentDim }, () =>
      Array.from({ length: this.hiddenDim }, () => xavierInit(this.hiddenDim, this.latentDim)));
    this.blv = new Array(this.latentDim).fill(0);

    // Decoder: Wd1 [hiddenDim][latentDim], Wd2 [inputDim][hiddenDim]
    this.Wd1 = Array.from({ length: this.hiddenDim }, () =>
      Array.from({ length: this.latentDim }, () => heInit(this.latentDim, this.hiddenDim)));
    this.bd1 = new Array(this.hiddenDim).fill(0);

    this.Wd2 = Array.from({ length: this.inputDim }, () =>
      Array.from({ length: this.hiddenDim }, () => xavierInit(this.hiddenDim, this.inputDim)));
    this.bd2 = new Array(this.inputDim).fill(0);

    this.trained = false;
    this.trainSteps = 0;
    this.lossHistory = [];
  }

  /**
   * Encoder: x → (h, mu, logvar, z).
   * @param {number[]} x — длина inputDim
   * @param {boolean} deterministic — если true, z = mu (без шума)
   */
  encode(x, deterministic = false) {
    if (x.length !== this.inputDim) {
      throw new Error(`encode: x.length=${x.length} != inputDim=${this.inputDim}`);
    }

    // h = tanh(We1·x + be1)
    const preH = matVec(this.We1, x);
    const h = new Array(this.hiddenDim);
    for (let i = 0; i < this.hiddenDim; i++) {
      h[i] = tanh(preH[i] + this.be1[i]);
    }

    // mu, logvar
    const preMu = matVec(this.Wmu, h);
    const mu = new Array(this.latentDim);
    for (let i = 0; i < this.latentDim; i++) {
      mu[i] = preMu[i] + this.bmu[i];
    }

    const preLv = matVec(this.Wlv, h);
    const logvar = new Array(this.latentDim);
    for (let i = 0; i < this.latentDim; i++) {
      logvar[i] = Math.max(-5, Math.min(2, preLv[i] + this.blv[i]));
    }

    // Reparameterization
    const z = new Array(this.latentDim);
    for (let i = 0; i < this.latentDim; i++) {
      if (deterministic) {
        z[i] = mu[i];
      } else {
        z[i] = mu[i] + Math.exp(0.5 * logvar[i]) * gaussianRandom(0, 1);
      }
    }

    return { h, mu, logvar, z };
  }

  /**
   * Decoder: z → (h, xHat).
   */
  decode(z) {
    if (z.length !== this.latentDim) {
      throw new Error(`decode: z.length=${z.length} != latentDim=${this.latentDim}`);
    }

    const preH = matVec(this.Wd1, z);
    const h = new Array(this.hiddenDim);
    for (let i = 0; i < this.hiddenDim; i++) {
      h[i] = tanh(preH[i] + this.bd1[i]);
    }

    const preX = matVec(this.Wd2, h);
    const xHat = new Array(this.inputDim);
    for (let i = 0; i < this.inputDim; i++) {
      xHat[i] = preX[i] + this.bd2[i];
    }

    return { h, xHat };
  }

  /**
   * Forward + loss.
   */
  forward(x, deterministic = false) {
    const { h: hEnc, mu, logvar, z } = this.encode(x, deterministic);
    const { h: hDec, xHat } = this.decode(z);

    // Reconstruction loss (MSE)
    let reconLoss = 0;
    for (let i = 0; i < this.inputDim; i++) {
      reconLoss += (x[i] - xHat[i]) ** 2;
    }
    reconLoss /= this.inputDim;

    // KL divergence
    let kl = 0;
    for (let i = 0; i < this.latentDim; i++) {
      kl += -0.5 * (1 + logvar[i] - mu[i] * mu[i] - Math.exp(logvar[i]));
    }
    kl /= this.latentDim;

    const loss = reconLoss + this.beta * kl;

    return { hEnc, mu, logvar, z, hDec, xHat, reconLoss, kl, loss };
  }

  /**
   * Один шаг обучения. Численный градиент через finite differences.
   * Использует deterministic z = mu — иначе шум z «забивает» градиент.
   */
  trainStep(x) {
    if (x.length !== this.inputDim) return NaN;

    const eps = 1e-4;
    const lr = this.lr;

    const lossAt = (xIn) => {
      const fwd = this.forward(xIn, true);
      return fwd.loss;
    };

    // Обновляем все 4 матрицы. Не сэмплируем — обновляем все,
    // но с проверкой finite gradient. Размерности фиксированы,
    // поэтому полный обход — это ~ (hidden*input + latent*hidden + ...) шагов.
    // При малых размерах (16×11, 8×16) это быстро.

    // We1: [hiddenDim][inputDim]
    for (let i = 0; i < this.hiddenDim; i++) {
      for (let j = 0; j < this.inputDim; j++) {
        const orig = this.We1[i][j];
        this.We1[i][j] = orig + eps;
        const lp = lossAt(x);
        this.We1[i][j] = orig - eps;
        const lm = lossAt(x);
        this.We1[i][j] = orig;
        const grad = (lp - lm) / (2 * eps);
        if (Number.isFinite(grad) && Math.abs(grad) < 50) {
          this.We1[i][j] = orig - lr * grad;
        }
      }
    }

    // be1
    for (let i = 0; i < this.hiddenDim; i++) {
      const orig = this.be1[i];
      this.be1[i] = orig + eps;
      const lp = lossAt(x);
      this.be1[i] = orig - eps;
      const lm = lossAt(x);
      this.be1[i] = orig;
      const grad = (lp - lm) / (2 * eps);
      if (Number.isFinite(grad) && Math.abs(grad) < 50) {
        this.be1[i] = orig - lr * grad;
      }
    }

    // Wmu: [latentDim][hiddenDim]
    for (let i = 0; i < this.latentDim; i++) {
      for (let j = 0; j < this.hiddenDim; j++) {
        const orig = this.Wmu[i][j];
        this.Wmu[i][j] = orig + eps;
        const lp = lossAt(x);
        this.Wmu[i][j] = orig - eps;
        const lm = lossAt(x);
        this.Wmu[i][j] = orig;
        const grad = (lp - lm) / (2 * eps);
        if (Number.isFinite(grad) && Math.abs(grad) < 50) {
          this.Wmu[i][j] = orig - lr * grad;
        }
      }
    }

    // Wlv: [latentDim][hiddenDim]
    for (let i = 0; i < this.latentDim; i++) {
      for (let j = 0; j < this.hiddenDim; j++) {
        const orig = this.Wlv[i][j];
        this.Wlv[i][j] = orig + eps;
        const lp = lossAt(x);
        this.Wlv[i][j] = orig - eps;
        const lm = lossAt(x);
        this.Wlv[i][j] = orig;
        const grad = (lp - lm) / (2 * eps);
        if (Number.isFinite(grad) && Math.abs(grad) < 50) {
          this.Wlv[i][j] = orig - lr * grad;
        }
      }
    }

    // Wd1: [hiddenDim][latentDim]
    for (let i = 0; i < this.hiddenDim; i++) {
      for (let j = 0; j < this.latentDim; j++) {
        const orig = this.Wd1[i][j];
        this.Wd1[i][j] = orig + eps;
        const lp = lossAt(x);
        this.Wd1[i][j] = orig - eps;
        const lm = lossAt(x);
        this.Wd1[i][j] = orig;
        const grad = (lp - lm) / (2 * eps);
        if (Number.isFinite(grad) && Math.abs(grad) < 50) {
          this.Wd1[i][j] = orig - lr * grad;
        }
      }
    }

    // Wd2: [inputDim][hiddenDim]
    for (let i = 0; i < this.inputDim; i++) {
      for (let j = 0; j < this.hiddenDim; j++) {
        const orig = this.Wd2[i][j];
        this.Wd2[i][j] = orig + eps;
        const lp = lossAt(x);
        this.Wd2[i][j] = orig - eps;
        const lm = lossAt(x);
        this.Wd2[i][j] = orig;
        const grad = (lp - lm) / (2 * eps);
        if (Number.isFinite(grad) && Math.abs(grad) < 50) {
          this.Wd2[i][j] = orig - lr * grad;
        }
      }
    }

    // Финальный loss
    const finalLoss = lossAt(x);
    if (Number.isFinite(finalLoss)) {
      this.trainSteps++;
      this.lossHistory.push(finalLoss);
    }
    return finalLoss;
  }

  fit(X, epochs = 20, verbose = false) {
    for (let e = 0; e < epochs; e++) {
      let totalLoss = 0;
      let count = 0;
      for (const x of X) {
        const l = this.trainStep(x);
        if (Number.isFinite(l)) {
          totalLoss += l;
          count++;
        }
      }
      if (verbose && count > 0) {
        console.log(`[VAE] epoch ${e}: avg loss = ${(totalLoss / count).toFixed(4)}`);
      }
    }
    this.trained = true;
  }

  getMetrics() {
    const last100 = this.lossHistory.slice(-100);
    return {
      inputDim: this.inputDim,
      hiddenDim: this.hiddenDim,
      latentDim: this.latentDim,
      trainSteps: this.trainSteps,
      finalLoss: this.lossHistory.length > 0 ? this.lossHistory[this.lossHistory.length - 1] : null,
      avgLossLast100: last100.length > 0 ? mean(last100) : null,
      firstLoss: this.lossHistory.length > 0 ? this.lossHistory[0] : null,
      convergence:
        this.lossHistory.length > 100 &&
        mean(this.lossHistory.slice(-50)) < mean(this.lossHistory.slice(0, 50)) * 0.8,
    };
  }

  /**
   * Сериализация весов.
   */
  serialize() {
    return {
      inputDim: this.inputDim,
      hiddenDim: this.hiddenDim,
      latentDim: this.latentDim,
      lr: this.lr,
      beta: this.beta,
      We1: this.We1,
      be1: this.be1,
      Wmu: this.Wmu,
      bmu: this.bmu,
      Wlv: this.Wlv,
      blv: this.blv,
      Wd1: this.Wd1,
      bd1: this.bd1,
      Wd2: this.Wd2,
      bd2: this.bd2,
      trained: this.trained,
      trainSteps: this.trainSteps,
      lossHistory: this.lossHistory.slice(-200),
    };
  }

  static deserialize(data) {
    const vae = new VAE({
      inputDim: data.inputDim,
      hiddenDim: data.hiddenDim,
      latentDim: data.latentDim,
      learningRate: data.lr,
      beta: data.beta,
    });
    vae.We1 = data.We1;
    vae.be1 = data.be1;
    vae.Wmu = data.Wmu;
    vae.bmu = data.bmu;
    vae.Wlv = data.Wlv;
    vae.blv = data.blv;
    vae.Wd1 = data.Wd1;
    vae.bd1 = data.bd1;
    vae.Wd2 = data.Wd2;
    vae.bd2 = data.bd2;
    vae.trained = data.trained ?? false;
    vae.trainSteps = data.trainSteps ?? 0;
    vae.lossHistory = data.lossHistory ?? [];
    return vae;
  }
}

// ═══════════════════════════════════════════════════
// SECTION 2: MDN-RNN
// ═══════════════════════════════════════════════════
//
// LSTM Cell:
//   concat = [h_{t-1}; x_t; a_t]  длины (hiddenDim + inputDim + actionDim)
//   gates g ∈ {i, f, o, g}: W_gates[g] · concat + b_gates[g]
//   i_t = σ(...), f_t = σ(...), o_t = σ(...), g_t = tanh(...)
//   c_t = f_t ⊙ c_{t-1} + i_t ⊙ g_t
//   h_t = o_t ⊙ tanh(c_t)
//
// MDN Head:
//   raw = W_mdn · h_t + b_mdn  → длины 3·K·inputDim
//   π: softmax over K для каждой dim d
//   μ: [K][inputDim]
//   σ: softplus → положительные [K][inputDim]
//
// P(z_{t+1} | h_t) = Σ_k π_k · N(μ_k, σ_k²)

class MDNRNN {
  constructor(config = {}) {
    this.inputDim = config.inputDim || 32;
    this.actionDim = config.actionDim || 3;
    this.hiddenDim = config.hiddenDim || 64;
    this.nMixtures = config.nMixtures || 5;

    const combinedDim = this.hiddenDim + this.inputDim + this.actionDim;

    const gateNames = ['i', 'f', 'o', 'g'];
    this.W_gates = {};
    this.b_gates = {};
    for (const g of gateNames) {
      this.W_gates[g] = Array.from({ length: this.hiddenDim }, () =>
        Array.from({ length: combinedDim }, () => xavierInit(combinedDim, this.hiddenDim)));
      this.b_gates[g] = new Array(this.hiddenDim).fill(0);
    }

    // MDN head: [mdnOut][hiddenDim]
    const K = this.nMixtures;
    const D = this.inputDim;
    const mdnOut = 3 * K * D;

    this.W_mdn = Array.from({ length: mdnOut }, () =>
      Array.from({ length: this.hiddenDim }, () => xavierInit(this.hiddenDim, mdnOut)));
    this.b_mdn = new Array(mdnOut).fill(0);

    this.resetState();
  }

  resetState() {
    this.h = new Array(this.hiddenDim).fill(0);
    this.c = new Array(this.hiddenDim).fill(0);
  }

  /**
   * LSTM step: (x, a) → h_new.
   */
  lstmStep(x, a) {
    const combined = [...this.h, ...x, ...a];
    const combinedDim = combined.length;

    const gates = {};
    for (const g of ['i', 'f', 'o', 'g']) {
      const pre = matVec(this.W_gates[g], combined);
      const z = new Array(this.hiddenDim);
      for (let i = 0; i < this.hiddenDim; i++) {
        const v = pre[i] + this.b_gates[g][i];
        z[i] = g === 'g' ? tanh(v) : sigmoid(v);
      }
      gates[g] = z;
    }

    const newC = new Array(this.hiddenDim);
    for (let i = 0; i < this.hiddenDim; i++) {
      newC[i] = gates.f[i] * this.c[i] + gates.i[i] * gates.g[i];
    }

    const newH = new Array(this.hiddenDim);
    for (let i = 0; i < this.hiddenDim; i++) {
      newH[i] = gates.o[i] * tanh(newC[i]);
    }

    this.h = newH;
    this.c = newC;
    return newH;
  }

  /**
   * MDN head: h → (π, μ, σ).
   *   π: [inputDim][nMixtures]   (softmax over K)
   *   μ: [nMixtures][inputDim]
   *   σ: [nMixtures][inputDim]   (>0)
   */
  mdnHead(h) {
    const raw = matVec(this.W_mdn, h);
    const K = this.nMixtures;
    const D = this.inputDim;

    for (let i = 0; i < raw.length; i++) raw[i] += this.b_mdn[i];

    const piRaw = raw.slice(0, K * D);
    const muRaw = raw.slice(K * D, 2 * K * D);
    const sigmaRaw = raw.slice(2 * K * D, 3 * K * D);

    // π по каждой размерности d: K компонент
    const pi = [];
    for (let d = 0; d < D; d++) {
      const slice = [];
      for (let k = 0; k < K; k++) {
        slice.push(piRaw[k * D + d]);
      }
      pi.push(softmax(slice));
    }

    // μ: K × D
    const mu = [];
    for (let k = 0; k < K; k++) {
      mu.push(muRaw.slice(k * D, (k + 1) * D));
    }

    // σ: K × D, positive
    const sigma = [];
    for (let k = 0; k < K; k++) {
      sigma.push(sigmaRaw.slice(k * D, (k + 1) * D).map(softplus));
    }

    return { pi, mu, sigma };
  }

  forward(x, a) {
    const h = this.lstmStep(x, a);
    const dist = this.mdnHead(h);
    return { h, dist };
  }

  sample(dist) {
    const D = this.inputDim;
    const K = this.nMixtures;
    const z = new Array(D);

    for (let d = 0; d < D; d++) {
      const pi = dist.pi[d];
      const r = Math.random();
      let cum = 0;
      let chosen = K - 1;
      for (let k = 0; k < K; k++) {
        cum += pi[k];
        if (r < cum) {
          chosen = k;
          break;
        }
      }
      const muVal = dist.mu[chosen][d];
      const sigmaVal = dist.sigma[chosen][d];
      z[d] = gaussianRandom(muVal, sigmaVal);
    }

    return z;
  }

  nllLoss(dist, zTarget) {
    const D = this.inputDim;
    const K = this.nMixtures;
    let loss = 0;

    for (let d = 0; d < D; d++) {
      const pi = dist.pi[d];
      let pz = 0;
      for (let k = 0; k < K; k++) {
        const mu = dist.mu[k][d];
        const sigma = Math.max(0.01, dist.sigma[k][d]);
        const z = zTarget[d];
        const gaussianPdf =
          Math.exp(-0.5 * ((z - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
        pz += pi[k] * gaussianPdf;
      }
      loss += -Math.log(Math.max(1e-10, pz));
    }

    return loss / D;
  }

  /**
   * Обучение: NLL loss через численный градиент по MDN head (упрощённо).
   */
  fit(sequences, epochs = 10, lr = 0.001) {
    for (let e = 0; e < epochs; e++) {
      let totalLoss = 0;
      let count = 0;

      for (const seq of sequences) {
        this.resetState();
        for (let t = 0; t < seq.length - 1; t++) {
          const x = seq[t].z;
          const a = seq[t].a || new Array(this.actionDim).fill(0);
          const zTarget = seq[t + 1].z;

          const { dist } = this.forward(x, a);
          const loss = this.nllLoss(dist, zTarget);
          if (Number.isFinite(loss)) {
            totalLoss += loss;
            count++;
          }

          this._approxGradientStep(x, a, zTarget, lr);
        }
      }

      if (count > 0) {
        console.log(`[MDN-RNN] epoch ${e}: avg nll = ${(totalLoss / count).toFixed(4)}`);
      }
    }
  }

  _approxGradientStep(x, a, zTarget, lr) {
    const eps = 1e-4;
    const K = this.nMixtures;
    const D = this.inputDim;
    const mdnOut = 3 * K * D;

    // Сэмплируем ~20% весов MDN head (полный проход слишком медленный)
    for (let i = 0; i < mdnOut; i++) {
      for (let j = 0; j < this.hiddenDim; j++) {
        if (Math.random() > 0.2) continue;

        const orig = this.W_mdn[i][j];
        this.W_mdn[i][j] = orig + eps;
        const { dist: dPlus } = this.forward(x, a);
        const lp = this.nllLoss(dPlus, zTarget);

        this.W_mdn[i][j] = orig - eps;
        const { dist: dMinus } = this.forward(x, a);
        const lm = this.nllLoss(dMinus, zTarget);

        this.W_mdn[i][j] = orig;
        const grad = (lp - lm) / (2 * eps);
        if (Number.isFinite(grad) && Math.abs(grad) < 50) {
          this.W_mdn[i][j] = orig - lr * grad;
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════
// SECTION 3: Controller (linear policy)
// ═══════════════════════════════════════════════════

class Controller {
  constructor(config = {}) {
    this.stateDim = config.stateDim || 32; // z + h
    this.actionDim = config.actionDim || 3;

    // W: [actionDim][stateDim] — matVec(W, state_stateDim) → action_actionDim
    this.W = Array.from({ length: this.actionDim }, () =>
      Array.from({ length: this.stateDim }, () => xavierInit(this.stateDim, this.actionDim) * 0.1));
    this.b = new Array(this.actionDim).fill(0);
  }

  act(state) {
    const pre = matVec(this.W, state);
    const out = new Array(this.actionDim);
    for (let i = 0; i < this.actionDim; i++) {
      out[i] = tanh(pre[i] + this.b[i]);
    }
    return out;
  }

  getParams() {
    return {
      W: this.W.map(r => [...r]),
      b: [...this.b],
    };
  }

  setParams(p) {
    this.W = p.W.map(r => [...r]);
    this.b = [...p.b];
  }

  clone() {
    const c = new Controller({ stateDim: this.stateDim, actionDim: this.actionDim });
    c.setParams(this.getParams());
    return c;
  }

  mutate(sigma = 0.1) {
    // W форма [actionDim][stateDim]
    for (let i = 0; i < this.actionDim; i++) {
      for (let j = 0; j < this.stateDim; j++) {
        this.W[i][j] += gaussianRandom(0, sigma);
      }
    }
    for (let j = 0; j < this.actionDim; j++) {
      this.b[j] += gaussianRandom(0, sigma);
    }
    return this;
  }
}

// ═══════════════════════════════════════════════════
// SECTION 4: WorldModel — оркестратор
// ═══════════════════════════════════════════════════

class WorldModel {
  constructor(config = {}) {
    this.inputDim = config.inputDim || 11;
    this.latentDim = config.latentDim || 16;
    this.hiddenDim = config.hiddenDim || 32;
    this.actionDim = config.actionDim || 3;
    this.nMixtures = config.nMixtures || 3;

    this.vae = new VAE({
      inputDim: this.inputDim,
      hiddenDim: this.hiddenDim,
      latentDim: this.latentDim,
      learningRate: config.vaeLr || 0.002,
      beta: config.vaeBeta ?? 0.5,
    });

    this.rnn = new MDNRNN({
      inputDim: this.latentDim,
      actionDim: this.actionDim,
      hiddenDim: this.hiddenDim,
      nMixtures: this.nMixtures,
    });

    // Controller входной размер = latentDim + hiddenDim
    this.controller = new Controller({
      stateDim: this.latentDim + this.hiddenDim,
      actionDim: this.actionDim,
    });

    this.trained = { vae: false, rnn: false, controller: false };
    this.metadata = { trainCalls: 0, totalLatents: 0 };
  }

  encode(sweep) {
    const x = this._sweepToVector(sweep);
    return this.vae.encode(x).z;
  }

  encodeDeterministic(sweep) {
    const x = this._sweepToVector(sweep);
    return this.vae.encode(x, true).z;
  }

  decode(z) {
    return this.vae.decode(z).xHat;
  }

  /**
   * Imagination: rollout N шагов в латентном пространстве.
   */
  imagine(z0, horizon = 12, options = {}) {
    const temperature = options.temperature ?? 1.0;
    const useController = options.useController !== false;

    if (z0.length !== this.latentDim) {
      throw new Error(`imagine: z0.length=${z0.length} != latentDim=${this.latentDim}`);
    }

    let z = [...z0];
    this.rnn.resetState();

    const trajectory = [{
      step: 0,
      z: [...z],
      a: null,
      h: [...this.rnn.h],
    }];

    for (let t = 1; t <= horizon; t++) {
      const controllerInput = [...z, ...this.rnn.h];
      const a = useController
        ? this.controller.act(controllerInput)
        : new Array(this.actionDim).fill(0);

      const { h, dist } = this.rnn.forward(z, a);

      // Temperature scaling π
      let distScaled = dist;
      if (temperature !== 1.0) {
        distScaled = {
          pi: dist.pi.map(pi => {
            const scaled = pi.map(p => Math.pow(Math.max(1e-10, p), 1 / temperature));
            const sum = scaled.reduce((a, b) => a + b, 0) || 1e-10;
            return scaled.map(s => s / sum);
          }),
          mu: dist.mu,
          sigma: dist.sigma.map(row => row.map(s => s * temperature)),
        };
      }

      const zNext = this.rnn.sample(distScaled);

      trajectory.push({
        step: t,
        z: zNext,
        a,
        h: [...h],
      });

      z = zNext;
    }

    // Декодируем
    const decoded = trajectory.map(step => ({
      ...step,
      decoded: this.decode(step.z),
    }));

    return { trajectory: decoded, horizon };
  }

  /**
   * Обучение VAE + RNN на истории.
   */
  train(history, options = {}) {
    const vaeEpochs = options.vaeEpochs || 5;
    const rnnEpochs = options.rnnEpochs || 3;
    const actionDim = this.actionDim;

    // 1. Извлекаем векторы
    const X = history.map(h => this._sweepToVector(h));

    // 2. Обучаем VAE
    console.log('[WorldModel] Обучение VAE...');
    this.vae.fit(X, vaeEpochs, options.verbose);
    this.trained.vae = true;

    // 3. Encode историю
    console.log('[WorldModel] Encoding истории...');
    const latents = X.map(x => this.vae.encode(x, true).z);

    // 4. Строим последовательности
    const seqLen = Math.min(20, Math.max(3, Math.floor(history.length / 3)));
    const sequences = [];
    for (let i = 0; i + seqLen <= latents.length; i++) {
      const seq = [];
      for (let t = 0; t < seqLen; t++) {
        seq.push({
          z: latents[i + t],
          a: new Array(actionDim).fill(0),
        });
      }
      sequences.push(seq);
    }

    // 5. Обучаем RNN
    console.log(`[WorldModel] Обучение RNN на ${sequences.length} последовательностях...`);
    this.rnn.fit(sequences, rnnEpochs, this.vae.lr);
    this.trained.rnn = true;

    this.metadata.trainCalls++;
    this.metadata.totalLatents += latents.length;

    return {
      vaeMetrics: this.vae.getMetrics(),
      rnnTrained: true,
      sequences: sequences.length,
      latentsEncoded: latents.length,
    };
  }

  _sweepToVector(s) {
    return [
      (s.fred?.vix ?? 20) / 50,
      (s.fred?.hySpread ?? 3) / 10,
      (s.fred?.treasury10y ?? 4) / 6,
      (s.fred?.dxy ?? 100) / 110,
      (s.gdelt?.conflictEvents?.length ?? 0) / 20,
      (s.gdelt?.tone ?? 0) / 5,
      (s.sanctions?.count ?? 0) / 10,
      (s.tension ?? 0.5),
      (s.radiation?.max ?? 50) / 500,
      (s.energy?.oilPrice ?? 70) / 120,
      (s.gold?.price ?? 1900) / 2200,
    ];
  }

  _vectorToFeatures(vec) {
    return {
      vix: vec[0] * 50,
      hySpread: vec[1] * 10,
      treasury10y: vec[2] * 6,
      dxy: vec[3] * 110,
      conflicts: vec[4] * 20,
      tone: vec[5] * 5,
      sanctions: vec[6] * 10,
      tension: vec[7],
      radiation: vec[8] * 500,
      oilPrice: vec[9] * 120,
      goldPrice: vec[10] * 2200,
    };
  }

  serialize() {
    return {
      version: '7.0.0',
      config: {
        inputDim: this.inputDim,
        latentDim: this.latentDim,
        hiddenDim: this.hiddenDim,
        actionDim: this.actionDim,
        nMixtures: this.nMixtures,
      },
      vae: this.vae.serialize(),
      controller: this.controller.getParams(),
      trained: this.trained,
      metadata: this.metadata,
    };
  }
}

// ═══════════════════════════════════════════════════
// SECTION 5: ИНТЕГРАЦИЯ С CRUCIX
// ═══════════════════════════════════════════════════

export function crucixWorldModel(history, options = {}) {
  if (!history || history.length < 30) {
    return {
      module: 'world_model',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 30,
      actual: history.length,
    };
  }

  const t0 = Date.now();
  console.log(`[world_model] Запуск на ${history.length} sweep'ах`);

  const inputDim = 11;
  const latentDim = options.latentDim || 8;
  const hiddenDim = options.hiddenDim || 16;
  const vaeEpochs = options.vaeEpochs || 3;
  const rnnEpochs = options.rnnEpochs || 2;
  const horizon = options.horizon || 12;

  const wm = new WorldModel({
    inputDim,
    latentDim,
    hiddenDim,
    actionDim: 3,
    nMixtures: options.nMixtures || 3,
    vaeBeta: 0.5,
    vaeLr: 0.002,
  });

  let trainingMetrics;
  try {
    trainingMetrics = wm.train(history, { vaeEpochs, rnnEpochs, verbose: false });
  } catch (e) {
    return {
      module: 'world_model',
      available: false,
      error: `training failed: ${e.message}`,
      elapsedMs: Date.now() - t0,
    };
  }

  // Кодируем последний sweep детерминированно (без шума)
  const lastSweep = history[history.length - 1];
  let z0;
  try {
    z0 = wm.encodeDeterministic(lastSweep);
  } catch (e) {
    return {
      module: 'world_model',
      available: false,
      error: `encode failed: ${e.message}`,
      elapsedMs: Date.now() - t0,
    };
  }

  // Imagination
  let imagination;
  try {
    imagination = wm.imagine(z0, horizon, { temperature: 1.0 });
  } catch (e) {
    return {
      module: 'world_model',
      available: false,
      error: `imagine failed: ${e.message}`,
      elapsedMs: Date.now() - t0,
    };
  }

  // Оценка reconstruction error на последних 5 sweep'ах
  let totalRecon = 0;
  let reconCount = 0;
  for (let i = -5; i < 0; i++) {
    const x = wm._sweepToVector(history[history.length + i]);
    const { z } = wm.vae.encode(x, true);
    const { xHat } = wm.vae.decode(z);
    let err = 0;
    for (let d = 0; d < x.length; d++) err += (x[d] - xHat[d]) ** 2;
    totalRecon += Math.sqrt(err / x.length);
    reconCount++;
  }
  const avgReconError = reconCount > 0 ? totalRecon / reconCount : NaN;

  const reconQualityLabel =
    Number.isFinite(avgReconError) === false ? 'unknown'
    : avgReconError < 0.1 ? 'excellent'
    : avgReconError < 0.2 ? 'good'
    : avgReconError < 0.4 ? 'fair'
    : 'poor';

  // Человеко-читаемые воображаемые признаки
  const imaginedFeatures = imagination.trajectory.map(step => {
    const f = wm._vectorToFeatures(step.decoded);
    return {
      step: step.step,
      vix: Math.round(f.vix * 100) / 100,
      tension: Math.round(f.tension * 1000) / 1000,
      conflicts: Math.round(f.conflicts * 100) / 100,
      sanctions: Math.round(f.sanctions * 100) / 100,
      dxy: Math.round(f.dxy * 100) / 100,
    };
  });

  // Тренд
  const z0Features = wm._vectorToFeatures(wm.decode(z0));
  const zFinalFeatures = wm._vectorToFeatures(imagination.trajectory[horizon].decoded);

  const trend = {
    vix: {
      before: Math.round(z0Features.vix * 100) / 100,
      after: Math.round(zFinalFeatures.vix * 100) / 100,
      delta: Math.round((zFinalFeatures.vix - z0Features.vix) * 100) / 100,
    },
    tension: {
      before: Math.round(z0Features.tension * 1000) / 1000,
      after: Math.round(zFinalFeatures.tension * 1000) / 1000,
      delta: Math.round((zFinalFeatures.tension - z0Features.tension) * 1000) / 1000,
    },
    conflicts: {
      before: Math.round(z0Features.conflicts * 100) / 100,
      after: Math.round(zFinalFeatures.conflicts * 100) / 100,
      delta: Math.round((zFinalFeatures.conflicts - z0Features.conflicts) * 100) / 100,
    },
  };

  const tensionDelta = trend.tension.delta;
  const direction =
    tensionDelta > 0.05 ? 'escalation'
    : tensionDelta < -0.05 ? 'deescalation'
    : 'stable';

  const result = {
    module: 'world_model',
    available: true,
    elapsedMs: Date.now() - t0,
    config: { inputDim, latentDim, hiddenDim, horizon },
    training: {
      vae: trainingMetrics.vaeMetrics,
      rnnTrained: trainingMetrics.rnnTrained,
      sequences: trainingMetrics.sequences,
      latentsEncoded: trainingMetrics.latentsEncoded,
    },
    quality: {
      avgReconError: Number.isFinite(avgReconError)
        ? Math.round(avgReconError * 10000) / 10000
        : null,
      reconQuality: reconQualityLabel,
    },
    imagination: {
      horizonHours: horizon * 0.25,
      imaginedFeatures,
      trend,
    },
    interpretation:
      `World Model обучен на ${history.length} sweep'ах (latent=${latentDim}). ` +
      `Recon error: ${Number.isFinite(avgReconError) ? avgReconError.toFixed(4) : 'N/A'} (${reconQualityLabel}). ` +
      `Imagination на ${horizon} шагов (${horizon * 0.25}ч): тренд ${direction} ` +
      `(tension ${trend.tension.before} → ${trend.tension.after}, ` +
      `vix ${trend.vix.before} → ${trend.vix.after}).`,
    direction,
  };

  const outFile = join(__dirname, '..', '..', '..', 'runs', 'predictions', 'world_model.json');
  saveJSON(outFile, result);
  return result;
}

export { WorldModel, VAE, MDNRNN, Controller };
