// apis/predict/v6/continual_learning.mjs
// Continual Learning — адаптация моделей без catastrophic forgetting
// Методы: EWC (Elastic Weight Consolidation), Synaptic Intelligence
//
// Теоретическая основа:
//   EWC:
//     - Kirkpatrick, J., et al. (2017). "Overcoming catastrophic
//       forgetting in neural networks". PNAS.
//   Synaptic Intelligence:
//     - Zenke, F., Poole, B., & Ganguli, S. (2017). "Continual Learning
//       Through Synaptic Intelligence". ICML.
//
// Применение:
//   Прогностический ансамбль Crucix учится на новых sweep'ах,
//   не забывая старые паттерны (кризисы, редкие события).
//
// Версия: 6.0.0

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function matVec(A, x) {
  return A.map(row => dot(row, x));
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-Math.max(-50, Math.min(50, x))));
}

function softmax(arr) {
  const m = Math.max(...arr);
  const e = arr.map(v => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map(v => v / s);
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch { return fallback; }
}

function saveJSON(fp, data) {
  ensureDir(dirname(fp));
  writeFileSync(fp, JSON.stringify(data, null, 2));
}

// ═══════════════════════════════════════════════════
// EWCLearner — Elastic Weight Consolidation
// Kirkpatrick et al., 2017
// Идея: после обучения на задаче A, фиксируем Fisher Information
//        для каждого параметра. При обучении на задаче B добавляем
//        штраф за отклонение от оптимума A, пропорциональный Fisher.
// ═══════════════════════════════════════════════════

class EWCLearner {
  constructor(config = {}) {
    this.inputSize = config.inputSize || 10;
    this.hiddenSize = config.hiddenSize || 16;
    this.outputSize = config.outputSize || 3;
    this.lr = config.learningRate || 0.01;
    this.lambdaEWC = config.lambdaEWC ?? 400; // сила EWC-штрафа

    const heInit = (fi, fo) => (Math.random() * 2 - 1) * Math.sqrt(2 / (fi + fo));
    this.W1 = Array.from({ length: this.hiddenSize }, () =>
      Array.from({ length: this.inputSize }, () => heInit(this.inputSize, this.hiddenSize)));
    this.b1 = new Array(this.hiddenSize).fill(0);
    this.W2 = Array.from({ length: this.outputSize }, () =>
      Array.from({ length: this.hiddenSize }, () => heInit(this.hiddenSize, this.outputSize)));
    this.b2 = new Array(this.outputSize).fill(0);

    this.fisher = null;
    this.optimalParams = null;
    this.taskId = 0;
    this.tasksLearned = 0;
    this.lossHistory = [];
  }

  forward(x) {
    const z1 = matVec(this.W1, x).map((v, i) => v + this.b1[i]);
    const h = z1.map(sigmoid);
    const z2 = matVec(this.W2, h).map((v, i) => v + this.b2[i]);
    const probs = softmax(z2);
    return { z1, h, z2, probs };
  }

  predict(x) {
    return this.forward(x).probs;
  }

  computeLoss(X, y) {
    let loss = 0;
    for (let i = 0; i < X.length; i++) {
      const p = this.forward(X[i]).probs;
      for (let c = 0; c < this.outputSize; c++) {
        if (y[i][c] > 0) loss -= y[i][c] * Math.log(Math.max(1e-10, p[c]));
      }
    }
    return loss / X.length;
  }

  ewcPenalty() {
    if (!this.fisher || !this.optimalParams) return 0;
    let penalty = 0;
    for (let b = 0; b < this.hiddenSize; b++)
      for (let a = 0; a < this.inputSize; a++)
        penalty += this.fisher.W1[b][a] * (this.W1[b][a] - this.optimalParams.W1[b][a]) ** 2;
    for (let j = 0; j < this.hiddenSize; j++)
      penalty += this.fisher.b1[j] * (this.b1[j] - this.optimalParams.b1[j]) ** 2;
    for (let c = 0; c < this.outputSize; c++)
      for (let a = 0; a < this.hiddenSize; a++)
        penalty += this.fisher.W2[c][a] * (this.W2[c][a] - this.optimalParams.W2[c][a]) ** 2;
    for (let j = 0; j < this.outputSize; j++)
      penalty += this.fisher.b2[j] * (this.b2[j] - this.optimalParams.b2[j]) ** 2;
    return 0.5 * this.lambdaEWC * penalty;
  }

  trainStep(X, y) {
    const n = X.length;
    const gradW1 = this.W1.map(r => r.map(() => 0));
    const gradb1 = new Array(this.hiddenSize).fill(0);
    const gradW2 = this.W2.map(r => r.map(() => 0));
    const gradb2 = new Array(this.outputSize).fill(0);

    for (let i = 0; i < n; i++) {
      const { z1, h, probs } = this.forward(X[i]);
      const dz2 = probs.map((p, c) => p - y[i][c]);

      for (let c = 0; c < this.outputSize; c++)
        for (let a = 0; a < this.hiddenSize; a++)
          gradW2[c][a] += h[a] * dz2[c];
      for (let c = 0; c < this.outputSize; c++) gradb2[c] += dz2[c];

      const dh = new Array(this.hiddenSize).fill(0);
      for (let c = 0; c < this.outputSize; c++)
        for (let a = 0; a < this.hiddenSize; a++)
          dh[a] += this.W2[c][a] * dz2[c];

      const dz1 = z1.map((z, a) => dh[a] * sigmoid(z) * (1 - sigmoid(z)));

      for (let b = 0; b < this.hiddenSize; b++)
        for (let a = 0; a < this.inputSize; a++)
          gradW1[b][a] += X[i][a] * dz1[b];
      for (let b = 0; b < this.hiddenSize; b++) gradb1[b] += dz1[b];
    }

    // Нормализация + EWC-градиент
    for (let b = 0; b < this.hiddenSize; b++)
      for (let a = 0; a < this.inputSize; a++) {
        let g = gradW1[b][a] / n;
        if (this.fisher)
          g += this.lambdaEWC * this.fisher.W1[b][a] * (this.W1[b][a] - this.optimalParams.W1[b][a]);
        this.W1[b][a] -= this.lr * g;
      }
    for (let j = 0; j < this.hiddenSize; j++) {
      let g = gradb1[j] / n;
      if (this.fisher)
        g += this.lambdaEWC * this.fisher.b1[j] * (this.b1[j] - this.optimalParams.b1[j]);
      this.b1[j] -= this.lr * g;
    }
    for (let c = 0; c < this.outputSize; c++)
      for (let a = 0; a < this.hiddenSize; a++) {
        let g = gradW2[c][a] / n;
        if (this.fisher)
          g += this.lambdaEWC * this.fisher.W2[c][a] * (this.W2[c][a] - this.optimalParams.W2[c][a]);
        this.W2[c][a] -= this.lr * g;
      }
    for (let j = 0; j < this.outputSize; j++) {
      let g = gradb2[j] / n;
      if (this.fisher)
        g += this.lambdaEWC * this.fisher.b2[j] * (this.b2[j] - this.optimalParams.b2[j]);
      this.b2[j] -= this.lr * g;
    }

    const loss = this.computeLoss(X, y) + this.ewcPenalty();
    this.lossHistory.push(loss);
    return loss;
  }

  fit(X, y, epochs = 50, verbose = false) {
    for (let e = 0; e < epochs; e++) {
      const loss = this.trainStep(X, y);
      if (verbose && e % 10 === 0)
        console.log(`[EWC] task ${this.taskId} epoch ${e}: loss=${loss.toFixed(4)}`);
    }
  }

  computeFisherInformation(X, y) {
    const fisher = {
      W1: this.W1.map(r => r.map(() => 0)),
      b1: new Array(this.hiddenSize).fill(0),
      W2: this.W2.map(r => r.map(() => 0)),
      b2: new Array(this.outputSize).fill(0),
    };

    for (let i = 0; i < X.length; i++) {
      const { z1, h, probs } = this.forward(X[i]);
      const dz2 = probs.map((p, c) => p - y[i][c]);

      for (let c = 0; c < this.outputSize; c++)
        for (let a = 0; a < this.hiddenSize; a++)
          fisher.W2[c][a] += (h[a] * dz2[c]) ** 2;
      for (let c = 0; c < this.outputSize; c++)
        fisher.b2[c] += dz2[c] ** 2;

      const dh = new Array(this.hiddenSize).fill(0);
      for (let c = 0; c < this.outputSize; c++)
        for (let a = 0; a < this.hiddenSize; a++)
          dh[a] += this.W2[c][a] * dz2[c];

      const dz1 = z1.map((z, a) => dh[a] * sigmoid(z) * (1 - sigmoid(z)));

      for (let b = 0; b < this.hiddenSize; b++)
        for (let a = 0; a < this.inputSize; a++)
          fisher.W1[b][a] += (X[i][a] * dz1[b]) ** 2;
      for (let b = 0; b < this.hiddenSize; b++)
        fisher.b1[b] += dz1[b] ** 2;
    }

    const n = X.length;
    for (let b = 0; b < this.hiddenSize; b++)
      for (let a = 0; a < this.inputSize; a++) fisher.W1[b][a] /= n;
    for (let j = 0; j < this.hiddenSize; j++) fisher.b1[j] /= n;
    for (let c = 0; c < this.outputSize; c++)
      for (let a = 0; a < this.hiddenSize; a++) fisher.W2[c][a] /= n;
    for (let j = 0; j < this.outputSize; j++) fisher.b2[j] /= n;

    return fisher;
  }

  consolidate(X, y) {
    this.fisher = this.computeFisherInformation(X, y);
    this.optimalParams = {
      W1: this.W1.map(r => [...r]),
      b1: [...this.b1],
      W2: this.W2.map(r => [...r]),
      b2: [...this.b2],
    };
    this.tasksLearned++;
    this.taskId++;
    return {
      taskId: this.taskId,
      tasksLearned: this.tasksLearned,
      fisherNorm: this._fisherNorm(),
    };
  }

  _fisherNorm() {
    if (!this.fisher) return 0;
    let s = 0;
    for (const k of ['W1', 'b1', 'W2', 'b2']) {
      const m = this.fisher[k];
      if (Array.isArray(m[0])) {
        for (const row of m) for (const v of row) s += v * v;
      } else {
        for (const v of m) s += v * v;
      }
    }
    return Math.sqrt(s);
  }

  evaluateForgetting(X_old, y_old) {
    let correct = 0;
    for (let i = 0; i < X_old.length; i++) {
      const probs = this.predict(X_old[i]);
      const pred = probs.indexOf(Math.max(...probs));
      const actual = y_old[i].indexOf(Math.max(...y_old[i]));
      if (pred === actual) correct++;
    }
    return { accuracy: correct / X_old.length, forgetting: 1 - correct / X_old.length };
  }

  serialize() {
    return JSON.stringify({
      inputSize: this.inputSize,
      hiddenSize: this.hiddenSize,
      outputSize: this.outputSize,
      lr: this.lr,
      lambdaEWC: this.lambdaEWC,
      W1: this.W1, b1: this.b1, W2: this.W2, b2: this.b2,
      fisher: this.fisher,
      optimalParams: this.optimalParams,
      taskId: this.taskId,
      tasksLearned: this.tasksLearned,
      lossHistory: this.lossHistory.slice(-100),
    });
  }

  static deserialize(str) {
    const d = JSON.parse(str);
    const learner = new EWCLearner({
      inputSize: d.inputSize,
      hiddenSize: d.hiddenSize,
      outputSize: d.outputSize,
      learningRate: d.lr,
      lambdaEWC: d.lambdaEWC,
    });
    learner.W1 = d.W1;
    learner.b1 = d.b1;
    learner.W2 = d.W2;
    learner.b2 = d.b2;
    learner.fisher = d.fisher;
    learner.optimalParams = d.optimalParams;
    learner.taskId = d.taskId ?? 0;
    learner.tasksLearned = d.tasksLearned ?? 0;
    learner.lossHistory = d.lossHistory ?? [];
    return learner;
  }
}

// ═══════════════════════════════════════════════════
// SynapticIntelligence (SI) — альтернатива EWC
// Zenke et al., 2017
// Идея: накапливаем importance measure онлайн во время обучения,
//        не нужен отдельный проход для Fisher.
// ═══════════════════════════════════════════════════

class SynapticIntelligence {
  constructor(config = {}) {
    this.inputSize = config.inputSize || 10;
    this.hiddenSize = config.hiddenSize || 16;
    this.outputSize = config.outputSize || 3;
    this.lr = config.learningRate || 0.01;
    this.lambdaSI = config.lambdaSI ?? 1;
    this.zeta = config.zeta ?? 0.1;

    const heInit = (fi, fo) => (Math.random() * 2 - 1) * Math.sqrt(2 / (fi + fo));
    this.W1 = Array.from({ length: this.hiddenSize }, () =>
      Array.from({ length: this.inputSize }, () => heInit(this.inputSize, this.hiddenSize)));
    this.b1 = new Array(this.hiddenSize).fill(0);
    this.W2 = Array.from({ length: this.outputSize }, () =>
      Array.from({ length: this.hiddenSize }, () => heInit(this.hiddenSize, this.outputSize)));
    this.b2 = new Array(this.outputSize).fill(0);

    this.omega = this._zeroParams();
    this.prevParams = null;
    this.taskId = 0;
  }

  _zeroParams() {
    return {
      W1: this.W1.map(r => r.map(() => 0)),
      b1: new Array(this.hiddenSize).fill(0),
      W2: this.W2.map(r => r.map(() => 0)),
      b2: new Array(this.outputSize).fill(0),
    };
  }

  _getCurrentParams() {
    return {
      W1: this.W1.map(r => [...r]),
      b1: [...this.b1],
      W2: this.W2.map(r => [...r]),
      b2: [...this.b2],
    };
  }

  forward(x) {
    const z1 = matVec(this.W1, x).map((v, i) => v + this.b1[i]);
    const h = z1.map(sigmoid);
    const z2 = matVec(this.W2, h).map((v, i) => v + this.b2[i]);
    return softmax(z2);
  }

  predict(x) { return this.forward(x); }

  siPenalty() {
    if (!this.prevParams) return 0;
    let p = 0;
    const apply = (cur, old, imp) => {
      for (let i = 0; i < cur.length; i++)
        for (let j = 0; j < cur[i].length; j++)
          p += imp[i][j] * (cur[i][j] - old[i][j]) ** 2;
    };
    apply(this.W1, this.prevParams.W1, this.omega.W1);
    apply(this.W2, this.prevParams.W2, this.omega.W2);
    for (let j = 0; j < this.hiddenSize; j++)
      p += this.omega.b1[j] * (this.b1[j] - this.prevParams.b1[j]) ** 2;
    for (let j = 0; j < this.outputSize; j++)
      p += this.omega.b2[j] * (this.b2[j] - this.prevParams.b2[j]) ** 2;
    return 0.5 * this.lambdaSI * p;
  }

  trainStep(X, y) {
    const n = X.length;
    const gw1 = this.W1.map(r => r.map(() => 0));
    const gb1 = new Array(this.hiddenSize).fill(0);
    const gw2 = this.W2.map(r => r.map(() => 0));
    const gb2 = new Array(this.outputSize).fill(0);

    for (let i = 0; i < n; i++) {
      const z1 = matVec(this.W1, X[i]).map((v, j) => v + this.b1[j]);
      const h = z1.map(sigmoid);
      const z2 = matVec(this.W2, h).map((v, j) => v + this.b2[j]);
      const probs = softmax(z2);
      const dz2 = probs.map((p, c) => p - y[i][c]);

      for (let c = 0; c < this.outputSize; c++)
        for (let a = 0; a < this.hiddenSize; a++) gw2[c][a] += h[a] * dz2[c];
      for (let c = 0; c < this.outputSize; c++) gb2[c] += dz2[c];

      const dh = new Array(this.hiddenSize).fill(0);
      for (let c = 0; c < this.outputSize; c++)
        for (let a = 0; a < this.hiddenSize; a++) dh[a] += this.W2[c][a] * dz2[c];

      const dz1 = z1.map((z, a) => dh[a] * sigmoid(z) * (1 - sigmoid(z)));

      for (let b = 0; b < this.hiddenSize; b++)
        for (let a = 0; a < this.inputSize; a++) gw1[b][a] += X[i][a] * dz1[b];
      for (let b = 0; b < this.hiddenSize; b++) gb1[b] += dz1[b];
    }

    const update = (W, gW, omega, old, lr) => {
      for (let i = 0; i < W.length; i++)
        for (let j = 0; j < W[i].length; j++) {
          let g = gW[i][j] / n;
          if (old) g += this.lambdaSI * omega[i][j] * (W[i][j] - old[i][j]);
          W[i][j] -= lr * g;
        }
    };
    // GW2 теперь [outputSize][hiddenSize], обновление той же формы
    const updateW2 = (W, gW, omega, old, lr) => {
      for (let c = 0; c < W.length; c++)
        for (let a = 0; a < W[c].length; a++) {
          let g = gW[c][a];
          if (old) g += this.lambdaSI * omega[c][a] * (W[c][a] - old[c][a]);
          W[c][a] -= lr * g;
        }
    };
    update(this.W1, gw1, this.omega.W1, this.prevParams?.W1, this.lr);
    updateW2(this.W2, gw2, this.omega.W2, this.prevParams?.W2, this.lr);
    for (let j = 0; j < this.hiddenSize; j++) {
      let g = gb1[j] / n;
      if (this.prevParams) g += this.lambdaSI * this.omega.b1[j] * (this.b1[j] - this.prevParams.b1[j]);
      this.b1[j] -= this.lr * g;
    }
    for (let j = 0; j < this.outputSize; j++) {
      let g = gb2[j] / n;
      if (this.prevParams) g += this.lambdaSI * this.omega.b2[j] * (this.b2[j] - this.prevParams.b2[j]);
      this.b2[j] -= this.lr * g;
    }

    const loss = this._computeLoss(X, y);
    const accum = (omega, gW) => {
      for (let i = 0; i < omega.length; i++)
        for (let j = 0; j < omega[i].length; j++)
          omega[i][j] += (gW[i][j] / n) ** 2 / (loss + this.zeta);
    };
    accum(this.omega.W1, gw1);
    // omega.W2 и gw2 теперь одинаковой формы [outputSize][hiddenSize]
    accum(this.omega.W2, gw2);
    for (let j = 0; j < this.hiddenSize; j++)
      this.omega.b1[j] += (gb1[j] / n) ** 2 / (loss + this.zeta);
    for (let j = 0; j < this.outputSize; j++)
      this.omega.b2[j] += (gb2[j] / n) ** 2 / (loss + this.zeta);

    return loss + this.siPenalty();
  }

  _computeLoss(X, y) {
    let l = 0;
    for (let i = 0; i < X.length; i++) {
      const p = this.forward(X[i]);
      for (let c = 0; c < this.outputSize; c++)
        if (y[i][c] > 0) l -= y[i][c] * Math.log(Math.max(1e-10, p[c]));
    }
    return l / X.length;
  }

  fit(X, y, epochs = 50) {
    for (let e = 0; e < epochs; e++) this.trainStep(X, y);
  }

  consolidate() {
    this.prevParams = this._getCurrentParams();
    this.taskId++;
    return { taskId: this.taskId, omegaNorm: this._omegaNorm() };
  }

  _omegaNorm() {
    let s = 0;
    for (const k of ['W1', 'b1', 'W2', 'b2']) {
      const m = this.omega[k];
      if (Array.isArray(m[0])) {
        for (const row of m) for (const v of row) s += v * v;
      } else { for (const v of m) s += v * v; }
    }
    return Math.sqrt(s);
  }

  evaluateForgetting(X_old, y_old) {
    let correct = 0;
    for (let i = 0; i < X_old.length; i++) {
      const probs = this.predict(X_old[i]);
      const pred = probs.indexOf(Math.max(...probs));
      const actual = y_old[i].indexOf(Math.max(...y_old[i]));
      if (pred === actual) correct++;
    }
    return { accuracy: correct / X_old.length, forgetting: 1 - correct / X_old.length };
  }
}

// ═══════════════════════════════════════════════════
// ИНТЕГРАЦИЯ С CRUCIX
// ═══════════════════════════════════════════════════

function sweepToTaskData(history, windowSize = 30) {
  if (!history || history.length < windowSize) return null;
  const recent = history.slice(-windowSize);

  const features = recent.map(s => [
    s.fred?.vix ?? 20,
    s.gdelt?.conflictEvents?.length ?? 0,
    s.sanctions?.count ?? 0,
    s.tension ?? 0.5,
    s.radiation?.max ?? 0,
    s.fred?.hySpread ?? 2,
    s.fred?.dxy ?? 100,
    s.gdelt?.tone ?? 0,
    s.navalDetections ?? 0,
    s.flightAware?.militaryFlights ?? 0,
  ]);

  const labels = recent.map(s => {
    const vix = s.fred?.vix ?? 20;
    const conflict = s.gdelt?.conflictEvents?.length ?? 0;
    if (vix > 35 || conflict > 15) return [1, 0, 0]; // crisis
    if (vix > 25 || conflict > 8) return [0, 1, 0]; // elevated
    return [0, 0, 1]; // stable
  });

  return { X: features, y: labels };
}

export function crucixContinualLearning(history, options = {}) {
  if (!history || history.length < 30)
    return {
      module: 'continual_learning',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 30,
    };

  const stateFile = join(__dirname, '..', '..', '..', 'runs', 'predictions', 'continual_learner.json');
  const method = options.method || 'ewc';
  const epochs = options.epochs || 30;

  let learner;
  if (method === 'ewc') {
    const saved = loadJSON(stateFile, null);
    const savedIsValid = saved && Array.isArray(saved.W1) &&
      saved.W1.every(row => Array.isArray(row) && row.every(v => Number.isFinite(v)));
    if (savedIsValid) {
      learner = EWCLearner.deserialize(JSON.stringify(saved));
    } else {
      learner = new EWCLearner({
        inputSize: 10,
        hiddenSize: 16,
        outputSize: 3,
        lambdaEWC: options.lambdaEWC ?? 400,
      });
    }
  } else {
    learner = new SynapticIntelligence({
      inputSize: 10,
      hiddenSize: 16,
      outputSize: 3,
      lambdaSI: options.lambdaSI ?? 1,
    });
  }

  const taskData = sweepToTaskData(history, options.windowSize || 30);
  if (!taskData)
    return { module: 'continual_learning', available: false, reason: 'no_task_data' };

  const oldData = sweepToTaskData(history.slice(0, -30), 30);
  let forgettingBefore = null;
  if (oldData) forgettingBefore = learner.evaluateForgetting(oldData.X, oldData.y);

  const lossBefore = method === 'ewc'
    ? learner.computeLoss(taskData.X, taskData.y)
    : learner._computeLoss(taskData.X, taskData.y);
  learner.fit(taskData.X, taskData.y, epochs);
  const lossAfter = method === 'ewc'
    ? learner.computeLoss(taskData.X, taskData.y)
    : learner._computeLoss(taskData.X, taskData.y);

  let forgettingAfter = null;
  if (oldData) forgettingAfter = learner.evaluateForgetting(oldData.X, oldData.y);

  let consolidationResult;
  if (method === 'ewc') {
    consolidationResult = learner.consolidate(taskData.X, taskData.y);
    saveJSON(stateFile, JSON.parse(learner.serialize()));
  } else {
    consolidationResult = learner.consolidate();
    saveJSON(stateFile, {
      W1: learner.W1, b1: learner.b1, W2: learner.W2, b2: learner.b2,
      omega: learner.omega, prevParams: learner.prevParams, taskId: learner.taskId,
    });
  }

  const lastFeatures = taskData.X[taskData.X.length - 1];
  const prediction = learner.predict(lastFeatures);
  const classes = ['crisis', 'elevated', 'stable'];
  const predictedClass = classes[prediction.indexOf(Math.max(...prediction))];

  return {
    module: 'continual_learning',
    available: true,
    method,
    taskId: consolidationResult.taskId ?? learner.taskId,
    tasksLearned: method === 'ewc' ? learner.tasksLearned : learner.taskId,
    lossBefore: Math.round(lossBefore * 1000) / 1000,
    lossAfter: Math.round(lossAfter * 1000) / 1000,
    lossReduction: Math.round((1 - lossAfter / (lossBefore || 1)) * 1000) / 1000,
    forgettingBefore: forgettingBefore?.forgetting ?? null,
    forgettingAfter: forgettingAfter?.forgetting ?? null,
    forgettingDelta: forgettingBefore && forgettingAfter
      ? Math.round((forgettingAfter.forgetting - forgettingBefore.forgetting) * 1000) / 1000
      : null,
    prediction: {
      class: predictedClass,
      probabilities: classes.reduce((acc, c, i) => {
        acc[c] = prediction[i];
        return acc;
      }, {}),
    },
    fisherNorm: consolidationResult.fisherNorm ?? consolidationResult.omegaNorm ?? null,
    ewcPenalty: method === 'ewc' ? Math.round(learner.ewcPenalty() * 1000) / 1000 : null,
  };
}

export { EWCLearner, SynapticIntelligence };
