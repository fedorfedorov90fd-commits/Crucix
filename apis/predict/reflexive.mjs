// apis/predict/reflexive.mjs
// Рефлексивное прогнозирование: моделирование влияния публикации прогноза
// на саму систему.
//
// Теоретическая основа:
//   Soros, G. (1987). "The Alchemy of Finance". Simon & Schuster. — концепция
//   рефлексивности: прогноз влияет на систему, которую он прогнозирует.
//   Tetlock, P. E. (2005). "Expert Political Judgment". Princeton. —
//   self-fulfilling и self-negating прогнозы.
//   Merton, R. K. (1948). "The Self-Fulfilling Prophecy". Antioch Review, 8(2).
//
// Ключевые идеи:
//   1. Прогноз, став публичным, изменяет поведение акторов.
//   2. Два типа рефлексивности:
//      - self-fulfilling: публикация делает событие более вероятным
//      - self-negating: публикация делает событие менее вероятным
//   3. Сила эффекта зависит от:
//      - чувствительности акторов (mediaExposure, reactivity, rationality)
//      - горизонта прогноза (ближайшие часы — сильнее)
//      - исторического bias (если прошлые прогнозы сбывались — эффект выше)
//
// Применение в Crucix:
//   Скорректированная вероятность = original + reflexive_effect.
//   Система честно учитывает, что её собственное влияние — часть прогноза.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// Классификация типа рефлексивности
// ============================================================

function classifyReflexivity(forecast, actorSensitivity) {
  const prob = forecast.probability || 0.5;
  const direction = forecast.direction || 'neutral';

  if (direction === 'negative' && prob > 0.8 && actorSensitivity > 0.7) {
    return 'self_fulfilling';
  }
  if (direction === 'negative' && prob > 0.6 && actorSensitivity > 0.5) {
    return 'self_negating';
  }
  if (direction === 'positive' && prob > 0.6 && actorSensitivity > 0.4) {
    return 'self_fulfilling';
  }
  return 'neutral';
}

// ============================================================
// Модель влияния одного прогноза
// ============================================================

function modelReflexiveEffect(forecast, actors, history = []) {
  const sensitivity = computeActorSensitivity(actors);
  const reflexivityType = classifyReflexivity(forecast, sensitivity);
  const baseEffect = sensitivity * 0.15 * (forecast.probability - 0.5) * 2;
  const horizonFactor = Math.exp(-(forecast.horizonHours || 24) / 168);
  const historicalBias = computeHistoricalReflexivityBias(history);

  let adjustedProb = forecast.probability;

  switch (reflexivityType) {
    case 'self_fulfilling':
      adjustedProb = forecast.probability + baseEffect * horizonFactor * (1 + historicalBias);
      break;
    case 'self_negating':
      adjustedProb = forecast.probability - baseEffect * horizonFactor * (1 + historicalBias);
      break;
    case 'neutral':
      adjustedProb = forecast.probability + historicalBias * 0.02;
      break;
  }

  adjustedProb = Math.max(0.001, Math.min(0.999, adjustedProb));

  return {
    originalProb: forecast.probability,
    adjustedProb,
    reflexivityType,
    effectMagnitude: Math.abs(adjustedProb - forecast.probability),
    sensitivity,
    historicalBias,
    horizonFactor,
    analysis: {
      description: describeReflexivity(reflexivityType, adjustedProb - forecast.probability),
      recommendedAction: recommendAction(reflexivityType, forecast),
    },
  };
}

// ============================================================
// Чувствительность акторов
// ============================================================

function computeActorSensitivity(actors) {
  if (!actors || typeof actors !== 'object') return 0.3;

  const entries = Object.values(actors);
  if (entries.length === 0) return 0.3;

  let total = 0;
  for (const props of entries) {
    const mediaExposure = props.mediaExposure !== undefined ? props.mediaExposure : 0.5;
    const reactivity = props.reactivity !== undefined ? props.reactivity : 0.5;
    const rationality = props.rationality !== undefined ? props.rationality : 0.5;
    total += mediaExposure * reactivity * (0.5 + rationality * 0.5);
  }
  return total / entries.length;
}

// ============================================================
// Историческая коррекция
// ============================================================

function computeHistoricalReflexivityBias(history) {
  if (!Array.isArray(history) || history.length < 5) return 0;

  let bias = 0;
  let count = 0;
  for (const h of history) {
    if (!h.published || h.outcome === null || h.outcome === undefined) continue;
    const direction = h.outcome === 1 ? 1 : -1;
    const confidence = (h.probability || 0.5) - 0.5;
    bias += direction * confidence * 0.1;
    count++;
  }

  if (count === 0) return 0;
  return Math.max(-0.5, Math.min(0.5, bias / count));
}

// ============================================================
// Описания и рекомендации
// ============================================================

function describeReflexivity(type, shift) {
  const sign = shift > 0 ? 'increase' : 'decrease';
  const mag = (Math.abs(shift) * 100).toFixed(1);
  switch (type) {
    case 'self_fulfilling':
      return `Self-fulfilling forecast: publication will lead to ${sign} of probability by ${mag}%`;
    case 'self_negating':
      return `Self-negating forecast: publication will reduce probability by ${mag}% (actors take precautionary measures)`;
    default:
      return `Neutral forecast: publication will not significantly affect probability`;
  }
}

function recommendAction(type, forecast) {
  switch (type) {
    case 'self_fulfilling':
      if (forecast.direction === 'negative') {
        return 'CAUTION: publication of self-fulfilling negative forecast may worsen situation. Consider limited publication.';
      }
      return 'Publication is safe: forecast may encourage positive outcome.';
    case 'self_negating':
      return 'Publication recommended: forecast may trigger preventive measures and reduce risk.';
    default:
      return 'Publication neutral. Standard protocol.';
  }
}

// ============================================================
// Рекурсивная коррекция
// ============================================================

function recursiveReflexiveCorrection(currentForecast, previousForecasts, actors) {
  let workingProb = currentForecast.probability || 0.5;
  const corrections = [];

  for (let i = 0; i < (previousForecasts || []).length; i++) {
    const prev = previousForecasts[i];
    const ageDays = (Date.now() - new Date(prev.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const decay = Math.exp(-ageDays / 30);

    const effect = modelReflexiveEffect(
      {
        probability: prev.probability,
        direction: prev.direction,
        horizonHours: 24,
      },
      actors
    );

    const residualEffect = effect.effectMagnitude * decay * 0.3;
    if (effect.reflexivityType === 'self_fulfilling') {
      workingProb += residualEffect;
    } else if (effect.reflexivityType === 'self_negating') {
      workingProb -= residualEffect;
    }

    corrections.push({
      fromPrevious: prev.timestamp,
      type: effect.reflexivityType,
      residualEffect: residualEffect * decay,
      ageDays,
    });
  }

  const currentEffect = modelReflexiveEffect(
    { ...currentForecast, probability: workingProb },
    actors,
    previousForecasts || []
  );

  const finalProb = currentEffect.adjustedProb;

  return {
    originalProb: currentForecast.probability,
    recursiveProb: workingProb,
    finalProb: Math.max(0.001, Math.min(0.999, finalProb)),
    totalShift: finalProb - currentForecast.probability,
    corrections,
    currentEffect,
  };
}

// ============================================================
// Оценка точности рефлексивности (ReflexBench-стиль)
// ============================================================

function evaluateReflexivity(history) {
  const published = (history || []).filter((h) => h.published && h.outcome !== null && h.outcome !== undefined);
  const unpublished = (history || []).filter((h) => !h.published && h.outcome !== null && h.outcome !== undefined);

  if (published.length < 5 || unpublished.length < 5) {
    return { available: false, message: 'Insufficient data for reflexivity evaluation' };
  }

  const brierPublished = brierScore(published);
  const brierUnpublished = brierScore(unpublished);

  const difference = brierUnpublished.score - brierPublished.score;

  let assessment;
  if (difference > 0.02) assessment = 'self_fulfilling_dominant';
  else if (difference < -0.02) assessment = 'self_negating_dominant';
  else assessment = 'neutral';

  return {
    available: true,
    brierPublished: brierPublished.score,
    brierUnpublished: brierUnpublished.score,
    difference,
    assessment,
    publishedCount: published.length,
    unpublishedCount: unpublished.length,
  };
}

function brierScore(predictions) {
  if (!predictions.length) return { score: 0 };
  let sum = 0;
  for (const p of predictions) {
    const f = typeof p.probability === 'number' ? p.probability : 0.5;
    const o = p.outcome ? 1 : 0;
    sum += (f - o) ** 2;
  }
  return { score: sum / predictions.length };
}

// ============================================================
// Готовый цикл для Crucix
// ============================================================

async function applyReflexiveCorrection(forecast, context = {}) {
  const { previousForecasts = [], actors = defaultActors() } = context;

  const result = recursiveReflexiveCorrection(forecast, previousForecasts, actors);

  try {
    const dir = join(__dirname, '..', '..', 'runs', 'predictions');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `reflexive_${Date.now()}.json`), JSON.stringify(result, null, 2));
  } catch (e) {
    // Модуль должен работать даже без диска
  }

  return {
    module: 'reflexive',
    originalProbability: forecast.probability,
    reflexiveProbability: result.finalProb,
    totalShift: result.totalShift,
    reflexivityType: result.currentEffect.reflexivityType,
    analysis: result.currentEffect.analysis,
    corrections: result.corrections,
    timestamp: new Date().toISOString(),
  };
}

function defaultActors() {
  return {
    markets:    { mediaExposure: 0.9, reactivity: 0.8, rationality: 0.6 },
    government: { mediaExposure: 0.7, reactivity: 0.6, rationality: 0.7 },
    public:     { mediaExposure: 0.8, reactivity: 0.7, rationality: 0.3 },
    military:   { mediaExposure: 0.4, reactivity: 0.5, rationality: 0.8 },
  };
}

export {
  classifyReflexivity,
  modelReflexiveEffect,
  recursiveReflexiveCorrection,
  evaluateReflexivity,
  computeActorSensitivity,
  computeHistoricalReflexivityBias,
  applyReflexiveCorrection,
  defaultActors,
};
