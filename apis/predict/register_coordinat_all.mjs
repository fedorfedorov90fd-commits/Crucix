// apis/predict/register_coordinat_all.mjs
// Реестр прогностических модулей Crucix.
//
// Назначение:
//   Единый каталог всех модулей, используемых в 16-фазном конвейере engine.mjs.
//   Содержит: имя модуля, фазу, тип, экспортируемую функцию, минимальную историю,
//   timeout, описание.
//
// Применение:
//   - healthcheck всех модулей (existsSync + доступность функции).
//   - интроспекция для дашбордов и REST API /api/engine/modules.
//   - проверка совместимости при добавлении нового модуля.
//
// Синхронизировано с engine.mjs (фазы B-L, S, T, U).
//
// Версия: 1.0.0

import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════
// РЕЕСТР МОДУЛЕЙ
// ═══════════════════════════════════════════════════════════════

const MODULES = [
  // ─── ФАЗА B: БАЗОВЫЕ МОДЕЛИ ───
  { name: 'bayesian', path: './bayesian.mjs', fn: 'updateEvent', phase: 'B', type: 'predictive', minHistory: 5, timeoutMs: 5000, description: 'Байесовское обновление с evidence' },
  { name: 'naivebayes', path: './naivebayes.mjs', fn: 'GaussianNaiveBayes', phase: 'B', type: 'predictive', minHistory: 10, timeoutMs: 5000, description: 'Наивный байесовский классификатор' },
  { name: 'markov', path: './markov.mjs', fn: 'MarkovChain', phase: 'B', type: 'predictive', minHistory: 5, timeoutMs: 5000, description: 'Цепи Маркова (переходные вероятности)' },
  { name: 'montecarlo', path: './montecarlo.mjs', fn: 'crucixMarketScenario', phase: 'B', type: 'predictive', minHistory: 10, timeoutMs: 30000, description: 'Монте-Карло симуляция рыночных сценариев' },
  { name: 'timeseries', path: './timeseries.mjs', fn: 'forecastVix', phase: 'B', type: 'predictive', minHistory: 10, timeoutMs: 10000, description: 'Временные ряды (SES/Holt/AR)' },
  { name: 'cascade', path: './cascade.mjs', fn: 'CascadeGraph', phase: 'B', type: 'predictive', minHistory: 5, timeoutMs: 5000, description: 'Каскадные цепочки событий' },
  { name: 'calibration', path: './calibration.mjs', fn: 'ForecastTracker', phase: 'B', type: 'meta', minHistory: 20, timeoutMs: 10000, description: 'Калибровка через Brier Score' },

  // ─── ФАЗА C: НАУЧНЫЙ СИНТЕЗ ───
  { name: 'hawkes', path: './models/hawkes.mjs', fn: 'HawkesProcess', phase: 'C', type: 'predictive', minHistory: 5, timeoutMs: 10000, description: 'Само-возбуждающийся точечный процесс' },
  { name: 'hmm', path: './models/hmm.mjs', fn: 'createCrucixHMM', phase: 'C', type: 'predictive', minHistory: 10, timeoutMs: 10000, description: 'Скрытые марковские модели' },
  { name: 'kalman', path: './models/kalman.mjs', fn: 'Kalman1D', phase: 'C', type: 'predictive', minHistory: 5, timeoutMs: 5000, description: 'Фильтр Калмана' },
  { name: 'ising', path: './models/ising.mjs', fn: 'IsingModel', phase: 'C', type: 'predictive', minHistory: 5, timeoutMs: 10000, description: 'Модель Изинга' },
  { name: 'transferentropy', path: './models/transferentropy.mjs', fn: 'influenceMatrix', phase: 'C', type: 'predictive', minHistory: 15, timeoutMs: 10000, description: 'Transfer Entropy' },
  { name: 'contagion', path: './models/contagion.mjs', fn: 'SIRModel', phase: 'C', type: 'predictive', minHistory: 5, timeoutMs: 10000, description: 'SIR/SEIR' },
  { name: 'evt', path: './models/evt.mjs', fn: 'extremeEventProbability', phase: 'C', type: 'predictive', minHistory: 20, timeoutMs: 10000, description: 'Extreme Value Theory' },
  { name: 'ornstein', path: './models/ornstein.mjs', fn: 'OrnsteinUhlenbeck', phase: 'C', type: 'predictive', minHistory: 15, timeoutMs: 10000, description: 'Ornstein-Uhlenbeck' },
  { name: 'copula', path: './models/copula.mjs', fn: 'dependenceAnalysis', phase: 'C', type: 'predictive', minHistory: 15, timeoutMs: 10000, description: 'Copula' },
  { name: 'bocpd', path: './models/bocpd.mjs', fn: 'BOCPD', phase: 'C', type: 'predictive', minHistory: 10, timeoutMs: 10000, description: 'Bayesian Online Change Point Detection' },
  { name: 'particle', path: './models/particle.mjs', fn: 'ParticleFilter', phase: 'C', type: 'predictive', minHistory: 5, timeoutMs: 10000, description: 'Particle Filter' },

  // ─── ФАЗА D: НЕЙРОСЕТЕВОЙ СЛОЙ ───
  { name: 'mlp', path: './models/neural.mjs', fn: 'MLP', phase: 'D', type: 'predictive', minHistory: 30, timeoutMs: 30000, description: 'MLP нейросеть' },
  { name: 'gcn', path: './models/graph_neural.mjs', fn: 'crucixGCNAnalysis', phase: 'D', type: 'predictive', minHistory: 5, timeoutMs: 20000, description: 'Graph Convolutional Network' },
  { name: 'dqn', path: './models/reinforcement.mjs', fn: 'DQN', phase: 'D', type: 'meta', minHistory: 10, timeoutMs: 20000, description: 'Deep Q-Network' },

  // ─── ФАЗА E: ПРОДВИНУТЫЕ МОДЕЛИ ───
  { name: 'swarm', path: './swarm.mjs', fn: 'crucixSwarmForecast', phase: 'E', type: 'predictive', minHistory: 5, timeoutMs: 60000, description: 'Swarm (агентная симуляция)' },
  { name: 'causal', path: './causal.mjs', fn: 'crucixCausalAnalysis', phase: 'E', type: 'predictive', minHistory: 20, timeoutMs: 30000, description: 'Causal inference' },
  { name: 'gametheory', path: './gametheory.mjs', fn: 'crucixGameTheoryAnalysis', phase: 'E', type: 'predictive', minHistory: 5, timeoutMs: 20000, description: 'Теория игр' },
  { name: 'narrative', path: './narrative.mjs', fn: 'crucixNarrativeAnalysis', phase: 'E', type: 'predictive', minHistory: 10, timeoutMs: 30000, description: 'Нарративы' },
  { name: 'regime_shift', path: './regime_shift.mjs', fn: 'crucixRegimeShiftDetection', phase: 'E', type: 'predictive', minHistory: 20, timeoutMs: 20000, description: 'Детектор смены режима' },

  // ─── ФАЗА F: ИСТОЧНИКИ ───
  { name: 'prediction_markets', path: '../sources/prediction_markets.mjs', fn: 'fetchPredictionMarkets', phase: 'F', type: 'source', minHistory: 0, timeoutMs: 15000, description: 'Polymarket/Metaculus/Kalshi' },
  { name: 'multilang', path: '../sources/multilang.mjs', fn: 'processMultilingual', phase: 'F', type: 'source', minHistory: 5, timeoutMs: 15000, description: 'Многоязычный NLP' },
  { name: 'satellite', path: '../sources/satellite.mjs', fn: 'fetchSatelliteData', phase: 'F', type: 'source', minHistory: 0, timeoutMs: 20000, description: 'Спутниковая аналитика' },

  // ─── ФАЗА G: ГРАФ ЗНАНИЙ ───
  { name: 'knowledge_graph', path: '../knowledge/graph.mjs', fn: 'buildGraphFromSweep', phase: 'G', type: 'meta', minHistory: 0, timeoutMs: 10000, description: 'Граф знаний' },

  // ─── ФАЗА I: АНСАМБЛИРОВАНИЕ ───
  { name: 'ensemble', path: './ensemble.mjs', fn: 'ensembleForecast', phase: 'I', type: 'meta', minHistory: 0, timeoutMs: 5000, description: 'Ансамбль 4 методов' },

  // ─── ФАЗА J: РЕФЛЕКСИВНАЯ КОРРЕКЦИЯ ───
  { name: 'reflexive', path: './reflexive.mjs', fn: 'applyReflexiveCorrection', phase: 'J', type: 'predictive', minHistory: 5, timeoutMs: 10000, description: 'Рефлексивная коррекция' },

  // ─── ФАЗА K: ОБЪЯСНИМОСТЬ ───
  { name: 'explainability', path: './explainability.mjs', fn: 'crucixExplainableForecast', phase: 'K', type: 'meta', minHistory: 0, timeoutMs: 10000, description: 'Permutation importance + counterfactual' },

  // ─── ФАЗА L: АКТИВНОЕ ОБУЧЕНИЕ ───
  { name: 'active_learning', path: './active_learning.mjs', fn: 'initCrucixActiveLearner', phase: 'L', type: 'meta', minHistory: 0, timeoutMs: 5000, description: 'Active Learning' },

  // ─── ФАЗА S: v6.0 ───
  { name: 'neural_causal_discovery', path: './v6/neural_causal_discovery.mjs', fn: 'crucixNeuralCausalDiscovery', phase: 'S', type: 'predictive', minHistory: 20, timeoutMs: 60000, description: 'NO TEARS + Multi-Head Attention' },
  { name: 'continual_learning', path: './v6/continual_learning.mjs', fn: 'crucixContinualLearning', phase: 'S', type: 'predictive', minHistory: 30, timeoutMs: 90000, description: 'EWC + Synaptic Intelligence' },
  { name: 'causal_rl', path: './v6/causal_rl.mjs', fn: 'crucixCausalRL', phase: 'S', type: 'predictive', minHistory: 20, timeoutMs: 120000, description: 'Causal RL' },
  { name: 'quantum_hypergraph', path: './v6/quantum_hypergraph.mjs', fn: 'crucixQuantumHypergraph', phase: 'S', type: 'predictive', minHistory: 30, timeoutMs: 90000, description: 'QUBO + Path-Integral Annealing' },
  { name: 'zk_federated', path: './v6/zk_federated.mjs', fn: 'crucixZKFederated', phase: 'S', type: 'predictive', minHistory: 30, timeoutMs: 90000, description: 'ZK-Schnorr + DP' },

  // ─── ФАЗА T: КАТАЛОГ ───
  { name: 'mcmc', path: './models/mcmc.mjs', fn: 'crucixMCMC', phase: 'T', type: 'predictive', minHistory: 20, timeoutMs: 60000, description: 'MCMC (MH/Gibbs/HMC)' },
  { name: 'physics_inspired', path: './models/physics_inspired.mjs', fn: 'crucixPhysicsInspired', phase: 'T', type: 'predictive', minHistory: 20, timeoutMs: 60000, description: 'SOC/Percolation/Catastrophe/Chaos' },
  { name: 'automl', path: './automl.mjs', fn: 'crucixAutoML', phase: 'T', type: 'meta', minHistory: 30, timeoutMs: 120000, description: 'GP + Bayesian Optimization' },
  { name: 'anomaly_detection', path: './anomaly_detection.mjs', fn: 'crucixAnomalyDetection', phase: 'T', type: 'predictive', minHistory: 20, timeoutMs: 60000, description: 'IsolationForest/LOF/Mahalanobis/SVM/DBSCAN' },
  { name: 'graph_sage', path: './models/graph_sage.mjs', fn: 'crucixGraphSAGE', phase: 'T', type: 'predictive', minHistory: 20, timeoutMs: 60000, description: 'GraphSAGE (индуктивный GNN)' },
  { name: 'actor_critic', path: './models/actor_critic.mjs', fn: 'crucixActorCritic', phase: 'T', type: 'predictive', minHistory: 30, timeoutMs: 90000, description: 'A2C + GAE' },

  // ─── ФАЗА U: v7.0 ───
  { name: 'simulation_engine', path: './v7/simulation_engine.mjs', fn: 'crucixSimulationEngine', phase: 'U', type: 'predictive', minHistory: 30, timeoutMs: 180000, description: 'World Model + Neural ODE + Dreamer + Continuous Causal' },

  // ─── v3 EXPANDED (J3/K3/L3) ───
  { name: 'temporal_causal', path: './temporal_causal.mjs', fn: 'crucixTemporalCausalAnalysis', phase: 'J3', type: 'predictive', minHistory: 20, timeoutMs: 20000, description: 'Распределения задержек' },
  { name: 'multilayer_causal', path: './multilayer_causal.mjs', fn: 'crucixMultiLayerCausal', phase: 'J3', type: 'predictive', minHistory: 10, timeoutMs: 20000, description: '4-слойный причинный DAG' },
  { name: 'narrative_warfare', path: './narrative_warfare.mjs', fn: 'crucixNarrativeWarfare', phase: 'J3', type: 'predictive', minHistory: 10, timeoutMs: 20000, description: 'Детектор кампаний влияния' },
  { name: 'resource_exhaustion', path: './resource_exhaustion.mjs', fn: 'crucixResourceExhaustion', phase: 'J3', type: 'predictive', minHistory: 10, timeoutMs: 20000, description: 'Истощение ресурсов' },
  { name: 'meta_ensemble', path: './meta_ensemble.mjs', fn: 'crucixMetaEnsemble', phase: 'J3', type: 'meta', minHistory: 20, timeoutMs: 20000, description: 'Online model selection' },
  { name: 'scenario_generator', path: './scenario_generator.mjs', fn: 'crucixScenarioGeneration', phase: 'K3', type: 'predictive', minHistory: 5, timeoutMs: 60000, description: 'LLM-генерация сценариев' },
  { name: 'hypergraph_contagion', path: './hypergraph_contagion.mjs', fn: 'crucixHypergraphContagion', phase: 'L3', type: 'predictive', minHistory: 10, timeoutMs: 20000, description: 'N-арные связи' },
  { name: 'attention_dynamics', path: './attention_dynamics.mjs', fn: 'crucixAttentionDynamics', phase: 'L3', type: 'predictive', minHistory: 5, timeoutMs: 20000, description: 'Коллективное внимание' },
  { name: 'adversarial_coevolution', path: './adversarial_coevolution.mjs', fn: 'crucixAdversarialCoEvolution', phase: 'L3', type: 'predictive', minHistory: 10, timeoutMs: 20000, description: 'Адаптация противника' },

  // ─── Z: ТРЕКИНГ И COMPOSITE ───
  { name: 'extended_tracker', path: './extended_tracker.mjs', fn: 'ExtendedTracker', phase: 'Z', type: 'meta', minHistory: 0, timeoutMs: 5000, description: 'Brier декомпозиция, drift' },
  { name: 'composite_risk', path: './composite_risk.mjs', fn: 'computeCompositeRisk', phase: 'Z', type: 'meta', minHistory: 0, timeoutMs: 5000, description: 'Композитный индикатор риска' },
];

// ═══════════════════════════════════════════════════════════════
// ФУНКЦИИ ИНТРОСПЕКЦИИ
// ═══════════════════════════════════════════════════════════════

function groupByPhase() {
  const byPhase = {};
  for (const m of MODULES) {
    if (!byPhase[m.phase]) byPhase[m.phase] = [];
    byPhase[m.phase].push(m.name);
  }
  return byPhase;
}

function groupByType() {
  const byType = {};
  for (const m of MODULES) {
    if (!byType[m.type]) byType[m.type] = [];
    byType[m.type].push(m.name);
  }
  return byType;
}

async function healthcheck() {
  const results = [];
  for (const m of MODULES) {
    const fullPath = join(__dirname, m.path);
    const exists = existsSync(fullPath);
    let exportAvailable = false;
    let error = null;

    if (exists) {
      try {
        const mod = await import(pathToFileURL(fullPath).href);
        exportAvailable = mod[m.fn] !== undefined;
      } catch (e) {
        error = e.message;
      }
    } else {
      error = 'file_not_found';
    }

    results.push({
      name: m.name,
      phase: m.phase,
      path: m.path,
      exists,
      exportAvailable,
      error,
    });
  }

  const ok = results.filter((r) => r.exists && r.exportAvailable).length;
  const failed = results.filter((r) => !r.exists || !r.exportAvailable);

  return {
    total: MODULES.length,
    ok,
    failed: failed.length,
    failures: failed,
    timestamp: new Date().toISOString(),
  };
}

function findModule(name) {
  return MODULES.find((m) => m.name === name) || null;
}

function findByPhase(phase) {
  return MODULES.filter((m) => m.phase === phase);
}

function findByType(type) {
  return MODULES.filter((m) => m.type === type);
}

function stats() {
  const byPhase = groupByPhase();
  const byType = groupByType();
  return {
    total: MODULES.length,
    byPhase: Object.fromEntries(Object.entries(byPhase).map(([k, v]) => [k, v.length])),
    byType: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length])),
    phases: Object.keys(byPhase).sort(),
    types: Object.keys(byType).sort(),
  };
}

function list() {
  return MODULES.map((m) => ({
    name: m.name,
    path: m.path,
    fn: m.fn,
    phase: m.phase,
    type: m.type,
    minHistory: m.minHistory,
    timeoutMs: m.timeoutMs,
    description: m.description,
  }));
}

export {
  MODULES,
  groupByPhase,
  groupByType,
  healthcheck,
  findModule,
  findByPhase,
  findByType,
  stats,
  list,
};
