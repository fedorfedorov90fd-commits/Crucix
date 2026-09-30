// apis/predict/crucix_engine_v3.mjs
// Crucix Engine v3 — координатор расширенных фаз J, K, L, M.
//
// Назначение:
//   Связывает 9 модулей v2.0/v3.0 в конвейер с parallel execution и
//   safeCall-обёртками. Запускается ПОСЛЕ базового engine.mjs и
//   обогащает snapshot расширенными слоями.
//
// Архитектура:
//   Фаза J: мета-слои (temporal, multilayer, narrative, resource, meta-ensemble)
//   Фаза K: сценарии (scenario_generator)
//   Фаза L: продвинутые слои (hypergraph, attention, co-evolution)
//   Фаза M: комбинированные сигналы + стратегическая оценка
//
// Принципы:
//   - Promise.allSettled — падение одного не рушит фазу
//   - safeCall с timeout на каждый модуль
//   - Graceful degradation
//   - Один snapshot — расширяется поэтапно
//
// Версия: 1.0.1

import { crucixTemporalCausalAnalysis } from './temporal_causal.mjs';
import { crucixMultiLayerCausal } from './multilayer_causal.mjs';
import { crucixNarrativeWarfare } from './narrative_warfare.mjs';
import { crucixResourceExhaustion } from './resource_exhaustion.mjs';
import { crucixMetaEnsemble } from './meta_ensemble.mjs';
import { crucixScenarioGeneration } from './scenario_generator.mjs';
import { crucixHypergraphContagion } from './hypergraph_contagion.mjs';
import { crucixAttentionDynamics } from './attention_dynamics.mjs';
import { crucixAdversarialCoEvolution } from './adversarial_coevolution.mjs';

const ENGINE_VERSION = '3.0.1';

// ============================================================
// УТИЛИТЫ
// ============================================================

async function safeCall(label, fn, fallback = null, timeoutMs = 30000) {
  try {
    const result = await Promise.race([
      Promise.resolve(fn()).then((r) => ({ ok: true, data: r })),
      new Promise((resolve) =>
        setTimeout(() => resolve({ ok: false, data: null, timeout: true }), timeoutMs)
      ),
    ]);
    if (!result.ok) {
      console.warn(`[engine-v3] ${label}: timeout after ${timeoutMs}ms`);
      return fallback;
    }
    return result.data;
  } catch (e) {
    console.error(`[engine-v3] ${label} error:`, e.message);
    return fallback;
  }
}

function safeCallSync(label, fn, fallback = null) {
  try {
    return fn();
  } catch (e) {
    console.error(`[engine-v3] ${label} error:`, e.message);
    return fallback;
  }
}

// ============================================================
// ФАЗА J — МЕТА-СЛОИ
// ============================================================

function phaseJ_MetaLayers(latest, history) {
  console.log('[engine-v3] Phase J: meta layers');

  const temporalCausal = safeCallSync(
    'temporalCausal',
    () => crucixTemporalCausalAnalysis(history),
    { error: 'failed' }
  );

  const multiLayerCausal = safeCallSync(
    'multiLayerCausal',
    () => crucixMultiLayerCausal(latest, history),
    { error: 'failed' }
  );

  const narrativeWarfare = safeCallSync(
    'narrativeWarfare',
    () => crucixNarrativeWarfare(latest, history),
    { error: 'failed' }
  );

  const resourceExhaustion = safeCallSync(
    'resourceExhaustion',
    () => crucixResourceExhaustion(latest, history),
    { error: 'failed' }
  );

  const metaEnsemble = safeCallSync(
    'metaEnsemble',
    () => crucixMetaEnsemble(latest, history, {}),
    { error: 'failed' }
  );

  return {
    temporalCausal,
    multiLayerCausal,
    narrativeWarfare,
    resourceExhaustion,
    metaEnsemble,
  };
}

// ============================================================
// ФАЗА K — СЦЕНАРИИ
// ============================================================

async function phaseK_Scenarios(latest, history) {
  console.log('[engine-v3] Phase K: scenarios');

  const context = {
    history,
    horizonHours: 168,
    count: 7,
  };

  const scenarios = await safeCall(
    'scenarioGeneration',
    () => crucixScenarioGeneration(latest, context),
    { error: 'failed' },
    60000
  );

  return { scenarios };
}

// ============================================================
// ФАЗА L — ПРОДВИНУТЫЕ СЛОИ
// ============================================================

function phaseL_AdvancedLayers(latest, history) {
  console.log('[engine-v3] Phase L: advanced layers');

  const hypergraphContagion = safeCallSync(
    'hypergraphContagion',
    () => crucixHypergraphContagion(latest, history),
    { error: 'failed' }
  );

  const attentionDynamics = safeCallSync(
    'attentionDynamics',
    () => crucixAttentionDynamics(latest, history),
    { error: 'failed' }
  );

  const adversarialCoEvolution = safeCallSync(
    'adversarialCoEvolution',
    () => crucixAdversarialCoEvolution(latest, history),
    { error: 'failed' }
  );

  return {
    hypergraphContagion,
    attentionDynamics,
    adversarialCoEvolution,
  };
}

// ============================================================
// ФАЗА M — КОМБИНИРОВАННЫЕ СИГНАЛЫ + СТРАТЕГИЧЕСКАЯ ОЦЕНКА
// ============================================================

function phaseM_CombinedSignals(extended) {
  console.log('[engine-v3] Phase M: combined signals');

  const signals = [];

  // 1. Temporal acceleration
  if (Array.isArray(extended.temporalCausal?.shiftDetections)) {
    const acc = extended.temporalCausal.shiftDetections.filter((s) => s.type === 'accelerating');
    if (acc.length >= 3) {
      signals.push({
        key: 'temporal_cascade',
        type: 'escalation_acceleration',
        severity: acc.length >= 5 ? 'critical' : 'high',
        value: Math.min(1, acc.length / 5),
        detail: `${acc.length} ускорений задержек одновременно`,
      });
    }
  }

  // 2. Multi-layer cross-layer ratio
  if (extended.multiLayerCausal?.graphStats) {
    const gs = extended.multiLayerCausal.graphStats;
    if (gs.crossLayerRatio > 0.3) {
      signals.push({
        key: 'cross_layer_cascade',
        type: 'cross_layer_contagion',
        severity: gs.crossLayerRatio > 0.5 ? 'critical' : 'high',
        value: Math.min(1, gs.crossLayerRatio),
        detail: `Cross-layer ratio ${gs.crossLayerRatio.toFixed(2)}`,
      });
    }
  }

  // 3. Narrative warfare
  if (extended.narrativeWarfare?.campaignsDetected > 0) {
    const nC = extended.narrativeWarfare.campaignsDetected;
    signals.push({
      key: 'narrative_coordinated',
      type: 'information_warfare',
      severity: nC >= 3 ? 'critical' : nC >= 2 ? 'high' : 'medium',
      value: Math.min(1, nC / 3),
      detail: `${nC} скоординированных кампаний`,
    });
  }

  // 4. Combined strategic assessment
  const narrativeThreat = extended.narrativeWarfare?.threatLevel || 0;
  const resourcePressure = extended.resourceExhaustion?.overallPressure || 0;
  if (narrativeThreat > 0.5 && resourcePressure > 0.5) {
    signals.push({
      key: 'pre_breaking_point',
      type: 'system_breaking_point',
      severity: 'critical',
      value: Math.min(1, (narrativeThreat + resourcePressure) / 2),
      detail: 'Высокая интенсивность инфовойны + критическое истощение ресурсов',
    });
  }

  // 5. Hypergraph AND-activation
  if (Array.isArray(extended.hypergraphContagion?.criticalHyperedges)) {
    const crit = extended.hypergraphContagion.criticalHyperedges;
    if (crit.length > 0) {
      signals.push({
        key: 'hypergraph_critical',
        type: 'nary_contagion',
        severity: crit.length >= 2 ? 'critical' : 'high',
        value: Math.min(1, crit.length / 3),
        detail: `${crit.length} критичных гиперрёбер активировано`,
      });
    }
  }

  // 6. Attention explosion
  if (extended.attentionDynamics?.topExplosive?.explosiveness > 1.0) {
    const te = extended.attentionDynamics.topExplosive;
    signals.push({
      key: 'attention_explosive',
      type: 'attention_spike',
      severity: te.explosiveness > 2.0 ? 'critical' : 'high',
      value: Math.min(1, te.explosiveness / 3),
      detail: `${te.topic}: explosiveness ${te.explosiveness.toFixed(2)}`,
    });
  }

  // 7. Adversary adaptation
  if (Array.isArray(extended.adversarialCoEvolution?.adaptations)) {
    const adapting = extended.adversarialCoEvolution.adaptations.filter((a) => a.adaptation?.adapted);
    if (adapting.length > 0) {
      signals.push({
        key: 'adversary_adapting',
        type: 'coevolution',
        severity: adapting.length >= 2 ? 'critical' : 'high',
        value: Math.min(1, adapting.length / 3),
        detail: `${adapting.length} противников адаптируются к нашим прогнозам`,
      });
    }
  }

  // Композитный сигнал
  const criticalCount = signals.filter((s) => s.severity === 'critical').length;
  const highCount = signals.filter((s) => s.severity === 'high').length;

  let compositeType = null;
  if (criticalCount >= 3) compositeType = 'breaking_point_imminent';
  else if (criticalCount >= 2) compositeType = 'multi_layer_crisis';
  else if (criticalCount >= 1 && highCount >= 2) compositeType = 'cascading_escalation';
  else if (signals.length >= 2) compositeType = 'elevated_multi_signal';

  return {
    signals,
    signalCount: signals.length,
    criticalCount,
    highCount,
    combinedType: compositeType,
    interpretation: compositeType
      ? `Обнаружено ${signals.length} комбинированных сигналов, тип: ${compositeType}`
      : 'Комбинированные сигналы не обнаружены',
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Полный цикл Engine v3.
 *
 * @param {Object} latest — текущий sweep из runs/latest.json
 * @param {Array} history — история sweep'ов
 * @param {Object} result — существующий snapshot от engine.mjs (мутируется)
 * @param {Object} options — { skipPhaseJ, skipPhaseK, skipPhaseL, skipPhaseM }
 * @returns {Object} — расширенный snapshot
 */
async function runCrucixExtendedV3(latest, history, result = {}, options = {}) {
  const t0 = Date.now();

  if (!result.extended) result.extended = {};

  // Фаза J
  if (!options.skipPhaseJ) {
    const j = phaseJ_MetaLayers(latest, history);
    Object.assign(result.extended, j);
  }

  // Фаза K
  if (!options.skipPhaseK) {
    const k = await phaseK_Scenarios(latest, history);
    Object.assign(result.extended, k);
  }

  // Фаза L
  if (!options.skipPhaseL) {
    const l = phaseL_AdvancedLayers(latest, history);
    Object.assign(result.extended, l);
  }

  // Фаза M
  if (!options.skipPhaseM) {
    const m = phaseM_CombinedSignals(result.extended);
    result.extended.combinedSignals = m;
  }

  result.extended.v3_elapsedMs = Date.now() - t0;
  result.extended.v3_version = ENGINE_VERSION;

  console.log(`[engine-v3] Extended cycle completed in ${result.extended.v3_elapsedMs}ms`);

  return result;
}

export {
  runCrucixExtendedV3,
  phaseJ_MetaLayers,
  phaseK_Scenarios,
  phaseL_AdvancedLayers,
  phaseM_CombinedSignals,
  ENGINE_VERSION,
};
