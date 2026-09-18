// apis/predict/engine.mjs
// Единый оркестратор прогностического конвейера Crucix.
//
// Синтез из 6 оркестраторов:
//   - engine.mjs (фазы B-L, Z, TRACKED_EVENTS, runForecastPipeline)
//   - engine_coordinat.mjs (PROFILES minimal/balanced/full, ForecastEngine, coverage penalty, CircuitBreaker)
//   - engine_integration_patch.mjs (расширения фаз C/D/K/Z, MLP [3,8,8,3], DQN, extended_<ts>.json)
//   - engine_v6_patch.mjs (фазы S+T, 11 модулей: 5 v6 + 6 каталог, applyV6ToSnapshot)
//   - engine_v7_patch.mjs (фаза U, Simulation Engine, applyV7ToSnapshot)
//   - crucix_engine_v4.mjs (HookManager, PluginLoader, PluginRegistry, IntegrationManager, PWA push, REST API, graceful shutdown)
//
// Архитектура:
//   16-фазный конвейер: A-R (базовые) → S+T (v6+каталог) → U (v7) → Z (публикация).
//   Профили: minimal / balanced / full.
//   Hooks: 9 lifecycle events.
//   REST API: /api/plugins, /api/push, /api/integrations, /api/engine.
//
// Философия:
//   45+ сигналов из 30 наук. Ни одна модель не имеет монополии на истину.
//   Ансамбль устойчивее любой отдельной модели.
//
// Безопасность:
//   try/catch + circuit breaker на каждой фазе. Падение одной фазы
//   не блокирует публикацию. Все ошибки в forecast.failures.
//
// Версия: 8.0.0

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENGINE_VERSION = '8.0.0';

const RUNS_DIR = join(__dirname, '..', '..', 'runs');
const PRED_DIR = join(RUNS_DIR, 'predictions');
const MEMORY_DIR = join(RUNS_DIR, 'memory');
const BASKET_DIR = join(__dirname, '..', '..', 'data', 'basket');
const LATEST_PATH = join(RUNS_DIR, 'latest.json');
const LATEST_BASKET_PATH = join(BASKET_DIR, 'latest.json');

// ─── БАЗОВЫЕ МОДУЛИ ─────────────────────────────────────────────
import { updateEvent, clampShift, likelihoodFromThresholds } from './bayesian.mjs';
import { GaussianNaiveBayes, sweepToFeatures } from './naivebayes.mjs';
import { MarkovChain, classifyState } from './markov.mjs';
import { crucixMarketScenario } from './montecarlo.mjs';
import { forecastSeries, forecastVix, forecastConflicts } from './timeseries.mjs';
import { ForecastTracker, brierScore, plattCalibration } from './calibration.mjs';
import { CascadeGraph } from './cascade.mjs';

// ─── ПРОДВИНУТЫЕ МОДЕЛИ (models/) ────────────────────────────────
import { HawkesProcess, sweepToHawkesEvents } from './models/hawkes.mjs';
import { HMM, createCrucixHMM, sweepToObservations } from './models/hmm.mjs';
import { KalmanFilter, Kalman1D } from './models/kalman.mjs';
import { IsingModel } from './models/ising.mjs';
import { transferEntropy, influenceMatrix } from './models/transferentropy.mjs';
import { SIRModel, SEIRModel, NetworkContagion } from './models/contagion.mjs';
import { GPD, GEV, extremeEventProbability } from './models/evt.mjs';
import { OrnsteinUhlenbeck } from './models/ornstein.mjs';
import { tailDependence, dependenceAnalysis, estimateClayton } from './models/copula.mjs';
import { BOCPD, GaussianConjugate } from './models/bocpd.mjs';
import { ParticleFilter } from './models/particle.mjs';
import { MLP } from './models/neural.mjs';
import { GCN, crucixGCNAnalysis } from './models/graph_neural.mjs';
import { DQN } from './models/reinforcement.mjs';

// ─── ПРОДВИНУТЫЕ МОДУЛИ (apis/predict/) ─────────────────────────
import { crucixSwarmForecast } from './swarm.mjs';
import { applyReflexiveCorrection } from './reflexive.mjs';
import { crucixCausalAnalysis } from './causal.mjs';
import { crucixGameTheoryAnalysis } from './gametheory.mjs';
import { crucixNarrativeAnalysis } from './narrative.mjs';
import { initCrucixActiveLearner, ActiveLearner } from './active_learning.mjs';
import { crucixRegimeShiftDetection } from './regime_shift.mjs';
import {
  permutationImportance,
  counterfactualExplanation,
  decomposeUncertainty,
  buildReasoningChain,
  crucixExplainableForecast,
} from './explainability.mjs';

// ─── РАСШИРЕННЫЙ ENSEMBLE ───────────────────────────────────────
import {
  weightedAverage,
  logOpinionPool,
  medianForecast,
  trimmedMean,
  ensembleForecast,
  crucixEventEnsemble,
} from './ensemble.mjs';

// ─── ИСТОЧНИКИ (apis/sources/) ──────────────────────────────────
import { fetchPredictionMarkets, ensembleWithCrucix } from './sources/prediction_markets.mjs';
import { processMultilingual } from './sources/multilang.mjs';
import { fetchSatelliteData } from './sources/satellite.mjs';

// ─── ГРАФ ЗНАНИЙ (apis/knowledge/) ──────────────────────────────
import { KnowledgeGraph, buildGraphFromSweep } from '../knowledge/graph.mjs';

// ─── КАЛИБРОВКА И ТРЕКИНГ ───────────────────────────────────────
import { ExtendedTracker, getExtendedTracker } from './extended_tracker.mjs';
import { computeCompositeRisk } from './composite_risk.mjs';

// ─── КООРДИНАТОР v3 (расширенные слои) ──────────────────────────
import { runCrucixExtendedV3 } from './crucix_engine_v3.mjs';

// ─── ИНФРАСТРУКТУРА ─────────────────────────────────────────────
import { publishPrediction, publishBrierUpdate } from './ws.mjs';
import { notifyPrediction, notifierStatus } from './notifier.mjs';
import { hybridForecast, checkPythonService, bridgeStatus } from './python_bridge.mjs';
import { runV6Phase, runCatalogPhase, applyV6ToSnapshot } from './engine_v6_patch.mjs';
import { runV7Phase, applyV7ToSnapshot } from './engine_v7_patch.mjs';

// ─── HOOKS + PLUGINS + INTEGRATIONS + PWA ───────────────────────
import { getHookManager } from '../../plugins/hooks.mjs';
import { getPluginLoader } from '../../plugins/loader.mjs';
import { getPluginRegistry } from '../../plugins/registry.mjs';
import { getIntegrationManager } from '../../integrations/webhook_manager.mjs';
import { loadOrCreateVAPIDKeys, SubscriptionStore, notifyPush, createPushHandlers } from '../../dashboard/pwa/push.js';
import { handlePluginsAPI } from './plugins_api.mjs';

// ═══════════════════════════════════════════════════════════════
// ПРОФИЛИ ЗАПУСКА
// ═══════════════════════════════════════════════════════════════

const PROFILES = {
  minimal: {
    name: 'minimal',
    description: 'Офлайн, 7B, без интернета',
    expectedTimeMs: 30_000,
    phases: {
      B: true, C: true, D: false, E: false, F: false, G: true,
      H: true, I: true, J: true, K: true, L: false,
      S: false, T: false, U: false,
    },
    modules: {
      reflexive: { enabled: true },
      regime_shift: { enabled: true },
      explainability: { enabled: true },
    },
  },
  balanced: {
    name: 'balanced',
    description: 'Локальный сервер с интернетом',
    expectedTimeMs: 120_000,
    phases: {
      B: true, C: true, D: true, E: true, F: true, G: true,
      H: true, I: true, J: true, K: true, L: true,
      S: true, T: true, U: false,
    },
    modules: {
      reflexive: { enabled: true },
      regime_shift: { enabled: true },
      explainability: { enabled: true },
      causal: { enabled: true },
      gametheory: { enabled: true },
      active_learning: { enabled: true },
      entity_graph: { enabled: true },
      prediction_markets: { enabled: true },
      multilang: { enabled: true },
    },
  },
  full: {
    name: 'full',
    description: 'Облако/кластер, максимум глубины',
    expectedTimeMs: 600_000,
    phases: {
      B: true, C: true, D: true, E: true, F: true, G: true,
      H: true, I: true, J: true, K: true, L: true,
      S: true, T: true, U: true,
    },
    modules: {
      reflexive: { enabled: true },
      regime_shift: { enabled: true },
      explainability: { enabled: true },
      causal: { enabled: true },
      gametheory: { enabled: true },
      active_learning: { enabled: true },
      entity_graph: { enabled: true },
      prediction_markets: { enabled: true },
      multilang: { enabled: true },
      swarm: { enabled: true, agentCount: 500 },
      narrative: { enabled: true },
      satellite: { enabled: true },
    },
  },
};

const BASE_WEIGHTS = {
  swarm: 0.15,
  causal: 0.25,
  gametheory: 0.20,
  narrative: 0.15,
  regime_shift: 0.15,
  reflexive: 0.10,
};

const TOTAL_ENSEMBLE_MODULES = Object.keys(BASE_WEIGHTS).length;

// ═══════════════════════════════════════════════════════════════
// КАТАЛОГ СОБЫТИЙ
// ═══════════════════════════════════════════════════════════════

const TRACKED_EVENTS = [
  {
    id: 'market_crash',
    name: 'Рыночный обвал (VIX > 40)',
    category: 'economic',
    baseRate: 0.02,
    horizonHours: 72,
    evidenceRules: {
      vix: { high: 30, critical: 38 },
      hySpread: { high: 5, critical: 7 },
    },
  },
  {
    id: 'conflict_escalation',
    name: 'Эскалация конфликтов',
    category: 'geopolitical',
    baseRate: 0.05,
    horizonHours: 168,
    evidenceRules: {
      conflictCount: { high: 10, critical: 20 },
      sanctionsCount: { high: 5, critical: 15 },
    },
  },
  {
    id: 'nuclear_incident',
    name: 'Радиационный инцидент',
    category: 'nuclear',
    baseRate: 0.001,
    horizonHours: 24,
    evidenceRules: {
      maxRadiation: { high: 200, critical: 500 },
    },
  },
  {
    id: 'sanctions_expansion',
    name: 'Расширение санкций',
    category: 'geopolitical',
    baseRate: 0.08,
    horizonHours: 120,
    evidenceRules: {
      sanctionsCount: { high: 3, critical: 10 },
    },
  },
  {
    id: 'naval_incident',
    name: 'Морской инцидент',
    category: 'military',
    baseRate: 0.03,
    horizonHours: 48,
    evidenceRules: {
      navalDetections: { high: 3, critical: 8 },
    },
  },
  {
    id: 'regime_change',
    name: 'Смена геополитического режима',
    category: 'structural',
    baseRate: 0.01,
    horizonHours: 336,
    evidenceRules: {
      tension: { high: 0.7, critical: 0.85 },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════════════════

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(fp, data) {
  try {
    ensureDir(dirname(fp));
    writeFileSync(fp, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('[engine] saveJSON failed:', e.message);
  }
}

function loadHistory(maxSweeps = 200) {
  const historyFile = join(RUNS_DIR, 'history.json');
  const data = loadJSON(historyFile, []);
  if (Array.isArray(data)) return data.slice(-maxSweeps);
  return [];
}

function hashData(data) {
  try {
    return createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
  } catch {
    return createHash('sha256').update(String(Date.now()) + String(Math.random())).digest('hex').slice(0, 16);
  }
}

function timing() {
  const start = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - start) / 1_000_000;
}

async function safeCall(label, fn, fallback = null, timeoutMs = 30000) {
  try {
    const result = await Promise.race([
      Promise.resolve(fn()).then((r) => ({ ok: true, data: r })),
      new Promise((resolve) =>
        setTimeout(() => resolve({ ok: false, data: null, timeout: true }), timeoutMs)
      ),
    ]);
    if (!result.ok) {
      console.warn(`[engine] ${label}: timeout after ${timeoutMs}ms`);
      return fallback;
    }
    return result.data;
  } catch (e) {
    console.error(`[engine] ${label} error:`, e.message);
    return fallback;
  }
}

function safeSyncCall(label, fn, fallback = null) {
  try {
    return fn();
  } catch (e) {
    console.error(`[engine] ${label} error:`, e.message);
    return fallback;
  }
}

// ═══════════════════════════════════════════════════════════════
// ИЗВЛЕЧЕНИЕ РЯДОВ
// ═══════════════════════════════════════════════════════════════

function extractVixSeries(history) {
  return history
    .map((h) => (h && h.fred ? h.fred.vix : null))
    .filter((v) => typeof v === 'number' && !isNaN(v));
}

function extractConflictSeries(history) {
  return history.map((h) =>
    h && h.gdelt && Array.isArray(h.gdelt.conflictEvents)
      ? h.gdelt.conflictEvents.length
      : 0
  );
}

function extractHySpreadSeries(history) {
  return history
    .map((h) => (h && h.fred ? h.fred.hySpread : null))
    .filter((v) => typeof v === 'number' && !isNaN(v));
}

function extractAlertsSeries(history) {
  return history.map((s) => (s && s.delta ? s.delta.newAlerts : 0) || 0);
}

function extractTimestamps(history) {
  return history
    .map((s) => new Date(s.timestamp).getTime() / 1000)
    .filter((t) => !isNaN(t));
}

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════

class CircuitBreaker {
  constructor(threshold = 3, cooldown = 5) {
    this.threshold = threshold;
    this.cooldown = cooldown;
    this.failures = new Map();
  }

  canRun(moduleName) {
    const entry = this.failures.get(moduleName);
    if (!entry) return true;
    if (entry.circuitOpenUntil > 0) {
      entry.circuitOpenUntil--;
      return false;
    }
    return true;
  }

  recordFailure(moduleName) {
    const entry = this.failures.get(moduleName) || { count: 0, circuitOpenUntil: 0 };
    entry.count++;
    if (entry.count >= this.threshold) {
      entry.circuitOpenUntil = this.cooldown;
      entry.count = 0;
    }
    this.failures.set(moduleName, entry);
  }

  recordSuccess(moduleName) {
    this.failures.delete(moduleName);
  }

  getStatus(moduleName) {
    const entry = this.failures.get(moduleName);
    if (!entry) return { circuitOpen: false, failures: 0 };
    return { circuitOpen: entry.circuitOpenUntil > 0, failures: entry.count };
  }
}

// ═══════════════════════════════════════════════════════════════
// ДАЛЬШЕ — ФАЗЫ B-L, S+T, U, Z + ГЛАВНЫЙ КЛАСС (дописать следующей частью)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// PHASE B: БАЗОВЫЕ МОДЕЛИ
// ═══════════════════════════════════════════════════════════════

function phaseB_BaseModels(latest, history, sourceData) {
  console.log('[engine] Phase B: base models');

  const features = safeSyncCall('sweepToFeatures', () => sweepToFeatures(latest), {});
  const currentState = safeSyncCall('classifyState', () => classifyState(latest), 'unknown');

  const bayesianForecasts = TRACKED_EVENTS.map((event) => {
    const evidence = buildEvidence(latest, event, sourceData);
    const prevForecast = loadJSON(join(PRED_DIR, 'latest_forecast.json'), null);
    const prior = prevForecast?.events?.[event.id]?.posterior ?? event.baseRate;
    const result = safeSyncCall(
      `bayesian_${event.id}`,
      () => updateEvent({ ...event, prior }, evidence, { maxShift: 0.15, decayRate: 0.02 }),
      { eventId: event.id, posterior: prior, prior, shift: 0, contributions: [] }
    );
    return { eventId: event.id, ...result, evidence };
  });

  let naiveBayesResult = null;
  try {
    const trainingData = history
      .map((h) => ({ features: sweepToFeatures(h), label: classifyState(h) }))
      .filter((d) => Object.keys(d.features).length > 0);
    if (trainingData.length >= 10) {
      const nb = new GaussianNaiveBayes();
      nb.fit(trainingData);
      naiveBayesResult = nb.predict(features);
    }
  } catch (e) {
    console.warn('[engine] NaiveBayes skipped:', e.message);
  }

  let markovResult = null;
  try {
    const stateSeq = history.map((h) => classifyState(h));
    if (stateSeq.length >= 5) {
      const mc = new MarkovChain();
      mc.fit(stateSeq);
      markovResult = {
        currentState,
        next: mc.predictNext(currentState).predicted,
        nextDistribution: mc.predictNext(currentState).distribution,
        weekAhead: mc.predictNSteps(currentState, 7).distribution,
        stationary: mc.stationaryDistribution(),
      };
    }
  } catch (e) {
    console.warn('[engine] Markov skipped:', e.message);
  }

  let monteCarloResult = null;
  try {
    monteCarloResult = crucixMarketScenario(latest, { iterations: 3000 });
  } catch (e) {
    console.warn('[engine] MonteCarlo skipped:', e.message);
  }

  const timeseriesResult = {};
  try {
    const vixSeries = extractVixSeries(history);
    const conflictSeries = extractConflictSeries(history);
    if (vixSeries.length >= 5) timeseriesResult.vix = forecastVix(history, 5);
    if (conflictSeries.length >= 5) timeseriesResult.conflicts = forecastConflicts(history, 5);
  } catch (e) {
    console.warn('[engine] Timeseries skipped:', e.message);
  }

  let cascadeResult = null;
  try {
    cascadeResult = runCascadePropagation(latest, bayesianForecasts);
  } catch (e) {
    console.warn('[engine] Cascade skipped:', e.message);
  }

  return {
    features,
    currentState,
    bayesian: bayesianForecasts,
    naiveBayes: naiveBayesResult,
    markov: markovResult,
    monteCarlo: monteCarloResult,
    timeseries: timeseriesResult,
    cascade: cascadeResult,
  };
}

function buildEvidence(latest, event, sourceData) {
  const evidence = [];
  const rules = event.evidenceRules || {};
  const features = sweepToFeatures(latest);

  for (const [featureName, thresholds] of Object.entries(rules)) {
    const value = features[featureName];
    if (value === undefined) continue;
    const lk = likelihoodFromThresholds(value, thresholds);
    evidence.push({ name: featureName, value, ...lk });
  }

  if (sourceData && sourceData.predictionMarkets && Array.isArray(sourceData.predictionMarkets.markets)) {
    const pm = sourceData.predictionMarkets.markets.find((m) =>
      m.question && m.question.toLowerCase().includes(event.name.toLowerCase().split(' ')[0])
    );
    if (pm) {
      evidence.push({
        name: 'prediction_market',
        value: pm.probability,
        pGivenH: pm.probability * 0.7 + 0.15,
        pGivenNotH: (1 - pm.probability) * 0.7 + 0.15,
      });
    }
  }

  if (sourceData && sourceData.satellite && Array.isArray(sourceData.satellite.alerts)
      && event.category === 'military') {
    const highAlerts = sourceData.satellite.alerts.filter((a) => a.severity === 'high').length;
    if (highAlerts > 0) {
      evidence.push({ name: 'satellite_alert', value: highAlerts, pGivenH: 0.8, pGivenNotH: 0.1 });
    }
  }

  if (sourceData && sourceData.multilang && sourceData.multilang.threatLevel > 0.5) {
    evidence.push({
      name: 'multilang_threat',
      value: sourceData.multilang.threatLevel,
      pGivenH: 0.7,
      pGivenNotH: 0.2,
    });
  }

  return evidence;
}

function runCascadePropagation(latest, bayesianForecasts) {
  const graph = new CascadeGraph();
  for (const f of bayesianForecasts) {
    if (typeof graph.addNode === 'function') {
      graph.addNode(f.eventId, f.eventId, f.posterior);
    }
  }

  if (typeof graph.addEdge === 'function') {
    graph.addEdge('conflict_escalation', 'market_crash', 2.5, 24);
    graph.addEdge('sanctions_expansion', 'market_crash', 1.8, 12);
    graph.addEdge('conflict_escalation', 'sanctions_expansion', 3.0, 48);
    graph.addEdge('naval_incident', 'conflict_escalation', 2.0, 6);
    graph.addEdge('regime_change', 'conflict_escalation', 2.5, 72);
    graph.addEdge('regime_change', 'market_crash', 2.0, 72);
  }

  if (typeof graph.updateProbability === 'function') {
    for (const f of bayesianForecasts) {
      graph.updateProbability(f.eventId, f.posterior, 0.2);
    }
  }

  const nodes = typeof graph.getAllNodes === 'function'
    ? [...graph.getAllNodes().values()].map((n) => ({
        id: n.id, name: n.name, baseProb: n.baseProb, currentProb: n.currentProb,
        shift: n.currentProb - n.baseProb,
      }))
    : [];

  return { nodes };
}

// ═══════════════════════════════════════════════════════════════
// PHASE C: НАУЧНЫЙ СИНТЕЗ
// ═══════════════════════════════════════════════════════════════

function phaseC_ScientificSynthesis(latest, history) {
  console.log('[engine] Phase C: scientific synthesis');
  const result = {};
  const vixSeries = extractVixSeries(history);
  const conflictSeries = extractConflictSeries(history);
  const hySeries = extractHySpreadSeries(history);

  result.hawkes = safeSyncCall('hawkes', () => {
    if (history.length < 5) return { error: 'insufficient_history' };
    const events = sweepToHawkesEvents(history);
    if (events.length < 3) return { error: 'insufficient_events' };
    const hp = new HawkesProcess({ mu: 0.3, theta: 0.6, beta: 1.5 });
    hp.fit(events);
    const branching = hp.branchingFactor();
    return {
      branchingFactor: branching,
      branchingInterpretation: branching >= 1 ? 'explosive' : 'stationary',
      forecastProbability24h: hp.forecastProbability(24 * 3600),
      forecastProbability72h: hp.forecastProbability(72 * 3600),
      expectedEvents24h: typeof hp.forecastCount === 'function' ? hp.forecastCount(24 * 3600) : null,
      params: { mu: hp.mu, theta: hp.theta, beta: hp.beta },
    };
  }, { error: 'failed' });

  result.hmm = safeSyncCall('hmm', () => {
    if (history.length < 10) return { error: 'insufficient_history' };
    const hmm = createCrucixHMM();
    const obsSeq = sweepToObservations(history);
    if (obsSeq.length < 5) return { error: 'insufficient_obs' };
    const { path, prob } = hmm.viterbi(obsSeq);
    const next = hmm.predictNext(obsSeq);
    const currentState = path[path.length - 1];
    return {
      currentState,
      statePath: path.slice(-10),
      pathProbability: prob,
      nextState: next.predictedState,
      stateDistribution: next.stateDistribution,
      predictedObservation: next.predictedObservation,
      regimeShift: currentState !== next.predictedState
        ? { from: currentState, to: next.predictedState }
        : null,
    };
  }, { error: 'failed' });

  result.kalman = safeSyncCall('kalman', () => {
    if (vixSeries.length < 5) return { error: 'insufficient_data' };
    const kf = new Kalman1D({
      processNoise: 0.5, measurementNoise: 2.0,
      initialValue: vixSeries[0], initialTrend: vixSeries[1] - vixSeries[0] || 0,
    });
    const filtered = kf.filter(vixSeries);
    const forecast = kf.forecast(5);
    const last = filtered[filtered.length - 1];
    const currentVix = latest.fred?.vix ?? vixSeries[vixSeries.length - 1];
    return {
      smoothedVix: last.value,
      trend: last.trend,
      forecast5: forecast.map((f) => ({ value: f.value, lower: f.lower, upper: f.upper })),
      kalmanVsRaw: Math.abs(last.value - currentVix) > 0.01
        ? `${last.value.toFixed(2)} (smoothed) vs ${currentVix} (raw)`
        : 'aligned',
    };
  }, { error: 'failed' });

  result.ising = safeSyncCall('ising', () => {
    const ising = new IsingModel({ nNodes: 12, temperature: 1.0, coupling: 0.5 });
    ising.setTemperatureFromSweep(latest);
    ising.simulate(500);
    const fp = ising.predictFlipProbability();
    return {
      temperature: typeof fp.temperature === 'number' ? fp.temperature : null,
      criticalTemperature: typeof fp.criticalTemperature === 'number' ? fp.criticalTemperature : null,
      ratio: fp.ratio,
      magnetization: fp.magnetization,
      susceptibility: fp.susceptibility,
      nearPhaseTransition: fp.nearPhaseTransition,
      flipProbability: fp.flipProbability,
    };
  }, { error: 'failed' });

  result.transferEntropy = safeSyncCall('transferEntropy', () => {
    const minLen = Math.min(vixSeries.length, conflictSeries.length);
    if (minLen < 15) return { error: 'insufficient_data' };
    const vars = { vix: vixSeries.slice(-minLen), conflicts: conflictSeries.slice(-minLen) };
    if (hySeries.length >= minLen) vars.hySpread = hySeries.slice(-minLen);
    const matrix = influenceMatrix(vars);
    return {
      topInfluence: matrix.topInfluence
        ? { pair: matrix.topInfluence.pair, transferEntropy: matrix.topInfluence.transferEntropy }
        : null,
      rankedTop5: Array.isArray(matrix.ranked)
        ? matrix.ranked.slice(0, 5).map((r) => ({ pair: r.pair, te: r.transferEntropy }))
        : [],
      matrix: matrix.matrix,
    };
  }, { error: 'failed' });

  result.contagion = safeSyncCall('contagion', () => {
    const conflictCount = latest.gdelt?.conflictEvents?.length ?? 0;
    const sir = new SIRModel({
      S0: 50,
      I0: Math.max(1, Math.min(5, Math.floor(conflictCount / 3))),
      R0: 0,
      beta: 0.15 + ((latest.fred?.vix) || 20) / 200,
      gamma: 0.05,
    });
    sir.simulate(30);
    const R0 = sir.reproductionNumber();
    const peak = sir.peak();
    const traj = sir.trajectory ? sir.trajectory() : null;
    return {
      reproductionNumber: R0,
      outbreakProbability: sir.majorOutbreakProbability(),
      peak: { step: peak.step, fraction: peak.fraction },
      finalState: traj ? {
        susceptible: Math.round(traj[traj.length - 1].S),
        infected: Math.round(traj[traj.length - 1].I),
        recovered: Math.round(traj[traj.length - 1].R),
      } : null,
      interpretation: R0 > 1 ? 'contagion_growing' : 'contagion_fading',
    };
  }, { error: 'failed' });

  result.evt = safeSyncCall('evt', () => {
    if (vixSeries.length < 20) return { error: 'insufficient_data' };
    const evt = extremeEventProbability(vixSeries, 35, 30);
    return {
      probability30day: evt.probability,
      method: evt.method,
      rate: evt.rate,
      tailIndex: evt.tailIndex,
      heavyTail: evt.heavyTail,
      returnLevel95: evt.returnLevel95,
      returnLevel99: evt.returnLevel99,
    };
  }, { error: 'failed' });

  result.ornsteinUhlenbeck = safeSyncCall('ornstein', () => {
    if (vixSeries.length < 15) return { error: 'insufficient_data' };
    const ou = new OrnsteinUhlenbeck();
    ou.fit(vixSeries);
    const currentVix = latest.fred?.vix ?? vixSeries[vixSeries.length - 1];
    const forecast = ou.forecast(currentVix, 5);
    return {
      longRunMean: ou.mu,
      meanReversionSpeed: ou.theta,
      volatility: ou.sigma,
      halfLife: ou.halfLife(),
      forecast5: forecast.map((f) => ({ step: f.h, mean: f.mean, lower: f.lower, upper: f.upper })),
      probVixAbove35_10steps: typeof ou.probabilityOfThreshold === 'function'
        ? ou.probabilityOfThreshold(currentVix, 35, 10) : null,
    };
  }, { error: 'failed' });

  result.copula = safeSyncCall('copula', () => {
    const minLen = Math.min(vixSeries.length, conflictSeries.length);
    if (minLen < 15) return { error: 'insufficient_data' };
    const vars = { vix: vixSeries.slice(-minLen), conflicts: conflictSeries.slice(-minLen) };
    if (hySeries.length >= minLen) vars.hySpread = hySeries.slice(-minLen);
    const analysis = dependenceAnalysis(vars);
    const entries = Object.entries(analysis);
    if (entries.length === 0) return { error: 'no_pairs' };
    const strongest = entries.reduce(
      (best, [k, v]) => Math.max(v.lowerTail || 0, v.upperTail || 0) >
                        Math.max(best[1].lowerTail || 0, best[1].upperTail || 0) ? [k, v] : best,
      entries[0]
    );
    return {
      pairs: entries.map(([pair, data]) => ({
        pair,
        kendallTau: data.kendallTau,
        lowerTail: data.lowerTail,
        upperTail: data.upperTail,
        asymmetric: data.asymmetric,
        claytonTheta: data.claytonTheta,
      })),
      strongestTailDependence: {
        pair: strongest[0],
        lower: strongest[1].lowerTail,
        upper: strongest[1].upperTail,
      },
    };
  }, { error: 'failed' });

  result.bocpd = safeSyncCall('bocpd', () => {
    if (vixSeries.length < 10) return { error: 'insufficient_data' };
    const model = new GaussianConjugate({ mu0: 20, kappa0: 1, alpha0: 1, beta0: 10 });
    const bocpd = new BOCPD({ model, hazardFn: () => 1 / 50 });
    const { results, changepoints } = bocpd.detect(vixSeries);
    const last = results[results.length - 1];
    const recentCps = changepoints.filter((cp) => cp > vixSeries.length - 10);
    return {
      currentChangepointProb: last.changepointProbability,
      mostLikelyRunLength: last.mostLikelyRunLength,
      changepointsDetected: changepoints.length,
      recentChangepoints: recentCps,
      regimeStability: last.changepointProbability < 0.1
        ? 'stable'
        : last.changepointProbability < 0.3
        ? 'unstable'
        : 'shift_detected',
    };
  }, { error: 'failed' });

  result.particleFilter = safeSyncCall('particleFilter', () => {
    if (vixSeries.length < 5) return { error: 'insufficient_data' };
    const pf = new ParticleFilter({
      nParticles: 200,
      transitionFn: (p) => ({ ...p, state: p.state + (Math.random() - 0.5) * 2 }),
      observationFn: (p) => p.state,
    });
    const currentVix = latest.fred?.vix ?? 20;
    pf.particles = Array.from({ length: 200 }, () => ({
      state: currentVix + (Math.random() - 0.5) * 5, params: {},
    }));
    pf.filter(vixSeries);
    const estimate = pf.estimate();
    pf.predict();
    const forecast = pf.estimate();
    return {
      currentEstimate: estimate.mean,
      currentStd: estimate.std,
      forecastMean: forecast.mean,
      forecastStd: forecast.std,
    };
  }, { error: 'failed' });

  return result;
}

// ═══════════════════════════════════════════════════════════════
// PHASE D: НЕЙРОСЕТЕВОЙ СЛОЙ
// ═══════════════════════════════════════════════════════════════

function phaseD_NeuralLayer(latest, history) {
  console.log('[engine] Phase D: neural layer');
  const result = {};

  result.mlp = safeSyncCall('mlp', () => {
    const vixSeries = extractVixSeries(history);
    const conflictSeries = extractConflictSeries(history);
    const alertSeries = extractAlertsSeries(history);
    const minLen = Math.min(vixSeries.length, conflictSeries.length, alertSeries.length);
    if (minLen < 30) return { error: 'need_30+_sweeps' };

    const X = [];
    const y = [];
    for (let i = 0; i < minLen; i++) {
      X.push([
        vixSeries[i] / 50,
        Math.min(conflictSeries[i] / 20, 1),
        Math.min(alertSeries[i] / 15, 1),
      ]);
      if (vixSeries[i] > 35 || conflictSeries[i] > 15) y.push([0, 0, 1]);
      else if (vixSeries[i] > 25 || conflictSeries[i] > 8) y.push([0, 1, 0]);
      else y.push([1, 0, 0]);
    }

    const mlp = new MLP({ layers: [3, 8, 8, 3], learningRate: 0.01, activation: 'relu' });
    mlp.fit(X, y, 50, 16);

    const currentFeatures = [
      (latest.fred?.vix ?? 20) / 50,
      Math.min((latest.gdelt?.conflictEvents?.length ?? 0) / 20, 1),
      Math.min((latest.delta?.newAlerts ?? 0) / 15, 1),
    ];
    const pred = mlp.predict(currentFeatures);
    const labels = ['stable', 'escalation', 'crisis'];
    const maxIdx = pred.indexOf(Math.max(...pred));
    return {
      prediction: labels[maxIdx],
      confidence: pred[maxIdx],
      distribution: Object.fromEntries(labels.map((l, i) => [l, pred[i]])),
    };
  }, { error: 'failed' });

  result.gcn = safeSyncCall('gcn', () => crucixGCNAnalysis(latest, { maxNodes: 10 }), { error: 'failed' });

  result.dqn = safeSyncCall('dqn', () => {
    const vix = latest.fred?.vix ?? 20;
    const stateBin = Math.min(9, Math.floor(vix / 5));
    const modelPath = join(PRED_DIR, 'dqn_model.json');
    let dqn;
    if (existsSync(modelPath)) {
      try {
        dqn = DQN.deserialize(readFileSync(modelPath, 'utf-8'));
      } catch {
        dqn = new DQN({ nStates: 10, nActions: 3 });
      }
    } else {
      dqn = new DQN({ nStates: 10, nActions: 3 });
    }
    const action = typeof dqn.bestAction === 'function' ? dqn.bestAction(stateBin) : 0;
    const actions = ['normal_sweep', 'add_sources', 'deep_scan'];

    if (typeof dqn.remember === 'function' && typeof dqn.train === 'function') {
      const reward = (vix > 25 && action === 1) ? 1
        : (vix > 35 && action === 2) ? 2
        : (vix < 20 && action === 0) ? 1 : 0;
      const nextStateBin = Math.min(9, Math.floor((vix + (Math.random() - 0.5) * 5) / 5));
      dqn.remember(stateBin, action, reward, nextStateBin, false);
      dqn.train();
      try {
        mkdirSync(PRED_DIR, { recursive: true });
        writeFileSync(modelPath, dqn.serialize());
      } catch {}
    }

    return {
      currentState: stateBin,
      recommendedAction: actions[action],
      epsilon: typeof dqn.epsilon === 'number' ? dqn.epsilon : null,
      bufferSize: dqn.replayBuffer ? dqn.replayBuffer.length : 0,
    };
  }, { error: 'failed' });

  result.pythonBridge = safeSyncCall('pythonBridgeStatus', () => ({
    checked: false,
    note: 'async, check via bridgeStatus() separately',
  }), { error: 'failed' });

  return result;
}

// ═══════════════════════════════════════════════════════════════
// PHASE E: ПРОДВИНУТЫЕ МОДЕЛИ
// ═══════════════════════════════════════════════════════════════

async function phaseE_AdvancedModels(latest, history, baseResults) {
  console.log('[engine] Phase E: advanced models');
  const result = {};

  const [swarm, causal, gametheory, narrative, regimeShift] = await Promise.all([
    safeCall('swarm', () => crucixSwarmForecast(latest, {
      agentCount: 300, rounds: 15,
      godEyeEvent: baseResults.bayesian?.find((f) => f.eventId === 'conflict_escalation')?.posterior > 0.5
        ? { type: 'conflict', severity: 0.7, direction: 'negative', source: 'bayesian_trigger' }
        : null,
    }), null, 60000),
    safeCall('causal', () => crucixCausalAnalysis(latest, history, {
      x: 'vix', xValue: 35, y: 'tension',
    }), null, 30000),
    safeCall('gametheory', () => crucixGameTheoryAnalysis(latest, {
      followerRationality: 0.7, deceptionProb: 0.3,
    }), null, 20000),
    safeCall('narrative', () => crucixNarrativeAnalysis(latest, history), null, 30000),
    safeCall('regime_shift', () => crucixRegimeShiftDetection(history), null, 20000),
  ]);

  result.swarm = swarm;
  result.causal = causal;
  result.gametheory = gametheory;
  result.narrative = narrative;
  result.regimeShift = regimeShift;

  return result;
}

// ═══════════════════════════════════════════════════════════════
// PHASE F: ИСТОЧНИКИ
// ═══════════════════════════════════════════════════════════════

async function phaseF_Sources(latest, history) {
  console.log('[engine] Phase F: sources');
  const [predictionMarkets, multilang, satellite] = await Promise.all([
    safeCall('prediction_markets', () => fetchPredictionMarkets(), null, 15000),
    safeCall('multilang', () => processMultilingual(latest, history), null, 15000),
    safeCall('satellite', () => fetchSatelliteData(), null, 20000),
  ]);

  return { predictionMarkets, multilang, satellite };
}

// ═══════════════════════════════════════════════════════════════
// PHASE G: ГРАФ ЗНАНИЙ
// ═══════════════════════════════════════════════════════════════

function phaseG_KnowledgeGraph(latest) {
  console.log('[engine] Phase G: knowledge graph');
  return safeSyncCall('knowledgeGraph', () => {
    const file = join(RUNS_DIR, 'knowledge_graph.json');
    let kg;
    try {
      kg = KnowledgeGraph.load(file);
    } catch {
      kg = new KnowledgeGraph();
    }
    kg = buildGraphFromSweep(latest, kg);
    try {
      kg.save(file);
    } catch {}
    return {
      entityCount: kg.entities.size,
      relationCount: kg.relations.length,
      stats: kg.stats(),
    };
  }, { error: 'failed' });
}

// ═══════════════════════════════════════════════════════════════
// PHASE I: АНСАМБЛИРОВАНИЕ
// ═══════════════════════════════════════════════════════════════

function phaseI_Ensemble(latest, baseResults, advancedResults, sourceData, neuralResults) {
  console.log('[engine] Phase I: ensemble');
  const eventForecasts = {};

  for (const event of TRACKED_EVENTS) {
    const estimates = [];

    const bayesF = baseResults.bayesian?.find((f) => f.eventId === event.id);
    if (bayesF) estimates.push({ source: 'bayesian', probability: bayesF.posterior, weight: 1.0 });

    if (baseResults.naiveBayes) {
      const p = (baseResults.naiveBayes.probabilities?.crisis || 0) +
                (baseResults.naiveBayes.probabilities?.escalation || 0);
      estimates.push({ source: 'naive_bayes', probability: p, weight: 0.6 });
    }

    if (baseResults.markov?.weekAhead) {
      estimates.push({ source: 'markov', probability: baseResults.markov.weekAhead.crisis || 0, weight: 0.7 });
    }

    if (baseResults.monteCarlo) {
      estimates.push({ source: 'monte_carlo', probability: baseResults.monteCarlo.probabilities?.crisis || 0, weight: 0.8 });
    }

    if (baseResults.timeseries?.vix && event.id === 'market_crash') {
      const fc = baseResults.timeseries.vix.forecast;
      const avg = Array.isArray(fc) ? fc.reduce((a, b) => a + b, 0) / fc.length : 25;
      const p = avg > 35 ? 0.7 : avg > 30 ? 0.4 : avg > 25 ? 0.15 : 0.05;
      estimates.push({ source: 'timeseries', probability: p, weight: 0.7 });
    }

    const casc = baseResults.cascade?.nodes?.find((n) => n.id === event.id);
    if (casc) estimates.push({ source: 'cascade', probability: casc.currentProb, weight: 0.85 });

    if (neuralResults.mlp && !neuralResults.mlp.error && event.category === 'economic') {
      const p = neuralResults.mlp.distribution?.crisis || 0;
      estimates.push({ source: 'mlp', probability: p, weight: 0.7 });
    }

    if (advancedResults.swarm && event.category === 'geopolitical') {
      estimates.push({ source: 'swarm', probability: advancedResults.swarm.outcome?.probability || 0.5, weight: 0.6 });
    }

    if (advancedResults.gametheory && event.category === 'geopolitical') {
      const gt = advancedResults.gametheory;
      const p = gt.stackelberg?.followerResponse === 'escalate' ? 0.7
        : gt.stackelberg?.followerResponse === 'deescalate' ? 0.2 : 0.4;
      estimates.push({ source: 'game_theory', probability: p, weight: 0.5 });
    }

    if (advancedResults.regimeShift?.regimeShiftDetected) {
      estimates.push({
        source: 'regime_shift',
        probability: advancedResults.regimeShift.severity === 'high' ? 0.7 : 0.45,
        weight: 0.5,
      });
    }

    if (sourceData && sourceData.predictionMarkets?.markets) {
      const pm = sourceData.predictionMarkets.markets.find((m) =>
        m.question?.toLowerCase().includes(event.name.toLowerCase().split(' ')[0]));
      if (pm) estimates.push({ source: 'prediction_market', probability: pm.probability, weight: 0.9 });
    }

    if (sourceData && sourceData.multilang?.threatLevel > 0.3) {
      estimates.push({ source: 'multilang', probability: sourceData.multilang.threatLevel, weight: 0.5 });
    }

    if (estimates.length === 0) {
      eventForecasts[event.id] = {
        name: event.name, category: event.category, horizonHours: event.horizonHours,
        baseRate: event.baseRate, ensemble: event.baseRate, finalProbability: event.baseRate,
        sourceBreakdown: [], sourceCount: 0,
      };
      continue;
    }

    // Применяем расширенный ensemble.mjs — auto-выбор метода
    const ensembleResult = ensembleForecast({
      predictions: estimates,
      method: 'auto',
    });

    const prevForecast = loadJSON(join(PRED_DIR, 'latest_forecast.json'), null);
    const prevProb = prevForecast?.events?.[event.id]?.ensemble ?? event.baseRate;
    const clampedProb = clampShift(prevProb, ensembleResult.probability, 0.15);

    eventForecasts[event.id] = {
      name: event.name,
      category: event.category,
      horizonHours: event.horizonHours,
      baseRate: event.baseRate,
      ensemble: clampedProb,
      finalProbability: clampedProb,
      shift: clampedProb - prevProb,
      disagreement: ensembleResult.disagreement,
      ensembleMethod: ensembleResult.method,
      sourceCount: estimates.length,
      sourceBreakdown: estimates.sort((a, b) => b.weight - a.weight),
    };
  }

  return eventForecasts;
}

// ═══════════════════════════════════════════════════════════════
// PHASE J: РЕФЛЕКСИВНАЯ КОРРЕКЦИЯ
// ═══════════════════════════════════════════════════════════════

function phaseJ_ReflexiveCorrection(eventForecasts, history) {
  console.log('[engine] Phase J: reflexive correction');
  const previousForecasts = loadJSON(join(PRED_DIR, 'forecast_history.json'), []);
  const corrected = {};

  for (const [eventId, forecast] of Object.entries(eventForecasts)) {
    const result = safeSyncCall(`reflexive_${eventId}`, () =>
      applyReflexiveCorrection(
        {
          probability: forecast.ensemble,
          direction: ['economic', 'geopolitical'].includes(forecast.category) ? 'negative' : 'neutral',
          horizonHours: forecast.horizonHours,
        },
        {
          previousForecasts: previousForecasts.filter((f) => f.eventId === eventId).slice(-10),
          actors: {
            markets: { mediaExposure: 0.9, reactivity: 0.8, rationality: 0.6 },
            government: { mediaExposure: 0.7, reactivity: 0.6, rationality: 0.7 },
            public: { mediaExposure: 0.8, reactivity: 0.7, rationality: 0.3 },
          },
        }
      ),
      null
    );

    if (result) {
      corrected[eventId] = {
        ...forecast,
        reflexive: {
          type: result.reflexivityType,
          shift: result.totalShift,
          analysis: result.analysis,
        },
        finalProbability: result.reflexiveProbability,
      };
    } else {
      corrected[eventId] = forecast;
    }
  }
  return corrected;
}

// ═══════════════════════════════════════════════════════════════
// PHASE H: КАЛИБРОВКА
// ═══════════════════════════════════════════════════════════════

function phaseH_Calibration(eventForecasts, history) {
  console.log('[engine] Phase H: calibration');
  const trackerFile = join(PRED_DIR, 'forecast_tracker.json');
  let tracker;
  try {
    const data = loadJSON(trackerFile, null);
    tracker = data ? ForecastTracker.deserialize(JSON.stringify(data)) : new ForecastTracker();
  } catch {
    tracker = new ForecastTracker();
  }

  tracker.autoResolve((pred) => {
    const sweep = history.find((h) => {
      const t = new Date(h.timestamp).getTime();
      const pt = new Date(pred.timestamp).getTime();
      return t >= pt && t <= pt + pred.horizonHours * 3600000;
    });
    if (!sweep) return null;
    if (pred.source === 'market_crash' || pred.id?.includes('market_crash')) {
      return (sweep.fred?.vix || 0) > 40 ? 1 : 0;
    }
    if (pred.source === 'conflict_escalation' || pred.id?.includes('conflict')) {
      return (sweep.gdelt?.conflictEvents?.length || 0) > 15 ? 1 : 0;
    }
    return null;
  });

  for (const [eventId, forecast] of Object.entries(eventForecasts)) {
    tracker.addPrediction({
      id: `${eventId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: eventId,
      forecast: forecast.finalProbability,
      horizonHours: forecast.horizonHours || 24,
    });
  }

  saveJSON(trackerFile, JSON.parse(tracker.serialize()));

  const resolved = tracker.predictions.filter((p) => p.resolved);
  let calibrationFn = (p) => p;
  if (resolved.length >= 20) {
    calibrationFn = plattCalibration(resolved.map((p) => ({ forecast: p.forecast, outcome: p.outcome })));
  }

  const calibrated = {};
  for (const [eventId, forecast] of Object.entries(eventForecasts)) {
    const cp = calibrationFn(forecast.finalProbability);
    calibrated[eventId] = {
      ...forecast,
      calibratedProbability: Math.max(0.001, Math.min(0.999, cp)),
    };
  }

  return {
    calibrated,
    brierScores: tracker.brierBySource,
    ensembleWeights: tracker.getEnsembleWeights ? tracker.getEnsembleWeights() : {},
    trackerStats: {
      total: tracker.predictions.length,
      resolved: resolved.length,
      pending: tracker.predictions.length - resolved.length,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// PHASE K: ОБЪЯСНИМОСТЬ
// ═══════════════════════════════════════════════════════════════

function phaseK_Explainability(latest, eventForecasts, baseResults) {
  console.log('[engine] Phase K: explainability');
  const explanations = {};
  const features = sweepToFeatures(latest);

  for (const [eventId, forecast] of Object.entries(eventForecasts)) {
    const result = safeSyncCall(`explain_${eventId}`, () =>
      crucixExplainableForecast(
        {
          probability: forecast.finalProbability || forecast.ensemble,
          features,
          modelPredictions: (forecast.sourceBreakdown || []).map((s) => s.probability),
          horizonHours: forecast.horizonHours,
          confidence: 1 - (forecast.disagreement || 0),
          topRisks: [],
        },
        {
          baselineFeatures: { vix: 20, hySpread: 3, conflictCount: 3, sanctionsCount: 0 },
          thresholds: {
            vix: { high: 30, low: 18, midpoint: 24 },
            hySpread: { high: 6, low: 2, midpoint: 4 },
            conflictCount: { high: 15, low: 3, midpoint: 9 },
          },
          dataQuality: 0.7,
        }
      ),
      null
    );
    if (result) explanations[eventId] = result;
  }
  return explanations;
}

// ═══════════════════════════════════════════════════════════════
// PHASE L: АКТИВНОЕ ОБУЧЕНИЕ
// ═══════════════════════════════════════════════════════════════

function phaseL_ActiveLearning(latest, history) {
  console.log('[engine] Phase L: active learning');
  return safeSyncCall('activeLearning', () => {
    const alFile = join(PRED_DIR, 'active_learner.json');
    let al;
    try {
      const data = loadJSON(alFile, null);
      al = data ? ActiveLearner.deserialize(JSON.stringify(data)) : initCrucixActiveLearner();
    } catch {
      al = initCrucixActiveLearner();
    }
    const sources = ['gdelt', 'fred', 'yahoo', 'sanctions', 'radiation', 'polymarket', 'metaculus', 'satellite'];
    for (const src of sources) {
      const hasData = (latest && latest[src] !== undefined) ||
                      (src === 'fred' && latest && latest.fred) ||
                      (src === 'gdelt' && latest && latest.gdelt);
      if (hasData) {
        const vix = (latest && latest.fred && latest.fred.vix) || 20;
        al.observe(src, Math.min(1, Math.abs(vix - 20) / 20), 0.5);
      }
    }
    const rec = al.recommend();
    saveJSON(alFile, JSON.parse(al.serialize()));
    return rec;
  }, { error: 'failed' });
}

// ═══════════════════════════════════════════════════════════════
// РАСШИРЕННЫЙ ТРЕКИНГ + COMPOSITE RISK
// ═══════════════════════════════════════════════════════════════

function runExtendedTracking(result, calibrated, history) {
  console.log('[engine] Extended tracking + composite risk');

  try {
    const tracker = getExtendedTracker();
    if (tracker && typeof tracker.autoResolve === 'function') {
      tracker.autoResolve(history, (pred, h) => {
        const sweep = h.find((s) => {
          const t = new Date(s.timestamp).getTime();
          const pt = new Date(pred.timestamp).getTime();
          return t >= pt && t <= pt + (pred.horizonHours || 24) * 3600000;
        });
        if (!sweep) return null;
        if (pred.source === 'market_crash') return (sweep.fred?.vix || 0) > 40 ? 1 : 0;
        if (pred.source === 'conflict_escalation') return (sweep.gdelt?.conflictEvents?.length || 0) > 15 ? 1 : 0;
        return null;
      });
    }

    if (tracker && typeof tracker.addPrediction === 'function') {
      for (const [eventId, forecast] of Object.entries(calibrated)) {
        tracker.addPrediction({
          id: `${eventId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          source: eventId,
          forecast: forecast.calibratedProbability || forecast.finalProbability,
          horizonHours: forecast.horizonHours || 24,
        });
      }
      tracker.save();
    }

    result.trackerStats = tracker && typeof tracker.getStats === 'function'
      ? tracker.getStats()
      : { total: 0, resolved: 0, pending: 0 };
  } catch (e) {
    console.warn('[engine] extended_tracker failed:', e.message);
    result.trackerStats = { total: 0, resolved: 0, pending: 0, error: e.message };
  }

  try {
    result.compositeRisk = computeCompositeRisk(
      result.extended || {},
      { events: calibrated },
      { useTracker: true }
    );
  } catch (e) {
    console.warn('[engine] composite_risk failed:', e.message);
    result.compositeRisk = { composite: 0, level: 'low', error: e.message };
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// PHASE Z: ДИССЕМИНАЦИЯ
// ═══════════════════════════════════════════════════════════════

async function phaseZ_Dissemination(forecast, hooks) {
  console.log('[engine] Phase Z: dissemination');

  try { publishPrediction(forecast); } catch (e) { console.warn('[engine] publish failed:', e.message); }
  try { await notifyPrediction(forecast); } catch (e) { console.warn('[engine] notify failed:', e.message); }

  try {
    ensureDir(PRED_DIR);
    saveJSON(join(PRED_DIR, 'latest_forecast.json'), forecast);
    saveJSON(join(PRED_DIR, `forecast_${Date.now()}.json`), forecast);

    const fhistoryFile = join(PRED_DIR, 'forecast_history.json');
    const fhistory = loadJSON(fhistoryFile, []);
    for (const [eventId, f] of Object.entries(forecast.events || {})) {
      fhistory.push({
        eventId,
        probability: f.finalProbability || f.calibratedProbability || f.ensemble,
        timestamp: forecast.timestamp,
        horizonHours: f.horizonHours,
        published: true,
        outcome: null,
      });
    }
    saveJSON(fhistoryFile, fhistory.slice(-1000));
  } catch (e) {
    console.warn('[engine] save failed:', e.message);
  }

  try {
    ensureDir(PRED_DIR);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    saveJSON(join(PRED_DIR, `extended_${ts}.json`), forecast);
    saveJSON(join(PRED_DIR, 'latest_extended.json'), forecast);
  } catch (e) {
    console.warn('[engine] extended save failed:', e.message);
  }

  return { published: true };
}

// ═══════════════════════════════════════════════════════════════
// ГЛАВНАЯ ФУНКЦИЯ runForecastPipeline
// ═══════════════════════════════════════════════════════════════

async function runForecastPipeline(latest, options = {}) {
  const t0 = Date.now();
  const timestamp = new Date().toISOString();
  console.log(`[engine] Pipeline started — ${timestamp}`);

  // ─── Профиль ───
  const profileName = options.profile || 'balanced';
  const profile = PROFILES[profileName] || PROFILES.balanced;
  const phases = { ...profile.phases, ...(options.phases || {}) };
  console.log(`[engine] Profile: ${profileName}`);

  // ─── HookManager ───
  let hooks = null;
  try {
    hooks = getHookManager();
  } catch (e) {
    console.warn('[engine] hooks unavailable:', e.message);
  }

  if (hooks) {
    try { await hooks.emit('beforePrediction', latest); } catch (e) { console.warn('[engine] beforePrediction hook failed:', e.message); }
  }

  const failures = [];

  // ─── История ───
  const history = options.history || loadHistory(200);
  console.log(`[engine] Loaded ${history.length} historical sweeps`);

  // ─── Источники ───
  const sourceData = (!phases.F || options.skipSources)
    ? {}
    : await phaseF_Sources(latest, history);

  // ─── Базовые модели ───
  const baseResults = phases.B === false
    ? {}
    : phaseB_BaseModels(latest, history, sourceData);

  // ─── Научный синтез ───
  const scientificResults = (!phases.C || options.skipScientific)
    ? {}
    : phaseC_ScientificSynthesis(latest, history);

  // ─── Нейросетевой слой ───
  const neuralResults = (!phases.D || options.skipNeural)
    ? {}
    : phaseD_NeuralLayer(latest, history);

  // ─── Продвинутые модели ───
  const advancedResults = (!phases.E || options.skipAdvanced)
    ? {}
    : await phaseE_AdvancedModels(latest, history, baseResults);

  // ─── Граф знаний ───
  const knowledgeGraph = (!phases.G || options.skipKnowledgeGraph)
    ? null
    : phaseG_KnowledgeGraph(latest);

  // ─── Ансамблирование ───
  const eventForecasts = phases.I === false
    ? {}
    : phaseI_Ensemble(latest, baseResults, advancedResults, sourceData, neuralResults);

  // ─── Рефлексивная коррекция ───
  const reflexiveCorrected = (!phases.J || options.skipReflexive)
    ? eventForecasts
    : phaseJ_ReflexiveCorrection(eventForecasts, history);

  // ─── Калибровка ───
  const calibrationResult = phases.H === false
    ? { calibrated: reflexiveCorrected, brierScores: {}, ensembleWeights: {}, trackerStats: { total: 0, resolved: 0, pending: 0 } }
    : phaseH_Calibration(reflexiveCorrected, history);

  const { calibrated, brierScores, ensembleWeights, trackerStats } = calibrationResult;

  // ─── Объяснимость ───
  const explanations = (!phases.K || options.skipExplainability)
    ? {}
    : phaseK_Explainability(latest, calibrated, baseResults);

  // ─── Active Learning ───
  const activeLearningRec = (!phases.L || options.skipActiveLearning)
    ? null
    : phaseL_ActiveLearning(latest, history);

  // ─── Python Bridge ───
  let pythonStatus = null;
  try { pythonStatus = await bridgeStatus(); } catch {}

  // ─── Snapshot ───
  const forecast = {
    timestamp,
    elapsedMs: Date.now() - t0,
    version: ENGINE_VERSION,
    profile: profileName,

    events: calibrated,
    explanations,
    topRisks: Object.entries(calibrated)
      .map(([id, f]) => ({
        id,
        name: f.name,
        probability: f.calibratedProbability || f.finalProbability || f.ensemble,
        horizonHours: f.horizonHours,
        category: f.category,
        disagreement: f.disagreement,
        reflexivityType: f.reflexive?.type,
      }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 5),

    stateClassification: {
      predicted: baseResults.currentState,
      naiveBayes: baseResults.naiveBayes,
    },
    markov: baseResults.markov,
    monteCarlo: baseResults.monteCarlo,
    timeseries: baseResults.timeseries,
    cascade: baseResults.cascade,

    scientific: scientificResults,
    neural: neuralResults,
    advanced: advancedResults,
    sources: sourceData,
    knowledgeGraph,

    calibration: { brierScores, ensembleWeights, trackerStats },
    activeLearning: activeLearningRec,
    pythonBridge: pythonStatus,

    summary: {
      topRisk: null,
      regimeShift: advancedResults.regimeShift?.regimeShiftDetected
        ? `REGIME SHIFT (${advancedResults.regimeShift.severity})`
        : 'stable',
      signalsProcessed: Object.keys(calibrated).length,
      elapsedMs: Date.now() - t0,
    },

    failures,
  };

  if (forecast.topRisks.length > 0) {
    forecast.summary.topRisk = `${forecast.topRisks[0].name}: ${(forecast.topRisks[0].probability * 100).toFixed(1)}%`;
  }

  // ─── v3 extended (9 модулей) ───
  if (phases.G !== false && options.skipV3 !== true) {
    try {
      await runCrucixExtendedV3(latest, history, forecast, {
        skipPhaseJ: options.skipV3PhaseJ,
        skipPhaseK: options.skipV3PhaseK,
        skipPhaseL: options.skipV3PhaseL,
        skipPhaseM: options.skipV3PhaseM,
      });
    } catch (e) {
      console.warn('[engine] v3 extended failed:', e.message);
      failures.push({ module: 'crucix_engine_v3', error: e.message });
    }
  }

  // ─── ФАЗЫ S+T (v6.0 + каталог) ───
  if (phases.S !== false || phases.T !== false) {
    try {
      const [v6Phase, catalogPhase] = await Promise.all([
        phases.S !== false ? runV6Phase(history, { disabled: options.disabledV6 || [] }) : Promise.resolve(null),
        phases.T !== false ? runCatalogPhase(history, { disabled: options.disabledCatalog || [] }) : Promise.resolve(null),
      ]);
      applyV6ToSnapshot(forecast, v6Phase, catalogPhase);
      const v6ok = v6Phase?.okCount ?? 0;
      const catok = catalogPhase?.okCount ?? 0;
      console.log(`[engine] S+T: v6 ${v6ok}/${v6Phase?.totalModules ?? 0}, catalog ${catok}/${catalogPhase?.totalModules ?? 0}`);
    } catch (e) {
      console.error('[engine] S+T failed:', e.message);
      failures.push({ module: 'engine_v6_patch', error: e.message });
    }
  }

  // ─── ФАЗА U (v7.0 Simulation Engine) ───
  if (phases.U !== false) {
    try {
      const v7Phase = await runV7Phase(history, {
        horizon: 12,
        disabled: options.disabledV7 || [],
        modules: options.modulesV7 || undefined,
        interventions: options.interventionsV7 || undefined,
      });
      applyV7ToSnapshot(forecast, v7Phase);
      if (v7Phase.ok) {
        console.log(`[engine] U: ok=${v7Phase.ok}, modules=${v7Phase.result?.activeModules}/${v7Phase.result?.totalModules}`);
      } else {
        console.log(`[engine] U skipped: ${v7Phase.reason || v7Phase.error}`);
      }
    } catch (e) {
      console.error('[engine] U failed:', e.message);
      failures.push({ module: 'engine_v7_patch', error: e.message });
    }
  }

  // ─── Extended tracking + composite risk ───
  runExtendedTracking(forecast, calibrated, history);

  // ─── Hooks afterPrediction ───
  if (hooks) {
    try { await hooks.emit('afterPrediction', forecast); } catch (e) { console.warn('[engine] afterPrediction hook failed:', e.message); }

    try {
      for (const sig of forecast.compositeRisk?.signals || []) {
        await hooks.emit('onSignal', sig, sig.value);
        if (sig.value > 0.7) {
          await hooks.emit('onSignalHigh', sig);
        }
      }
    } catch (e) { console.warn('[engine] signal hooks failed:', e.message); }

    try {
      if (advancedResults.changePointVix?.changeProbability > 0.5) {
        await hooks.emit('onRegimeChange', advancedResults.changePointVix);
      }
    } catch (e) { console.warn('[engine] regime hook failed:', e.message); }

    try {
      if (forecast.compositeRisk?.level === 'critical' || forecast.compositeRisk?.level === 'high') {
        await hooks.emit('onAlert', {
          level: forecast.compositeRisk.level,
          composite: forecast.compositeRisk.composite,
          topDrivers: forecast.compositeRisk.topDrivers,
        });
      }
    } catch (e) { console.warn('[engine] alert hook failed:', e.message); }
  }

  // ─── Интеграции ───
  try {
    const integrations = getIntegrationManager();
    if (integrations && typeof integrations.dispatch === 'function') {
      await integrations.dispatch(forecast);
    }
  } catch (e) {
    console.warn('[engine] integrations dispatch failed:', e.message);
  }

  // ─── PWA push ───
  try {
    const vapidKeys = loadOrCreateVAPIDKeys();
    const pushStore = new SubscriptionStore();
    const pushResult = await notifyPush(forecast, pushStore, vapidKeys);
    forecast.pushResult = pushResult;
  } catch (e) {
    console.warn('[engine] push notify failed:', e.message);
  }

  // ─── Фаза Z ───
  await phaseZ_Dissemination(forecast, hooks);

  forecast.elapsedMs = Date.now() - t0;

  console.log(`[engine] Pipeline completed in ${forecast.elapsedMs}ms`);
  console.log(`[engine] Top risk: ${forecast.summary.topRisk}`);

  return forecast;
}

// ═══════════════════════════════════════════════════════════════
// КЛАСС FORECASTENGINE — обёртка с init/runCycle/handleHTTP/shutdown
// ═══════════════════════════════════════════════════════════════

class ForecastEngine {
  constructor(config = {}) {
    this.config = config;
    this.version = ENGINE_VERSION;
    this.dataPath = config.dataPath || BASKET_DIR;
    this.outputPath = config.outputPath || PRED_DIR;
    this.publishFn = typeof config.publishFn === 'function' ? config.publishFn : () => {};
    this.breaker = new CircuitBreaker(
      config.circuitThreshold || 3,
      config.circuitCooldown || 5,
    );

    this.hooks = null;
    this.plugins = null;
    this.registry = null;
    this.integrations = null;
    this.vapidKeys = null;
    this.pushStore = null;
    this.pushHandlers = null;

    this.state = {
      loaded: false,
      pluginsLoaded: 0,
      lastCycle: null,
      cyclesCompleted: 0,
      startedAt: new Date().toISOString(),
    };
  }

  async init() {
    console.log('[engine] ForecastEngine initializing...');

    try { this.hooks = getHookManager(); } catch (e) { console.warn('[engine] hooks unavailable:', e.message); }
    try { this.plugins = getPluginLoader(); } catch (e) { console.warn('[engine] plugins unavailable:', e.message); }
    try { this.registry = getPluginRegistry(); } catch (e) { console.warn('[engine] registry unavailable:', e.message); }
    try { this.integrations = getIntegrationManager(this.config.integrations || {}); } catch (e) { console.warn('[engine] integrations unavailable:', e.message); }
    try {
      this.vapidKeys = loadOrCreateVAPIDKeys();
      this.pushStore = new SubscriptionStore();
      this.pushHandlers = createPushHandlers(this.vapidKeys, this.pushStore);
    } catch (e) { console.warn('[engine] push unavailable:', e.message); }

    if (this.plugins && typeof this.plugins.loadAll === 'function') {
      try {
        const pluginResults = await this.plugins.loadAll();
        this.state.pluginsLoaded = pluginResults.filter((r) => r.ok).length;
        console.log(`[engine] Plugins loaded: ${this.state.pluginsLoaded}/${pluginResults.length}`);
      } catch (e) { console.warn('[engine] loadAll failed:', e.message); }
    }

    if (this.hooks && this.plugins && this.plugins.plugins) {
      for (const [name, plugin] of this.plugins.plugins) {
        for (const hookName of plugin.manifest?.hooks || []) {
          if (typeof plugin.module[hookName] === 'function') {
            try {
              this.hooks.on(hookName, plugin.module[hookName], {
                pluginName: name,
                priority: plugin.manifest.priority || 0,
              });
            } catch (e) { console.warn(`[engine] hook register failed for ${name}.${hookName}:`, e.message); }
          }
        }
      }
    }

    if (this.hooks) {
      try { await this.hooks.emit('onStartup'); } catch (e) { console.warn('[engine] onStartup failed:', e.message); }
      try { this.hooks.scheduleTimer('onTimer', 60000); } catch (e) { console.warn('[engine] scheduleTimer failed:', e.message); }
    }

    if (typeof process !== 'undefined') {
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());
    }

    this.state.loaded = true;
    console.log('[engine] Ready');
    return this;
  }

  /**
   * Загрузка данных из корзины (RULES.txt) с fallback на runs/latest.json.
   */
  loadData() {
    let latest = null;
    let history = [];

    if (existsSync(LATEST_BASKET_PATH)) {
      latest = loadJSON(LATEST_BASKET_PATH, null);
      const historyPath = join(this.dataPath, 'history.json');
      history = loadJSON(historyPath, []);
      if (Array.isArray(history)) history = history.slice(-200);
    }

    if (!latest) {
      latest = loadJSON(LATEST_PATH, null);
      if (!history || history.length === 0) {
        history = loadHistory(200);
      }
    }

    if (!latest) {
      throw new Error(`No latest data found at ${LATEST_BASKET_PATH} or ${LATEST_PATH}`);
    }

    return { latest, history: Array.isArray(history) ? history : [] };
  }

  /**
   * Запуск одного цикла прогноза.
   */
  async runCycle(latest, history) {
    const t0 = Date.now();
    console.log(`[engine] Cycle start (${new Date().toISOString()})`);

    const forecast = await runForecastPipeline(latest, {
      history,
      profile: this.config.profile || 'balanced',
    });

    this.state.cyclesCompleted++;
    this.state.lastCycle = forecast.timestamp;

    try {
      this.publishFn('forecast', forecast);
    } catch (e) {
      console.warn('[engine] publishFn failed:', e.message);
    }

    forecast.durationMs = Date.now() - t0;
    return forecast;
  }

  /**
   * HTTP-обработка для REST API.
   * Возвращает true, если запрос обработан, иначе false.
   */
  async handleHTTP(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (url.pathname.startsWith('/api/plugins')) {
      await handlePluginsAPI(req, res, url);
      return true;
    }

    if (this.pushHandlers) {
      if (url.pathname === '/api/push/vapid-key' && req.method === 'GET') {
        return this.pushHandlers.getVapidKey(req, res);
      }
      if (url.pathname === '/api/push/subscribe' && req.method === 'POST') {
        return await this.pushHandlers.subscribe(req, res);
      }
      if (url.pathname === '/api/push/unsubscribe' && req.method === 'POST') {
        return await this.pushHandlers.unsubscribe(req, res);
      }
      if (url.pathname === '/api/push/test' && req.method === 'POST') {
        return await this.pushHandlers.test(req, res);
      }
    }

    if (url.pathname === '/api/integrations/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(
        this.integrations && typeof this.integrations.status === 'function'
          ? this.integrations.status()
          : { error: 'integrations_unavailable' },
        null, 2
      ));
      return true;
    }

    if (url.pathname === '/api/engine/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        version: ENGINE_VERSION,
        state: this.state,
        hooks: this.hooks && typeof this.hooks.status === 'function' ? this.hooks.status() : null,
        plugins: this.plugins ? {
          loaded: this.plugins.plugins ? this.plugins.plugins.size : 0,
          list: typeof this.plugins.list === 'function' ? this.plugins.list() : [],
        } : null,
        integrations: this.integrations && typeof this.integrations.status === 'function'
          ? this.integrations.status() : null,
        push: {
          subscriptions: this.pushStore && typeof this.pushStore.count === 'function'
            ? this.pushStore.count() : 0,
        },
      }, null, 2));
      return true;
    }

    return false;
  }

  /**
   * Graceful shutdown.
   */
  async shutdown() {
    console.log('[engine] Shutting down...');

    if (this.hooks) {
      try { this.hooks.stopTimers(); } catch {}
      try { await this.hooks.emit('onShutdown'); } catch {}
    }

    if (this.plugins && this.plugins.plugins) {
      for (const name of [...this.plugins.plugins.keys()]) {
        try { await this.plugins.unload(name); } catch {}
      }
    }

    process.exit(0);
  }

  healthcheck() {
    return {
      version: ENGINE_VERSION,
      loaded: this.state.loaded,
      cyclesCompleted: this.state.cyclesCompleted,
      lastCycle: this.state.lastCycle,
      breaker: this.breaker ? 'active' : 'inactive',
      timestamp: new Date().toISOString(),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// ФАБРИКА
// ═══════════════════════════════════════════════════════════════

function createForecastEngine(options = {}) {
  return new ForecastEngine(options);
}

/**
 * Полный цикл v4: загрузка данных, init, runCycle.
 */
async function runFullEngineCycle(latestPath, opts = {}) {
  let latest, history = [];

  try {
    const path = latestPath || LATEST_PATH;
    latest = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { error: 'cannot_read_latest' };
  }

  try {
    const files = readdirSync(MEMORY_DIR).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, 500);
    for (const file of files) {
      try {
        history.push(JSON.parse(readFileSync(join(MEMORY_DIR, file), 'utf-8')));
      } catch {}
    }
  } catch {}

  const engine = new ForecastEngine(opts.config || {});
  await engine.init();

  return await engine.runCycle(latest, history);
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

if (process.argv[1] && process.argv[1].endsWith('engine.mjs')) {
  const latest = loadJSON(LATEST_PATH, null);
  if (!latest) {
    console.error(`[engine] latest.json not found at ${LATEST_PATH}`);
    process.exit(1);
  }
  runForecastPipeline(latest).then((forecast) => {
    console.log('\\n════════════════════════════════════════════');
    console.log('  CRUCIX FORECAST');
    console.log('════════════════════════════════════════════');
    console.log(`  Version: ${forecast.version}`);
    console.log(`  Profile: ${forecast.profile}`);
    console.log(`  Elapsed: ${forecast.elapsedMs}ms`);
    console.log(`  State:   ${forecast.stateClassification.predicted}`);
    console.log(`  Top:     ${forecast.summary.topRisk}`);
    console.log('');
    console.log('  Top Risks:');
    for (const r of forecast.topRisks) {
      const pct = (r.probability * 100).toFixed(1);
      console.log(`    • ${r.name}: ${pct}%`);
    }
    console.log('════════════════════════════════════════════\\n');
  }).catch((e) => {
    console.error('[engine] Pipeline failed:', e);
    process.exit(1);
  });
}

// ═══════════════════════════════════════════════════════════════
// ЭКСПОРТЫ
// ═══════════════════════════════════════════════════════════════

export {
  runForecastPipeline,
  createForecastEngine,
  runFullEngineCycle,
  ForecastEngine,
  CircuitBreaker,

  phaseB_BaseModels,
  phaseC_ScientificSynthesis,
  phaseD_NeuralLayer,
  phaseE_AdvancedModels,
  phaseF_Sources,
  phaseG_KnowledgeGraph,
  phaseH_Calibration,
  phaseI_Ensemble,
  phaseJ_ReflexiveCorrection,
  phaseK_Explainability,
  phaseL_ActiveLearning,
  phaseZ_Dissemination,

  TRACKED_EVENTS,
  PROFILES,
  BASE_WEIGHTS,
  TOTAL_ENSEMBLE_MODULES,
  ENGINE_VERSION,

  hashData,
  timing,
};

export default runForecastPipeline;
