// apis/predict/workers/crucix_worker.mjs
// Worker для запуска тяжёлых Crucix-модулей параллельно
// (AutoML, GNN, Diffusion, Transformer training)

import { parentPort } from 'node:worker_threads';
import { MLP } from '../models/neural.mjs';
import { GradientBoosting } from '../models/gbm.mjs';
import { RandomForest } from '../models/random_forest.mjs';

function trainMLP({ X, y, layers, epochs, lr }) {
  const model = new MLP({
    layers,
    activation: 'relu',
    outputActivation: 'linear',
  });

  const result = model.fit(X, y, { epochs, batchSize: 16, lr });
  return {
    finalLoss: result.finalLoss,
    history: result.history.slice(-10),
    weights: model.W.map(Wl => Wl.map(r => Array.from(r))),
    biases: model.b.map(b => Array.from(b)),
  };
}

function trainGBM({ X, y, nEstimators, maxDepth, learningRate }) {
  const model = new GradientBoosting({
    nEstimators,
    maxDepth,
    learningRate,
    objective: 'regression',
  });
  model.fit(X, y);
  const preds = model.predict(X.slice(-5));
  return { predictions: preds, featureImportance: model.featureImportance(X[0].length) };
}

function trainRF({ X, y, nEstimators, maxDepth }) {
  const model = new RandomForest({ nEstimators, maxDepth });
  model.fit(X, y);
  const preds = model.predict(X.slice(-5));
  return { predictions: preds, oobScore: model.oobScore };
}

function crossValidate({ X, y, folds, modelConfig }) {
  const n = X.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const foldSize = Math.floor(n / folds);
  const scores = [];

  for (let f = 0; f < folds; f++) {
    const valStart = f * foldSize;
    const valEnd = f === folds - 1 ? n : valStart + foldSize;
    const valIdx = new Set(indices.slice(valStart, valEnd));
    const trainIdx = indices.filter(i => !valIdx.has(i));

    const XTrain = trainIdx.map(i => X[i]);
    const yTrain = trainIdx.map(i => y[i]);
    const XVal = Array.from(valIdx).map(i => X[i]);
    const yVal = Array.from(valIdx).map(i => y[i]);

    const model = new MLP({ layers: modelConfig.layers || [X[0].length, 32, 1] });
    model.fit(XTrain, yTrain, { epochs: modelConfig.epochs || 30, lr: 0.01 });
    const preds = model.predict(XVal).map(p => p[0]);

    let mse = 0;
    for (let i = 0; i < preds.length; i++) mse += (preds[i] - yVal[i]) ** 2;
    scores.push(mse / preds.length);
  }

  return {
    scores,
    meanScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    stdScore: Math.sqrt(scores.reduce((s, v) => s + (v - scores.reduce((a, b) => a + b, 0) / scores.length) ** 2, 0) / scores.length),
  };
}

parentPort.on('message', (task) => {
  const t0 = Date.now();

  try {
    let result;

    switch (task.action) {
      case 'train_mlp': result = trainMLP(task.payload); break;
      case 'train_gbm': result = trainGBM(task.payload); break;
      case 'train_rf': result = trainRF(task.payload); break;
      case 'cross_validate': result = crossValidate(task.payload); break;
      case 'ping': result = { pong: true, workerTime: Date.now() }; break;
      default: throw new Error(`Unknown action: ${task.action}`);
    }

    parentPort.postMessage({
      taskId: task.taskId,
      result,
      durationMs: Date.now() - t0,
    });
  } catch (e) {
    parentPort.postMessage({
      taskId: task.taskId,
      error: e.message,
      stack: e.stack,
      durationMs: Date.now() - t0,
    });
  }
});
