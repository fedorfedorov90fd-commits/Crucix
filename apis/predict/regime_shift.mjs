// apis/predict/regime_shift.mjs
// Детекция смены режима: CUSUM, Page-Hinkley, BOCPD, PELT.
//
// Теоретическая основа:
//   Page, E. S. (1954). "Continuous Inspection Schemes". Biometrika, 41, 100-115.
//   Basseville, M., & Nikiforov, I. V. (1993). "Detection of Abrupt Changes:
//   Theory and Application". Prentice Hall.
//   Adams, R. P., & MacKay, D. J. C. (2007). "Bayesian Online Changepoint
//   Detection". arXiv:0710.3742.
//   Killick, R., Fearnhead, P., & Eckley, I. A. (2012). "Optimal Detection of
//   Changepoints with a Linear Computational Cost". JASA, 107(500), 1590-1598.
//   Hinkley, D. V. (1971). "Inference about the change-point from cumulative
//   sum tests". Biometrika, 58, 509-523.
//
// Применение в Crucix:
//   Определение момента, когда система структурно изменилась —
//   "ломается" привычный режим. Это критично для ансамбля прогнозов:
//   когда режим сменяется, веса моделей нужно пересчитать.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// CUSUM — Cumulative Sum
// ============================================================

function cusumDetect(series, threshold = 5, drift = 0.5) {
  if (!Array.isArray(series) || series.length < 10) {
    return { changePoints: [], statistics: [] };
  }

  const baselineLength = Math.min(20, series.length);
  const baseline = series.slice(0, baselineLength);
  const mean = baseline.reduce((a, b) => a + b, 0) / baselineLength;

  let cusumPos = 0;
  let cusumNeg = 0;
  const statistics = [];
  const changePoints = [];

  for (let i = 0; i < series.length; i++) {
    cusumPos = Math.max(0, cusumPos + (series[i] - mean - drift));
    cusumNeg = Math.max(0, cusumNeg + (-series[i] + mean - drift));

    statistics.push({ index: i, cusumPos, cusumNeg, value: series[i] });

    if (cusumPos > threshold) {
      changePoints.push({
        index: i,
        type: 'upward_shift',
        magnitude: cusumPos,
        cusum: cusumPos,
      });
      cusumPos = 0;
    }
    if (cusumNeg > threshold) {
      changePoints.push({
        index: i,
        type: 'downward_shift',
        magnitude: cusumNeg,
        cusum: cusumNeg,
      });
      cusumNeg = 0;
    }
  }

  return { changePoints, statistics, baselineMean: mean };
}

// ============================================================
// Page-Hinkley
// ============================================================

function pageHinkleyDetect(series, alpha = 0.01, lambda = 50) {
  if (!Array.isArray(series) || series.length < 10) {
    return { changePoints: [], detectionIndex: -1 };
  }

  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const variance = series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length;
  const std = Math.sqrt(variance);
  const delta = alpha * std;

  let cumSum = 0;
  let minCumSum = Infinity;
  let detectionIndex = -1;
  const statistics = [];
  const changePoints = [];

  for (let i = 0; i < series.length; i++) {
    cumSum += series[i] - mean - delta;
    if (cumSum < minCumSum) minCumSum = cumSum;
    const testStatistic = cumSum - minCumSum;

    statistics.push({ index: i, cumSum, testStatistic, minCumSum });

    if (testStatistic > lambda && detectionIndex === -1) {
      detectionIndex = i;
      changePoints.push({
        index: i,
        type: 'regime_shift',
        testStatistic,
        threshold: lambda,
      });
    }
  }

  return { changePoints, detectionIndex, statistics, threshold: lambda };
}

// ============================================================
// Bayesian Online Changepoint Detection
// ============================================================

function bocpdDetect(series, hazardRate = 1 / 100, distributionModel = null) {
  if (!Array.isArray(series) || series.length < 10) {
    return { changePoints: [], runLengthProbs: [] };
  }

  const model = distributionModel || {
    priorMean: series[0],
    priorVar: 1.0,
    obsVar: 1.0,

    update(prior, x) {
      const precision = 1 / prior.var + 1 / this.obsVar;
      const newMean = (prior.mean / prior.var + x / this.obsVar) / precision;
      const newVar = 1 / precision;
      return { mean: newMean, var: newVar };
    },

    likelihood(prior, x) {
      const predictiveMean = prior.mean;
      const predictiveVar = prior.var + this.obsVar;
      const diff = x - predictiveMean;
      return (
        Math.exp(-(diff * diff) / (2 * predictiveVar)) /
        Math.sqrt(2 * Math.PI * predictiveVar)
      );
    },
  };

  const runLengthProbs = [];
  let R = [1.0];
  let predictiveProbs = [{ mean: model.priorMean, var: model.priorVar }];
  const changePoints = [];

  for (let t = 0; t < series.length; t++) {
    const x = series[t];
    const likelihoods = predictiveProbs.map((p) => model.likelihood(p, x));

    const growthProbs = R.map((r, i) => r * (1 - hazardRate) * likelihoods[i]);
    const cpProb = R.reduce(
      (sum, r, i) => sum + r * hazardRate * likelihoods[i],
      0
    );

    const newR = [cpProb, ...growthProbs];
    const total = newR.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < newR.length; i++) newR[i] /= total;

    const newPredictive = predictiveProbs.map((p) => model.update(p, x));
    newPredictive.unshift({ mean: model.priorMean, var: model.priorVar });

    R = newR;
    predictiveProbs = newPredictive;
    runLengthProbs.push({ index: t, runLengthProbs: [...R] });

    if (R[0] > 0.5 && t > 5) {
      changePoints.push({
        index: t,
        probability: R[0],
        type: 'bayesian_changepoint',
      });
    }
  }

  return { changePoints, runLengthProbs, hazardRate };
}

// ============================================================
// PELT — Pruned Exact Linear Time
// ============================================================

function peltDetect(series, beta = 10, costFn = null) {
  if (!Array.isArray(series) || series.length < 10) {
    return { changePoints: [] };
  }

  const cost =
    costFn ||
    ((data) => {
      if (data.length === 0) return 0;
      const m = data.reduce((a, b) => a + b, 0) / data.length;
      return data.reduce((s, v) => s + (v - m) ** 2, 0);
    });

  const n = series.length;
  const F = [0];
  const cp = [[]];
  const candidates = [0];

  for (let t = 1; t <= n; t++) {
    let minCost = Infinity;
    let bestTau = -1;

    for (const tau of candidates) {
      const segmentCost = cost(series.slice(tau, t));
      const totalCost = F[tau] + segmentCost + beta;
      if (totalCost < minCost) {
        minCost = totalCost;
        bestTau = tau;
      }
    }

    F[t] = minCost;
    cp[t] = bestTau >= 0 ? [...cp[bestTau], bestTau] : [];

    const newCandidates = [t];
    for (const tau of candidates) {
      const segCost = cost(series.slice(tau, t));
      if (F[tau] + segCost <= F[t]) {
        newCandidates.push(tau);
      }
    }
    candidates.length = 0;
    candidates.push(...newCandidates);
  }

  const changePoints = cp[n]
    .filter((idx) => idx > 0 && idx < n)
    .map((idx) => ({ index: idx - 1, type: 'pelt_changepoint' }));

  return {
    changePoints,
    totalCost: F[n],
    segments: changePoints.length + 1,
  };
}

// ============================================================
// Композитный анализ для Crucix
// ============================================================

function crucixRegimeShiftDetection(history) {
  if (!Array.isArray(history) || history.length < 20) {
    return { available: false, message: 'Insufficient history (need 20+)' };
  }

  const vixSeries = history
    .map((h) => h.fred && h.fred.vix)
    .filter((v) => typeof v === 'number' && !isNaN(v));
  const conflictSeries = history.map((h) =>
    h.gdelt && Array.isArray(h.gdelt.conflictEvents)
      ? h.gdelt.conflictEvents.length
      : 0
  );
  const tensionSeries = history.map((h) =>
    typeof h.tension === 'number' ? h.tension : 0.5
  );

  const results = {};

  if (vixSeries.length > 10) {
    results.vixCUSUM = cusumDetect(vixSeries, 5, 0.5);
  }
  if (conflictSeries.length > 10) {
    results.conflictPageHinkley = pageHinkleyDetect(conflictSeries, 0.01, 50);
  }
  if (tensionSeries.length > 15) {
    results.tensionBOCPD = bocpdDetect(tensionSeries, 1 / 100);
  }
  if (vixSeries.length > 20) {
    results.vixPELT = peltDetect(vixSeries, 10);
  }

  const allChangePoints = [
    ...((results.vixCUSUM && results.vixCUSUM.changePoints) || []).map((cp) => ({
      ...cp,
      source: 'cusum_vix',
    })),
    ...((results.conflictPageHinkley && results.conflictPageHinkley.changePoints) || []).map((cp) => ({
      ...cp,
      source: 'pagehinkley_conflicts',
    })),
    ...((results.tensionBOCPD && results.tensionBOCPD.changePoints) || []).map((cp) => ({
      ...cp,
      source: 'bocpd_tension',
    })),
    ...((results.vixPELT && results.vixPELT.changePoints) || []).map((cp) => ({
      ...cp,
      source: 'pelt_vix',
    })),
  ];

  const windowSize = 5;
  const consensusShifts = [];
  for (let i = 0; i < allChangePoints.length; i++) {
    const cp = allChangePoints[i];
    const nearby = allChangePoints.filter(
      (other) =>
        Math.abs(other.index - cp.index) <= windowSize && other.source !== cp.source
    );
    if (nearby.length >= 1) {
      consensusShifts.push({
        index: cp.index,
        sources: [cp.source, ...nearby.map((n) => n.source)],
        confidence: (1 + nearby.length) / 4,
        type: 'consensus_regime_shift',
      });
    }
  }

  const result = {
    module: 'regime_shift',
    available: true,
    results,
    allChangePoints,
    consensusShifts,
    regimeShiftDetected: consensusShifts.length > 0,
    severity:
      consensusShifts.length > 2
        ? 'high'
        : consensusShifts.length > 0
        ? 'medium'
        : 'low',
    timestamp: new Date().toISOString(),
  };

  try {
    const dir = join(__dirname, '..', '..', 'runs', 'predictions');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `regime_shift_${Date.now()}.json`),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    // Работает даже без диска
  }

  return result;
}

export {
  cusumDetect,
  pageHinkleyDetect,
  bocpdDetect,
  peltDetect,
  crucixRegimeShiftDetection,
};
