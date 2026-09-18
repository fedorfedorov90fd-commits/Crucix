// apis/predict/meta_ensemble.mjs
// Слой 5: Meta-Learning Ensemble — нейросеть для выбора весов моделей.
//
// Идея:
//   Вместо фиксированных весов ансамбля — MetaLearner (MLP), который
//   принимает «сигнатуру режима» (8 признаков) и возвращает веса моделей
//   (softmax, сумма 1). Обучается через Adam на Brier-подобной ошибке.
//
// Архитектура MetaLearner:
//   [regime_features (8)] → hidden (32, ReLU) → [model_weights (10, softmax)]
//
// Сигнатура режима (8 признаков):
//   1. VIX уровень (нормализован к 50)
//   2. HY-спред (к 10)
//   3. Конфликты (к 20)
//   4. Санкции (к 10)
//   5. Новые алерты (к 10)
//   6. Эскалированные алерты (к 5)
//   7. Волатильность VIX (за 20 шагов)
//   8. Тренд конфликтов (за 10 шагов)
//
// Классификация режимов: crisis, elevated, normal, calm.
//
// Контракт 2 (внутренний predict-модуль):
//   - Нет route (не HTTP-эндпоинт).
//   - Есть meta (описание, категория, версия, зависимости).
//   - Экспорт именованных функций и классов. Никаких дефолтных экспортов.
//   - try/catch с параметром.
//
// Портабельность:
//   Все пути строятся относительно файла через import.meta.url.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const RUNS_DIR = join(PROJECT_ROOT, 'runs');
const PRED_DIR = join(RUNS_DIR, 'predictions');

// ─── МЕТАДАННЫЕ МОДУЛЯ ──────────────────────────────────────────

export const meta = {
  id: 'meta_ensemble',
  name: 'Мета-обучающийся ансамбль (Meta-Learning Ensemble)',
  layer: 5,
  category: 'ensemble',
  description: 'Нейросеть MetaLearner выбирает веса моделей по сигнатуре режима. Обучение через Adam на Brier-подобной ошибке.',
  version: '2.0.0',
  depends: [],
  exports: [
    'MetaLearner',
    'MetaEnsemble',
    'DEFAULT_MODELS',
    'extractRegimeSignature',
    'crucixMetaEnsemble',
  ],
};

// ─── META-LEARNER ──────────────────────────────────────────────

export class MetaLearner {
  constructor(config = {}) {
    this.inputDim = config.inputDim || 8;
    this.hiddenDim = config.hiddenDim || 32;
    this.outputDim = config.outputDim || 10;
    this.learningRate = config.learningRate || 0.01;

    this.W1 = this._initMatrix(this.hiddenDim, this.inputDim);
    this.b1 = new Float64Array(this.hiddenDim);
    this.W2 = this._initMatrix(this.outputDim, this.hiddenDim);
    this.b2 = new Float64Array(this.outputDim);

    this.mW1 = this._zerosMatrix(this.hiddenDim, this.inputDim);
    this.vW1 = this._zerosMatrix(this.hiddenDim, this.inputDim);
    this.mW2 = this._zerosMatrix(this.outputDim, this.hiddenDim);
    this.vW2 = this._zerosMatrix(this.outputDim, this.hiddenDim);
    this.mb1 = new Float64Array(this.hiddenDim);
    this.vb1 = new Float64Array(this.hiddenDim);
    this.mb2 = new Float64Array(this.outputDim);
    this.vb2 = new Float64Array(this.outputDim);
    this.t = 0;
  }

  _initMatrix(rows, cols) {
    const M = [];
    const scale = Math.sqrt(2 / rows);
    for (let i = 0; i < rows; i++) {
      const row = new Float64Array(cols);
      for (let j = 0; j < cols; j++) {
        row[j] = (Math.random() * 2 - 1) * scale;
      }
      M.push(row);
    }
    return M;
  }

  _zerosMatrix(rows, cols) {
    return Array.from({ length: rows }, () => new Float64Array(cols));
  }

  forward(regimeFeatures) {
    const h = new Float64Array(this.hiddenDim);
    for (let i = 0; i < this.hiddenDim; i++) {
      let sum = this.b1[i];
      for (let j = 0; j < this.inputDim; j++) {
        sum += this.W1[i][j] * regimeFeatures[j];
      }
      h[i] = Math.max(0, sum);
    }

    const out = new Float64Array(this.outputDim);
    for (let i = 0; i < this.outputDim; i++) {
      let sum = this.b2[i];
      for (let j = 0; j < this.hiddenDim; j++) {
        sum += this.W2[i][j] * h[j];
      }
      out[i] = sum;
    }

    const maxOut = Math.max(...out);
    const exps = Array.from(out).map(v => Math.exp(v - maxOut));
    const sumExp = exps.reduce((a, b) => a + b, 0);
    const weights = exps.map(e => e / sumExp);

    return { weights, hidden: h };
  }

  trainStep(regimeFeatures, modelPredictions, actualOutcome) {
    const { weights, hidden } = this.forward(regimeFeatures);
    const ensemblePred = weights.reduce((s, w, i) => s + w * (modelPredictions[i] || 0), 0);
    const loss = (ensemblePred - actualOutcome) ** 2;
    const dLoss_dPred = 2 * (ensemblePred - actualOutcome);

    const dOut = new Float64Array(this.outputDim);
    for (let i = 0; i < this.outputDim; i++) {
      let sum = 0;
      for (let j = 0; j < this.outputDim; j++) {
        const delta = i === j ? 1 : 0;
        sum += weights[i] * (delta - weights[j]) * (modelPredictions[j] || 0);
      }
      dOut[i] = dLoss_dPred * sum;
    }

    const dW2 = this._zerosMatrix(this.outputDim, this.hiddenDim);
    const db2 = new Float64Array(this.outputDim);
    for (let i = 0; i < this.outputDim; i++) {
      for (let j = 0; j < this.hiddenDim; j++) {
        dW2[i][j] = dOut[i] * hidden[j];
      }
      db2[i] = dOut[i];
    }

    const dHidden = new Float64Array(this.hiddenDim);
    for (let j = 0; j < this.hiddenDim; j++) {
      let sum = 0;
      for (let i = 0; i < this.outputDim; i++) {
        sum += dOut[i] * this.W2[i][j];
      }
      dHidden[j] = sum;
    }
    for (let j = 0; j < this.hiddenDim; j++) {
      if (hidden[j] <= 0) dHidden[j] = 0;
    }

    const dW1 = this._zerosMatrix(this.hiddenDim, this.inputDim);
    const db1 = new Float64Array(this.hiddenDim);
    for (let i = 0; i < this.hiddenDim; i++) {
      for (let j = 0; j < this.inputDim; j++) {
        dW1[i][j] = dHidden[i] * regimeFeatures[j];
      }
      db1[i] = dHidden[i];
    }

    this._adamUpdate(dW1, db1, dW2, db2);

    return { loss, weights, ensemblePred };
  }

  _adamUpdate(dW1, db1, dW2, db2, beta1 = 0.9, beta2 = 0.999, eps = 1e-8) {
    this.t++;
    const bc1 = 1 - Math.pow(beta1, this.t);
    const bc2 = 1 - Math.pow(beta2, this.t);

    for (let i = 0; i < this.hiddenDim; i++) {
      for (let j = 0; j < this.inputDim; j++) {
        this.mW1[i][j] = beta1 * this.mW1[i][j] + (1 - beta1) * dW1[i][j];
        this.vW1[i][j] = beta2 * this.vW1[i][j] + (1 - beta2) * dW1[i][j] ** 2;
        const mHat = this.mW1[i][j] / bc1;
        const vHat = this.vW1[i][j] / bc2;
        this.W1[i][j] -= this.learningRate * mHat / (Math.sqrt(vHat) + eps);
      }
      this.mb1[i] = beta1 * this.mb1[i] + (1 - beta1) * db1[i];
      this.vb1[i] = beta2 * this.vb1[i] + (1 - beta2) * db1[i] ** 2;
      const mHat = this.mb1[i] / bc1;
      const vHat = this.vb1[i] / bc2;
      this.b1[i] -= this.learningRate * mHat / (Math.sqrt(vHat) + eps);
    }

    for (let i = 0; i < this.outputDim; i++) {
      for (let j = 0; j < this.hiddenDim; j++) {
        this.mW2[i][j] = beta1 * this.mW2[i][j] + (1 - beta1) * dW2[i][j];
        this.vW2[i][j] = beta2 * this.vW2[i][j] + (1 - beta2) * dW2[i][j] ** 2;
        const mHat = this.mW2[i][j] / bc1;
        const vHat = this.vW2[i][j] / bc2;
        this.W2[i][j] -= this.learningRate * mHat / (Math.sqrt(vHat) + eps);
      }
      this.mb2[i] = beta1 * this.mb2[i] + (1 - beta1) * db2[i];
      this.vb2[i] = beta2 * this.vb2[i] + (1 - beta2) * db2[i] ** 2;
      const mHat = this.mb2[i] / bc1;
      const vHat = this.vb2[i] / bc2;
      this.b2[i] -= this.learningRate * mHat / (Math.sqrt(vHat) + eps);
    }
  }

  serialize() {
    return JSON.stringify({
      W1: this.W1.map(r => Array.from(r)),
      b1: Array.from(this.b1),
      W2: this.W2.map(r => Array.from(r)),
      b2: Array.from(this.b2),
      inputDim: this.inputDim,
      hiddenDim: this.hiddenDim,
      outputDim: this.outputDim,
      t: this.t,
    });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const m = new MetaLearner({
      inputDim: data.inputDim,
      hiddenDim: data.hiddenDim,
      outputDim: data.outputDim,
    });
    m.W1 = data.W1.map(r => new Float64Array(r));
    m.b1 = new Float64Array(data.b1);
    m.W2 = data.W2.map(r => new Float64Array(r));
    m.b2 = new Float64Array(data.b2);
    m.t = data.t || 0;
    return m;
  }
}

// ─── СИГНАТУРА РЕЖИМА ──────────────────────────────────────────

export function extractRegimeSignature(latest, history) {
  const vix = latest.fred?.vix || 20;
  const hySpread = latest.fred?.hySpread || 3;
  const conflicts = latest.gdelt?.conflictEvents?.length || 0;
  const sanctions = latest.sanctions?.count || 0;
  const alerts = latest.delta?.newAlerts || 0;
  const escalated = latest.delta?.escalatedAlerts || 0;

  const vixHistory = history.slice(-20).map(h => h.fred?.vix || 20).filter(v => v);
  const vixMean = vixHistory.length > 0
    ? vixHistory.reduce((a, b) => a + b, 0) / vixHistory.length
    : 20;
  const vixVolatility = vixHistory.length > 2
    ? Math.sqrt(vixHistory.reduce((s, v) => s + (v - vixMean) ** 2, 0) / vixHistory.length)
    : 0;

  const conflictHistory = history.slice(-10).map(h => h.gdelt?.conflictEvents?.length || 0);
  const conflictTrend = conflictHistory.length > 2
    ? (conflictHistory[conflictHistory.length - 1] - conflictHistory[0]) / conflictHistory.length
    : 0;

  return [
    Math.min(1, vix / 50),
    Math.min(1, hySpread / 10),
    Math.min(1, conflicts / 20),
    Math.min(1, sanctions / 10),
    Math.min(1, alerts / 10),
    Math.min(1, escalated / 5),
    Math.min(1, vixVolatility / 10),
    Math.min(1, Math.abs(conflictTrend) / 2),
  ];
}

// ─── META-ENSEMBLE ─────────────────────────────────────────────

export const DEFAULT_MODELS = [
  'bayesian', 'markov', 'montecarlo', 'timeseries', 'cascade',
  'swarm', 'gametheory', 'narrative', 'regime_shift', 'temporal_causal',
];

export class MetaEnsemble {
  constructor(modelNames = []) {
    this.modelNames = modelNames.length > 0 ? modelNames : DEFAULT_MODELS;
    this.metaLearner = new MetaLearner({
      inputDim: 8,
      hiddenDim: 32,
      outputDim: this.modelNames.length,
    });
    this.trainingHistory = [];
    this.currentWeights = null;
    this.currentRegimeSignature = null;
  }

  getWeights(latest, history) {
    const signature = extractRegimeSignature(latest, history);
    const { weights } = this.metaLearner.forward(signature);
    this.currentWeights = weights;
    this.currentRegimeSignature = signature;
    return {
      weights: Object.fromEntries(
        this.modelNames.map((name, i) => [name, weights[i]])
      ),
      signature,
      regime: this._classifyRegime(signature),
    };
  }

  _classifyRegime(sig) {
    const [vix, spread, conflicts, sanctions, alerts, escalated, vol, trend] = sig;
    const stress = vix * 0.25 + spread * 0.2 + conflicts * 0.25 + escalated * 0.2 + vol * 0.1;
    if (stress > 0.6) return 'crisis';
    if (stress > 0.4) return 'elevated';
    if (stress > 0.2) return 'normal';
    return 'calm';
  }

  train(latest, history, modelPredictions, actualOutcome) {
    const signature = extractRegimeSignature(latest, history);
    const result = this.metaLearner.trainStep(signature, modelPredictions, actualOutcome);
    this.trainingHistory.push({
      timestamp: Date.now(),
      loss: result.loss,
      regime: this._classifyRegime(signature),
      weights: result.weights,
    });
    return result;
  }

  predict(latest, history, modelPredictions) {
    const { weights } = this.metaLearner.forward(extractRegimeSignature(latest, history));
    const prediction = weights.reduce((s, w, i) => s + w * (modelPredictions[i] || 0), 0);
    return {
      prediction,
      weights: Object.fromEntries(this.modelNames.map((n, i) => [n, weights[i]])),
    };
  }

  serialize() {
    return JSON.stringify({
      modelNames: this.modelNames,
      metaLearner: this.metaLearner.serialize(),
      trainingHistory: this.trainingHistory.slice(-200),
    });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const me = new MetaEnsemble(data.modelNames);
    me.metaLearner = MetaLearner.deserialize(data.metaLearner);
    me.trainingHistory = data.trainingHistory || [];
    return me;
  }
}

// ─── ИНТЕГРАЦИЯ С CRUCIX ───────────────────────────────────────

export function crucixMetaEnsemble(latest, history, modelPredictionsByEvent) {
  if (!existsSync(PRED_DIR)) {
    try { mkdirSync(PRED_DIR, { recursive: true }); }
    catch (e) { console.warn('[meta_ensemble] Не удалось создать PRED_DIR:', e.message); }
  }

  const file = join(PRED_DIR, 'meta_ensemble.json');
  let me;
  try {
    me = existsSync(file)
      ? MetaEnsemble.deserialize(readFileSync(file, 'utf-8'))
      : new MetaEnsemble(DEFAULT_MODELS);
  } catch (e) {
    console.warn('[meta_ensemble] Ошибка загрузки состояния, создаём заново:', e.message);
    me = new MetaEnsemble(DEFAULT_MODELS);
  }

  const signature = extractRegimeSignature(latest, history);
  const regime = me._classifyRegime(signature);
  const weights = me.getWeights(latest, history);

  const trainingResults = [];
  if (modelPredictionsByEvent && Object.keys(modelPredictionsByEvent).length > 0) {
    for (const [eventId, data] of Object.entries(modelPredictionsByEvent)) {
      if (data.actualOutcome !== null && data.actualOutcome !== undefined && data.predictions) {
        const result = me.train(latest, history, data.predictions, data.actualOutcome);
        trainingResults.push({ eventId, loss: result.loss });
      }
    }
  }

  try { writeFileSync(file, me.serialize()); }
  catch (e) { console.warn('[meta_ensemble] Не удалось сохранить состояние:', e.message); }

  const sortedWeights = Object.entries(weights.weights).sort((a, b) => b[1] - a[1]);
  const topThree = sortedWeights.slice(0, 3)
    .map(([k, v]) => `${k} (${(v * 100).toFixed(0)}%)`)
    .join(', ');

  return {
    module: 'meta_ensemble',
    currentRegime: regime,
    regimeSignature: signature,
    modelWeights: weights.weights,
    topWeights: sortedWeights,
    trainingResults,
    trainingHistorySize: me.trainingHistory.length,
    interpretation: `Текущий режим: ${regime}. Наиболее релевантные модели: ${topThree}`,
    timestamp: new Date().toISOString(),
  };
}
