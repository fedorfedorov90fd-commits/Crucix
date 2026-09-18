// apis/predict/explainability.mjs
// Объяснимость прогнозов: Permutation Importance, контрфактические
// сценарии, декомпозиция неопределённости, цепочка рассуждений.
//
// Теоретическая основа:
//   Breiman, L. (2001). "Random Forests". Machine Learning, 45, 5-32. —
//   permutation importance.
//   Lundberg, S. M., & Lee, S.-I. (2017). "A Unified Approach to Interpreting
//   Model Predictions". NeurIPS. — SHAP.
//   Wachter, S., Mittelstadt, B., & Russell, C. (2017). "Counterfactual
//   Explanations Without Opening the Black Box". Harvard JOLT, 31, 841.
//   Kendall, A., & Gal, Y. (2017). "What Uncertainties Do We Need in Bayesian
//   Deep Learning for Computer Vision?". NeurIPS. — epistemic vs aleatoric.
//
// Применение в Crucix:
//   Превращение Crucix из "чёрного ящика" в "прозрачный".
//   Дашборд показывает: какой признак дал какой вклад, что если бы
//   значение было другим, и как разложена неопределённость.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// Permutation Importance
// ============================================================

function permutationImportance(predictFn, features, baseline, nShuffles = 10) {
  const importances = {};
  const featureNames = Object.keys(features || {});

  for (const name of featureNames) {
    let totalDrop = 0;
    for (let i = 0; i < nShuffles; i++) {
      const shuffled = { ...features };
      const originalValue = features[name];
      shuffled[name] =
        originalValue +
        (Math.random() - 0.5) * Math.abs(originalValue || 1) * 2;
      const shuffledPred = predictFn(shuffled);
      totalDrop += Math.abs(baseline - shuffledPred);
    }
    importances[name] = totalDrop / nShuffles;
  }

  const total = Object.values(importances).reduce((a, b) => a + b, 0);
  const normalized = {};
  for (const [k, v] of Object.entries(importances)) {
    normalized[k] = total > 0 ? v / total : 0;
  }

  const ranked = Object.entries(normalized)
    .sort((a, b) => b[1] - a[1])
    .map(([feature, importance]) => ({ feature, importance }));

  return { importances: normalized, ranked };
}

// ============================================================
// Контрфактические объяснения
// ============================================================

function counterfactualExplanation(predictFn, features, changes) {
  const basePrediction = predictFn(features);
  const counterfactuals = [];

  for (const change of changes) {
    const modified = { ...features, ...change.values };
    const newPred = predictFn(modified);
    counterfactuals.push({
      description: change.description,
      changes: change.values,
      basePrediction,
      counterfactualPrediction: newPred,
      delta: newPred - basePrediction,
      direction: newPred > basePrediction ? 'risk_up' : 'risk_down',
    });
  }

  return { basePrediction, counterfactuals };
}

// ============================================================
// Декомпозиция неопределённости
// ============================================================

function decomposeUncertainty(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return { total: 0, epistemic: 0, aleatoric: 0, mean: 0.5, disagreement: 0 };
  }

  const values = predictions
    .map((p) => (p.forecast !== undefined ? p.forecast : p.probability || 0.5))
    .filter((v) => typeof v === 'number' && !isNaN(v));

  if (values.length === 0) {
    return { total: 0, epistemic: 0, aleatoric: 0, mean: 0.5, disagreement: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const epistemic =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;

  const aleatoricValues = predictions
    .filter(
      (p) => typeof p.uncertainty === 'number' && !isNaN(p.uncertainty)
    )
    .map((p) => p.uncertainty ** 2);

  const aleatoric =
    aleatoricValues.length > 0
      ? aleatoricValues.reduce((a, b) => a + b, 0) / aleatoricValues.length
      : 0;

  return {
    total: epistemic + aleatoric,
    epistemic,
    aleatoric,
    mean,
    disagreement: Math.sqrt(epistemic),
    interpretation:
      epistemic > aleatoric
        ? 'models_disagree_needs_more_data'
        : 'inherent_noise_in_system',
    modelCount: values.length,
  };
}

// ============================================================
// Цепочка рассуждений
// ============================================================

function buildReasoningChain(prediction, importances) {
  const chain = [];

  chain.push({
    step: 1,
    title: 'Current signals',
    description: `Top contributing factors: ${
      (importances.ranked || [])
        .slice(0, 3)
        .map((r) => r.feature)
        .join(', ') || 'n/a'
    }`,
  });

  if (prediction && prediction.regimeShift) {
    chain.push({
      step: 2,
      title: 'Regime change detected',
      description: `${prediction.regimeShift.from} -> ${prediction.regimeShift.to}`,
    });
  }

  if (prediction && prediction.topRisks && prediction.topRisks.length > 0) {
    const top = prediction.topRisks[0];
    chain.push({
      step: chain.length + 1,
      title: 'Top risk forecast',
      description: `${top.name}: ${(top.probability * 100).toFixed(0)}% probability within ${
        top.horizon || '24h'
      }`,
    });
  }

  if (prediction) {
    chain.push({
      step: chain.length + 1,
      title: 'Model confidence',
      description: `Disagreement: ${((prediction.disagreement || 0) * 100).toFixed(
        0
      )}%, Models agreeing: ${prediction.modelCount || 0}/${
        prediction.totalModels || 0
      }`,
    });
  }

  return chain;
}

// ============================================================
// Готовый цикл для Crucix
// ============================================================

function defaultRiskScorer(features) {
  if (!features) return 0.5;
  const vix = features.vix || 20;
  const conflicts = features.conflictCount || 0;
  const alerts = features.newAlerts || 0;
  const hy = features.hySpread || 3;

  let score = 0.5;
  if (vix > 25) score += (vix - 25) * 0.02;
  if (conflicts > 5) score += (conflicts - 5) * 0.02;
  if (alerts > 5) score += (alerts - 5) * 0.01;
  if (hy > 4) score += (hy - 4) * 0.05;

  return Math.max(0.001, Math.min(0.999, score));
}

function crucixExplainableForecast(forecast, context = {}) {
  const {
    dataQuality = 0.8,
  } = context;

  const shap = permutationImportance(
    defaultRiskScorer,
    forecast.features || {},
    forecast.probability || 0.5,
    50
  );

  const counterfactual = counterfactualExplanation(
    defaultRiskScorer,
    forecast.features || {},
    [
      {
        description: 'VIX drops to 15',
        values: { vix: 15 },
      },
      {
        description: 'VIX spikes to 40',
        values: { vix: 40 },
      },
      {
        description: 'Conflicts drop to 0',
        values: { conflictCount: 0 },
      },
      {
        description: 'Conflicts double',
        values: {
          conflictCount:
            ((forecast.features && forecast.features.conflictCount) || 5) * 2,
        },
      },
    ]
  );

  const uncertainty = decomposeUncertainty(
    (forecast.modelPredictions || [
      { forecast: forecast.probability || 0.5 },
    ]).map((p) => ({ forecast: p, uncertainty: 1 - dataQuality }))
  );

  const reasoning = buildReasoningChain(
    { topRisks: forecast.topRisks || [], disagreement: uncertainty.disagreement },
    shap
  );

  const result = {
    module: 'explainability',
    forecast: {
      probability: forecast.probability,
      horizonHours: forecast.horizonHours || 24,
    },
    shap: shap.ranked.slice(0, 5),
    counterfactual: counterfactual.counterfactuals,
    uncertainty,
    reasoning,
    timestamp: new Date().toISOString(),
  };

  try {
    const dir = join(__dirname, '..', '..', 'runs', 'predictions');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `explainability_${Date.now()}.json`),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    // Работает даже без диска
  }

  return result;
}

export {
  permutationImportance,
  counterfactualExplanation,
  decomposeUncertainty,
  buildReasoningChain,
  crucixExplainableForecast,
  defaultRiskScorer,
};
