// apis/predict/composite_risk.mjs
// Composite Risk Indicator — единый композитный индикатор риска.
//
// Назначение:
//   Свёртка всех вероятностей из forecast.events по категориям с весами,
//   плюс корректировки от расширенных слоёв (v3/v5): причинный каскад,
//   стратегическая оценка, истощение, гиперграф, внимание, коэволюция,
//   сценарии, meta-ensemble, нарративы.
//
//   Даёт: единое число composite ∈ [0, 1], уровень (low/moderate/elevated/
//   high/critical), топ-5 драйверов, полный список сигналов, тренд,
//   калиброванную confidence.
//
// Теоретическая основа:
//   Ансамбль с динамическими весами (Brier-based) + корректировки от
//   расширенных слоёв. Согласованность сигналов повышает confidence,
//   разногласие — понижает.
//
// Версия: 1.0.1

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const CATEGORY_WEIGHTS = {
  economic: 1.0,
  geopolitical: 1.2,
  military: 1.1,
  nuclear: 1.5,
  structural: 1.3,
  unknown: 0.8,
};

const LEVEL_THRESHOLDS = [
  { level: 'low', max: 0.25 },
  { level: 'moderate', max: 0.45 },
  { level: 'elevated', max: 0.6 },
  { level: 'high', max: 0.75 },
  { level: 'critical', max: 1.0 },
];

// ============================================================
// УТИЛИТЫ
// ============================================================

function clamp01(v) {
  if (typeof v !== 'number' || isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function getLevel(value) {
  for (const t of LEVEL_THRESHOLDS) {
    if (value <= t.max) return t.level;
  }
  return 'critical';
}

function categoryWeight(category) {
  return CATEGORY_WEIGHTS[category] || CATEGORY_WEIGHTS.unknown;
}

// ============================================================
// ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Расчёт композитного риска.
 *
 * @param {Object} extended — расширенные слои (v3/v5) из forecast.extended
 * @param {Object} forecast — полный прогноз (содержит events)
 * @param {Object} options — { useTracker, trackerWeights, lastComposite }
 * @returns {Object} — { composite, level, confidence, signals, topDrivers, breakdown, corrections, trend }
 */
function computeCompositeRisk(extended, forecast, options = {}) {
  const signals = [];
  const corrections = [];
  const useTracker = options.useTracker !== false;

  // ─── 1. БАЗОВЫЕ СИГНАЛЫ ИЗ EVENTS ────────────────────────────
  const events = (forecast && forecast.events) || {};

  for (const [eventId, event] of Object.entries(events)) {
    if (!event || typeof event !== 'object') continue;

    const prob =
      event.calibratedProbability !== undefined
        ? event.calibratedProbability
        : event.finalProbability !== undefined
        ? event.finalProbability
        : event.ensemble !== undefined
        ? event.ensemble
        : 0;

    const category = event.category || 'unknown';
    const weight = categoryWeight(category);

    signals.push({
      key: eventId,
      name: event.name || eventId,
      category,
      value: clamp01(prob),
      weight,
      source: 'events',
      rationale: `horizon=${event.horizonHours || '?'}h`,
    });
  }

  // ─── 2. КОРРЕКТИРОВКИ ОТ РАСШИРЕННЫХ СЛОЁВ ──────────────────
  if (!extended || typeof extended !== 'object') {
    extended = {};
  }

  // 2.1 Причинный каскад
  if (extended.causal) {
    const c = extended.causal;
    const p = c.intervention?.probability ?? c.counterfactual?.counterfactual?.probability ?? 0;
    if (p > 0) {
      corrections.push({
        key: 'causal_cascade',
        name: 'Causal Cascade',
        value: clamp01(p),
        weight: 0.15,
        source: 'causal',
        rationale: 'do-calculus intervention effect',
      });
    }
  }

  // 2.2 Стратегическая оценка
  if (extended.combinedAssessment) {
    const ca = extended.combinedAssessment;
    const sev = { low: 0.2, medium: 0.4, high: 0.65, critical: 0.85 }[ca.severity] || 0.3;
    corrections.push({
      key: 'combined_assessment',
      name: 'Combined Strategic',
      value: sev,
      weight: 0.18,
      source: 'combined',
      rationale: ca.type || 'strategic_assessment',
    });
  }

  // 2.3 Истощение ресурсов
  if (extended.resourceExhaustion?.aggregateExhaustion !== undefined) {
    corrections.push({
      key: 'resource_exhaustion',
      name: 'Resource Exhaustion',
      value: clamp01(extended.resourceExhaustion.aggregateExhaustion),
      weight: 0.12,
      source: 'resource_exhaustion',
      rationale: extended.resourceExhaustion.overallStatus || 'unknown',
    });
  }

  // 2.4 Гиперграф
  if (extended.hypergraphContagion?.criticalHyperedges?.length > 0) {
    const nCrit = extended.hypergraphContagion.criticalHyperedges.length;
    corrections.push({
      key: 'hypergraph_contagion',
      name: 'Hypergraph Contagion',
      value: clamp01(nCrit / 5),
      weight: 0.14,
      source: 'hypergraph',
      rationale: `${nCrit} критичных гиперрёбер`,
    });
  }

  // 2.5 Внимание
  if (extended.attentionDynamics?.topExplosive) {
    const te = extended.attentionDynamics.topExplosive;
    if (te.explosiveness > 1.0) {
      corrections.push({
        key: 'attention_dynamics',
        name: 'Attention Spike',
        value: clamp01(te.explosiveness / 3),
        weight: 0.1,
        source: 'attention',
        rationale: `${te.topic}: explosiveness ${te.explosiveness.toFixed(2)}`,
      });
    }
  }

  // 2.6 Коэволюция
  if (Array.isArray(extended.adversarialCoEvolution?.adaptations)) {
    const adapting = extended.adversarialCoEvolution.adaptations.filter((a) => a.adaptation?.adapted);
    if (adapting.length > 0) {
      corrections.push({
        key: 'adversarial_coevolution',
        name: 'Adversary Adaptation',
        value: clamp01(adapting.length / 3),
        weight: 0.12,
        source: 'coevolution',
        rationale: `${adapting.length} противников адаптируются`,
      });
    }
  }

  // 2.7 Сценарии
  if (Array.isArray(extended.scenarios?.scenarios) && extended.scenarios.scenarios.length > 0) {
    const top = extended.scenarios.scenarios.reduce(
      (best, s) => (s.probability > best.probability ? s : best),
      extended.scenarios.scenarios[0]
    );
    if (top && top.severity) {
      const sev = { low: 0.3, medium: 0.5, high: 0.7, critical: 0.9 }[top.severity] || 0.4;
      corrections.push({
        key: 'scenario_top',
        name: `Scenario: ${top.name || top.id}`,
        value: clamp01(top.probability * sev),
        weight: 0.1,
        source: 'scenarios',
        rationale: `severity=${top.severity}`,
      });
    }
  }

  // 2.8 Meta-ensemble
  if (extended.metaEnsemble?.currentRegime) {
    const reg = extended.metaEnsemble.currentRegime;
    const regWeights = { calm: 0.1, normal: 0.25, elevated: 0.55, crisis: 0.85 };
    const v = regWeights[reg] || 0.3;
    corrections.push({
      key: 'meta_ensemble_regime',
      name: `Regime: ${reg}`,
      value: v,
      weight: 0.13,
      source: 'meta_ensemble',
      rationale: `current regime=${reg}`,
    });
  }

  // 2.9 Нарративы
  if (extended.narrativeWarfare?.campaignsDetected > 0) {
    const nC = extended.narrativeWarfare.campaignsDetected;
    corrections.push({
      key: 'narrative_warfare',
      name: 'Narrative Campaigns',
      value: clamp01(nC / 3),
      weight: 0.1,
      source: 'narrative',
      rationale: `${nC} кампаний`,
    });
  }

  // 2.10 Temporal causal
  if (Array.isArray(extended.temporalCausal?.shiftDetections)) {
    const acc = extended.temporalCausal.shiftDetections.filter((s) => s.type === 'accelerating');
    if (acc.length > 0) {
      corrections.push({
        key: 'temporal_acceleration',
        name: 'Temporal Acceleration',
        value: clamp01(acc.length / 4),
        weight: 0.11,
        source: 'temporal',
        rationale: `${acc.length} ускорений задержек`,
      });
    }
  }

  // ─── 3. ОБЪЕДИНЕНИЕ ─────────────────────────────────────────
  const allSignals = [...signals, ...corrections];

  if (allSignals.length === 0) {
    return {
      composite: 0,
      level: 'low',
      confidence: 0,
      signals: [],
      topDrivers: [],
      breakdown: { events: 0, corrections: 0 },
      corrections: [],
      trend: null,
      timestamp: new Date().toISOString(),
    };
  }

  // Динамические веса из трекера
  let trackerWeights = options.trackerWeights || null;
  if (!trackerWeights && useTracker) {
    try {
      const { getExtendedTracker } = require('./extended_tracker.mjs');
      const t = getExtendedTracker();
      trackerWeights = t.getStats().ensembleWeights;
    } catch (e) {
      trackerWeights = null;
    }
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (const s of allSignals) {
    let w = s.weight;
    if (trackerWeights && trackerWeights[s.source] !== undefined) {
      w = w * (0.5 + trackerWeights[s.source] * 0.5);
    }
    s.effectiveWeight = w;
    totalWeight += w;
    weightedSum += s.value * w;
  }

  const composite = totalWeight > 0 ? clamp01(weightedSum / totalWeight) : 0;

  // ─── 4. CONFIDENCE ──────────────────────────────────────────
  const values = allSignals.map((s) => s.value);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  const disagreement = Math.sqrt(variance);
  const coverage = Math.min(1, allSignals.length / 12);
  const confidence = clamp01((1 - disagreement) * 0.6 + coverage * 0.4);

  // ─── 5. ТОП-5 ДРАЙВЕРОВ ─────────────────────────────────────
  const ranked = [...allSignals]
    .map((s) => ({
      ...s,
      contribution: s.value * s.effectiveWeight,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  const topDrivers = ranked.slice(0, 5).map((s) => ({
    key: s.key,
    name: s.name,
    value: s.value,
    weight: s.weight,
    effectiveWeight: s.effectiveWeight,
    contribution: s.contribution,
    source: s.source,
    rationale: s.rationale,
  }));

  // ─── 6. ТРЕНД ───────────────────────────────────────────────
  let trend = null;
  if (options.lastComposite !== undefined && options.lastComposite !== null) {
    const delta = composite - options.lastComposite;
    trend = {
      delta: Math.round(delta * 10000) / 10000,
      direction: delta > 0.02 ? 'up' : delta < -0.02 ? 'down' : 'stable',
    };
  }

  // ─── 7. РЕЗУЛЬТАТ ───────────────────────────────────────────
  return {
    composite: Math.round(composite * 10000) / 10000,
    level: getLevel(composite),
    confidence: Math.round(confidence * 10000) / 10000,
    signals: allSignals.map((s) => ({
      key: s.key,
      name: s.name,
      value: Math.round(s.value * 10000) / 10000,
      weight: s.weight,
      effectiveWeight: Math.round((s.effectiveWeight || s.weight) * 10000) / 10000,
      source: s.source,
      rationale: s.rationale,
    })),
    topDrivers,
    breakdown: {
      events: signals.length,
      corrections: corrections.length,
      total: allSignals.length,
    },
    corrections,
    disagreement: Math.round(disagreement * 10000) / 10000,
    coverage: Math.round(coverage * 10000) / 10000,
    trend,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// ЭКСПОРТ
// ============================================================

export {
  computeCompositeRisk,
  CATEGORY_WEIGHTS,
  LEVEL_THRESHOLDS,
  getLevel,
  categoryWeight,
};
