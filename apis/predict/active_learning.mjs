// apis/predict/active_learning.mjs
// Активное обучение: система сама определяет, какие данные собрать.
//
// Теоретическая основа:
//   Settles, B. (2012). "Active Learning". Morgan & Claypool.
//   Cohn, D., Atlas, L., & Ladner, R. (1994). "Improving Generalization
//   with Active Learning". Machine Learning, 15, 201-221.
//   Auer, P. (2002). "Using Confidence Bounds for Exploitation-Exploration
//   Trade-offs". Journal of Machine Learning Research, 3, 397-422. — UCB.
//   Thompson, W. R. (1933). "On the likelihood that one unknown probability
//   exceeds another". Biometrika, 25, 285-294. — Thompson Sampling.
//   Brochu, E., Cora, V. M., & de Freitas, N. (2010). "A Tutorial on
//   Bayesian Optimization". arXiv:1012.2599. — EI.
//
// Применение в Crucix:
//   Система пассивно собирает данные со всех 27 источников. Активное
//   обучение позволяет определить, какие источники дадут максимум
//   информации о текущей неопределённости прогноза, и приоритизировать
//   их опрос.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// Acquisition functions
// ============================================================

function ucbAcquisition(estimate, uncertainty, explorationRate = 2.0) {
  return estimate + explorationRate * uncertainty;
}

function expectedImprovement(prediction, uncertainty, bestSoFar, xi = 0.01) {
  const delta = prediction - bestSoFar - xi;
  if (uncertainty === 0) return Math.max(0, delta);
  const z = delta / uncertainty;
  return delta * normalCDF(z) + uncertainty * normalPDF(z);
}

function normalCDF(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function normalPDF(x) {
  return Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);
}

function erf(x) {
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return sign * y;
}

function thompsonSample(mean, variance) {
  if (mean >= 0 && mean <= 1 && variance > 0) {
    const alpha = mean * ((mean * (1 - mean)) / variance - 1);
    const beta = (1 - mean) * ((mean * (1 - mean)) / variance - 1);
    return sampleBeta(Math.max(alpha, 0.1), Math.max(beta, 0.1));
  }
  return mean + gaussianRandom(0, Math.sqrt(variance));
}

function sampleBeta(alpha, beta) {
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y + 1e-10);
}

function sampleGamma(shape) {
  const d = shape < 1 ? shape + 1 : shape;
  const c = 1 / Math.sqrt(9 * d);
  let x, v;
  do {
    do {
      x = gaussianRandom(0, 1);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
  } while (
    Math.random() > 0.5 * (1 + (x * x) / 2) ** 2 - Math.random() * 0 &&
    Math.random() > (1 + (x * x) / 2) ** 2 * Math.exp(-(x * x) / 2) * 1
  );
  const u = Math.random();
  return shape < 1 ? (u ** (1 / shape)) * d * v : d * v;
}

function gaussianRandom(mean, std) {
  const u1 = Math.random();
  const u2 = Math.random();
  return (
    mean + std * Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2)
  );
}

// ============================================================
// Active Learner
// ============================================================

class ActiveLearner {
  constructor() {
    this.sources = new Map();
    this.targetVariables = new Map();
    this.history = [];
    this.explorationRate = 2.0;
  }

  registerSource(sourceId, config) {
    this.sources.set(sourceId, {
      id: sourceId,
      name: config.name || sourceId,
      estimate: config.initialEstimate !== undefined ? config.initialEstimate : 0.5,
      uncertainty:
        config.initialUncertainty !== undefined ? config.initialUncertainty : 1.0,
      observationCount: 0,
      lastObservation: null,
      cost: config.cost !== undefined ? config.cost : 1.0,
      coverage: config.coverage || [],
      latency: config.latency || 0,
    });
  }

  registerTarget(targetId, config) {
    this.targetVariables.set(targetId, {
      id: targetId,
      name: config.name || targetId,
      currentEstimate:
        config.initialEstimate !== undefined ? config.initialEstimate : 0.5,
      currentUncertainty:
        config.initialUncertainty !== undefined ? config.initialUncertainty : 1.0,
      sources: config.sources || [],
    });
  }

  observe(sourceId, value, uncertainty) {
    const source = this.sources.get(sourceId);
    if (!source) return;

    const n = source.observationCount + 1;
    const newEstimate =
      (source.estimate * source.observationCount + value) / n;
    const newUncertainty =
      source.uncertainty * Math.sqrt(source.observationCount / n);

    source.estimate = newEstimate;
    source.uncertainty = Math.max(0.01, newUncertainty);
    source.observationCount = n;
    source.lastObservation = new Date().toISOString();

    for (const [targetId, target] of this.targetVariables) {
      if (target.sources.includes(sourceId)) {
        this._updateTargetEstimate(targetId);
      }
    }
  }

  _updateTargetEstimate(targetId) {
    const target = this.targetVariables.get(targetId);
    if (!target) return;

    let totalWeight = 0;
    let weightedSum = 0;
    let minUncertainty = Infinity;

    for (const sourceId of target.sources) {
      const source = this.sources.get(sourceId);
      if (!source) continue;
      const weight = 1 / (source.uncertainty + 1e-10);
      weightedSum += source.estimate * weight;
      totalWeight += weight;
      minUncertainty = Math.min(minUncertainty, source.uncertainty);
    }

    target.currentEstimate = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    target.currentUncertainty =
      minUncertainty * Math.max(0.1, 1 - target.sources.length * 0.15);
  }

  prioritize() {
    const recommendations = [];

    for (const [sourceId, source] of this.sources) {
      let maxUtility = -Infinity;
      let bestTarget = null;
      let acquisitionType = null;

      for (const [targetId, target] of this.targetVariables) {
        if (!target.sources.includes(sourceId)) continue;

        const ucb = ucbAcquisition(
          source.estimate,
          source.uncertainty,
          this.explorationRate
        );
        const ei = expectedImprovement(
          source.estimate,
          source.uncertainty,
          target.currentEstimate
        );
        const ts = thompsonSample(source.estimate, source.uncertainty ** 2);

        const utility = Math.max(ucb, ei, ts) / source.cost;

        if (utility > maxUtility) {
          maxUtility = utility;
          bestTarget = targetId;
          acquisitionType =
            ucb >= ei && ucb >= ts ? 'UCB' : ei >= ts ? 'EI' : 'Thompson';
        }
      }

      if (bestTarget) {
        recommendations.push({
          sourceId,
          sourceName: source.name,
          targetId: bestTarget,
          utility: maxUtility,
          acquisitionType,
          currentEstimate: source.estimate,
          currentUncertainty: source.uncertainty,
          observationCount: source.observationCount,
          expectedInfoGain: source.uncertainty * 0.5,
          priority: maxUtility,
        });
      }
    }

    recommendations.sort((a, b) => b.priority - a.priority);
    return recommendations;
  }

  recommend() {
    const ranked = this.prioritize();
    if (ranked.length === 0) {
      return {
        action: 'no_recommendation',
        message: 'All sources sufficiently covered',
      };
    }

    const top = ranked[0];
    return {
      action: 'collect_data',
      source: top.sourceName,
      sourceId: top.sourceId,
      reason: `Max uncertainty reduction for "${top.targetId}" (utility=${top.utility.toFixed(3)})`,
      acquisitionMethod: top.acquisitionType,
      currentUncertainty: top.currentUncertainty,
      expectedInfoGain: top.expectedInfoGain,
      allRecommendations: ranked.slice(0, 10),
    };
  }

  serialize() {
    return JSON.stringify({
      sources: Object.fromEntries(this.sources),
      targets: Object.fromEntries(this.targetVariables),
      history: this.history.slice(-100),
      explorationRate: this.explorationRate,
    });
  }

  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const al = new ActiveLearner();
    al.explorationRate = data.explorationRate || 2.0;
    al.history = data.history || [];
    for (const [id, s] of Object.entries(data.sources || {})) al.sources.set(id, s);
    for (const [id, t] of Object.entries(data.targets || {})) al.targetVariables.set(id, t);
    return al;
  }
}

// ============================================================
// Готовый цикл для Crucix
// ============================================================

function initCrucixActiveLearner() {
  const al = new ActiveLearner();

  const sources = [
    { id: 'gdelt',       name: 'GDELT Events',       cost: 0.5, coverage: ['conflictLevel', 'geopolitical'] },
    { id: 'fred',        name: 'FRED Economic',      cost: 0.3, coverage: ['marketStability', 'economicRisk'] },
    { id: 'yahoo',       name: 'Yahoo Finance',      cost: 0.2, coverage: ['marketStability'] },
    { id: 'sanctions',   name: 'Sanctions Tracker',  cost: 0.4, coverage: ['sanctionsRisk', 'geopolitical'] },
    { id: 'radiation',   name: 'Radiation Monitor',  cost: 0.6, coverage: ['nuclearRisk'] },
    { id: 'flightaware', name: 'FlightAware',        cost: 0.5, coverage: ['militaryActivity'] },
    { id: 'ais',         name: 'AIS Maritime',       cost: 0.5, coverage: ['navalActivity'] },
    { id: 'polymarket',  name: 'Polymarket',         cost: 0.3, coverage: ['predictionMarket'] },
    { id: 'metaculus',   name: 'Metaculus',          cost: 0.3, coverage: ['predictionMarket'] },
    { id: 'satellite',   name: 'Satellite Imagery',  cost: 0.9, coverage: ['militaryActivity', 'navalActivity'] },
  ];

  for (const s of sources) {
    al.registerSource(s.id, {
      name: s.name,
      cost: s.cost,
      initialEstimate: 0.5,
      initialUncertainty: 0.8,
      coverage: s.coverage,
    });
  }

  al.registerTarget('conflictLevel', {
    name: 'Conflict level',
    sources: ['gdelt', 'satellite', 'flightaware', 'polymarket'],
  });
  al.registerTarget('marketStability', {
    name: 'Market stability',
    sources: ['fred', 'yahoo', 'metaculus'],
  });
  al.registerTarget('militaryActivity', {
    name: 'Military activity',
    sources: ['satellite', 'flightaware', 'ais', 'gdelt'],
  });
  al.registerTarget('geopolitical', {
    name: 'Geopolitical risk',
    sources: ['gdelt', 'sanctions', 'polymarket', 'metaculus'],
  });

  return al;
}

export {
  ucbAcquisition,
  expectedImprovement,
  thompsonSample,
  ActiveLearner,
  initCrucixActiveLearner,
};
