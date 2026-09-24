// apis/predict/engine_v6_patch.mjs
// Engine v6.0 + каталог Integration Patch
//
// Назначение:
//   Подключить 11 новых модулей (5 из v6.0 + 6 из каталога) к
//   13-фазному конвейеру engine.mjs как фазы S и T.
//
// Архитектура:
//   Фаза S (v6.0 extensions):
//     - neural_causal_discovery.mjs
//     - continual_learning.mjs
//     - causal_rl.mjs
//     - quantum_hypergraph.mjs
//     - zk_federated.mjs
//
//   Фаза T (catalog extensions):
//     - models/mcmc.mjs
//     - models/physics_inspired.mjs
//     - automl.mjs
//     - anomaly_detection.mjs
//     - models/graph_sage.mjs
//     - models/actor_critic.mjs
//
// Принципы:
//   - Promise.allSettled (не Promise.all) — падение одного не рушит фазу
//   - Таймаут на модуль (по умолчанию 60 секунд)
//   - Circuit breaker: после 3 падений подряд модуль отключается
//   - Каждый модуль возвращает свой JSON, они сохраняются в runs/predictions/
//   - Результаты агрегируются в snapshot.v6_extensions и snapshot.catalog_extensions
//
// Версия: 1.0.0

import { existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATCH_VERSION = '1.0.0';

// ═══════════════════════════════════════════════════
// РЕЕСТР МОДУЛЕЙ
// ═══════════════════════════════════════════════════

/**
 * Динамический импорт модулей.
 * Каждый модуль описывается:
 *   - path: путь до .mjs
 *   - fn: имя экспортируемой функции (crucix*)
 *   - minHistory: минимальное число sweep'ов для запуска
 *   - timeoutMs: таймаут на выполнение
 */
const V6_MODULES = [
  {
    name: 'neural_causal_discovery',
    path: './v6/neural_causal_discovery.mjs',
    fn: 'crucixNeuralCausalDiscovery',
    minHistory: 20,
    timeoutMs: 60_000,
  },
  {
    name: 'continual_learning',
    path: './v6/continual_learning.mjs',
    fn: 'crucixContinualLearning',
    minHistory: 30,
    timeoutMs: 90_000,
  },
  {
    name: 'causal_rl',
    path: './v6/causal_rl.mjs',
    fn: 'crucixCausalRL',
    minHistory: 20,
    timeoutMs: 120_000,
  },
  {
    name: 'quantum_hypergraph',
    path: './v6/quantum_hypergraph.mjs',
    fn: 'crucixQuantumHypergraph',
    minHistory: 30,
    timeoutMs: 90_000,
  },
  {
    name: 'zk_federated',
    path: './v6/zk_federated.mjs',
    fn: 'crucixZKFederated',
    minHistory: 30,
    timeoutMs: 90_000,
  },
];

const CATALOG_MODULES = [
  {
    name: 'mcmc',
    path: './models/mcmc.mjs',
    fn: 'crucixMCMC',
    minHistory: 20,
    timeoutMs: 60_000,
  },
  {
    name: 'physics_inspired',
    path: './models/physics_inspired.mjs',
    fn: 'crucixPhysicsInspired',
    minHistory: 20,
    timeoutMs: 60_000,
  },
  {
    name: 'automl',
    path: './automl.mjs',
    fn: 'crucixAutoML',
    minHistory: 30,
    timeoutMs: 120_000,
  },
  {
    name: 'anomaly_detection',
    path: './models/anomaly_detection.mjs',
    fn: 'crucixAnomalyDetection',
    minHistory: 20,
    timeoutMs: 60_000,
  },
  {
    name: 'graph_sage',
    path: './models/graph_sage.mjs',
    fn: 'crucixGraphSAGE',
    minHistory: 20,
    timeoutMs: 60_000,
  },
  {
    name: 'actor_critic',
    path: './models/actor_critic.mjs',
    fn: 'crucixActorCritic',
    minHistory: 20,
    timeoutMs: 90_000,
  },
];

// ═══════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════

/**
 * Защита от повторных падений модуля.
 * После FAILURE_THRESHOLD падений подряд — модуль отключается
 * на COOLDOWN_RUNS запусков.
 */
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

// Глобальный breaker для процесса (переиспользуется между вызовами)
const globalBreaker = new CircuitBreaker(3, 5);

// ═══════════════════════════════════════════════════
// TIMEOUT WRAPPER
// ═══════════════════════════════════════════════════

/**
 * Обёртка с таймаутом вокруг async-функции.
 * Если функция не завершилась за timeoutMs — reject.
 */
function withTimeout(promise, timeoutMs, moduleName) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

// ═══════════════════════════════════════════════════
// ФАЗА S — v6.0 EXTENSIONS
// ═══════════════════════════════════════════════════

/**
 * Запуск одного модуля v6.0 с обработкой ошибок.
 */
async function runV6Module(moduleSpec, history, options) {
  const { name, path, fn, minHistory, timeoutMs } = moduleSpec;

  if (!globalBreaker.canRun(name)) {
    return {
      name,
      ok: false,
      skipped: true,
      reason: 'circuit_open',
    };
  }

  if (!history || history.length < minHistory) {
    return {
      name,
      ok: false,
      skipped: true,
      reason: 'insufficient_history',
      actual: history?.length ?? 0,
      minimumRequired: minHistory,
    };
  }

  const t0 = Date.now();
  try {
    const mod = await import(path);
    const fnImpl = mod[fn];
    if (typeof fnImpl !== 'function') {
      throw new Error(`export ${fn} not found in ${path}`);
    }

    const result = await withTimeout(
      Promise.resolve(fnImpl(history, options[name] || {})),
      timeoutMs,
      name
    );

    globalBreaker.recordSuccess(name);
    return {
      name,
      ok: true,
      elapsedMs: Date.now() - t0,
      result,
    };
  } catch (e) {
    globalBreaker.recordFailure(name);
    return {
      name,
      ok: false,
      error: e.message,
      elapsedMs: Date.now() - t0,
    };
  }
}

/**
 * Фаза S — параллельный запуск всех v6.0 модулей.
 *
 * @param {Array} history — sweep'ы
 * @param {Object} options — { modules: { name: {...} }, disabled: [names] }
 * @returns {Object} — { modules: {...}, summary: {...} }
 */
export async function runV6Phase(history, options = {}) {
  const t0 = Date.now();
  const disabled = new Set(options.disabled || []);

  console.log(`[engine_v6_patch] Фаза S: запуск ${V6_MODULES.length - disabled.size} модулей v6.0`);

  const active = V6_MODULES.filter(m => !disabled.has(m.name));

  const promises = active.map(spec =>
    runV6Module(spec, history, options).catch(e => ({
      name: spec.name,
      ok: false,
      error: `unhandled: ${e.message}`,
    }))
  );

  const results = await Promise.allSettled(promises);

  const modules = {};
  const failures = [];

  for (let i = 0; i < results.length; i++) {
    const name = active[i].name;
    const settled = results[i];

    if (settled.status === 'fulfilled') {
      modules[name] = settled.value;
      if (!settled.value.ok && !settled.value.skipped) {
        failures.push({ module: name, error: settled.value.error });
      }
    } else {
      modules[name] = {
        name,
        ok: false,
        error: settled.reason?.message || 'rejected',
      };
      failures.push({ module: name, error: settled.reason?.message || 'rejected' });
    }
  }

  const okCount = Object.values(modules).filter(m => m.ok).length;
  const skippedCount = Object.values(modules).filter(m => m.skipped).length;
  const errorCount = Object.values(modules).filter(m => !m.ok && !m.skipped).length;

  return {
    phase: 'S_v6_extensions',
    version: PATCH_VERSION,
    elapsedMs: Date.now() - t0,
    totalModules: active.length,
    okCount,
    skippedCount,
    errorCount,
    modules,
    failures,
  };
}

// ═══════════════════════════════════════════════════
// ФАЗА T — CATALOG EXTENSIONS
// ═══════════════════════════════════════════════════

async function runCatalogModule(moduleSpec, history, options) {
  const { name, path, fn, minHistory, timeoutMs } = moduleSpec;

  if (!globalBreaker.canRun(name)) {
    return { name, ok: false, skipped: true, reason: 'circuit_open' };
  }

  if (!history || history.length < minHistory) {
    return {
      name,
      ok: false,
      skipped: true,
      reason: 'insufficient_history',
      actual: history?.length ?? 0,
      minimumRequired: minHistory,
    };
  }

  const t0 = Date.now();
  try {
    const mod = await import(path);
    const fnImpl = mod[fn];
    if (typeof fnImpl !== 'function') {
      throw new Error(`export ${fn} not found in ${path}`);
    }

    const result = await withTimeout(
      Promise.resolve(fnImpl(history, options[name] || {})),
      timeoutMs,
      name
    );

    globalBreaker.recordSuccess(name);
    return {
      name,
      ok: true,
      elapsedMs: Date.now() - t0,
      result,
    };
  } catch (e) {
    globalBreaker.recordFailure(name);
    return {
      name,
      ok: false,
      error: e.message,
      elapsedMs: Date.now() - t0,
    };
  }
}

/**
 * Фаза T — параллельный запуск всех модулей каталога.
 */
export async function runCatalogPhase(history, options = {}) {
  const t0 = Date.now();
  const disabled = new Set(options.disabled || []);

  console.log(`[engine_v6_patch] Фаза T: запуск ${CATALOG_MODULES.length - disabled.size} модулей каталога`);

  const active = CATALOG_MODULES.filter(m => !disabled.has(m.name));

  const promises = active.map(spec =>
    runCatalogModule(spec, history, options).catch(e => ({
      name: spec.name,
      ok: false,
      error: `unhandled: ${e.message}`,
    }))
  );

  const results = await Promise.allSettled(promises);

  const modules = {};
  const failures = [];

  for (let i = 0; i < results.length; i++) {
    const name = active[i].name;
    const settled = results[i];

    if (settled.status === 'fulfilled') {
      modules[name] = settled.value;
      if (!settled.value.ok && !settled.value.skipped) {
        failures.push({ module: name, error: settled.value.error });
      }
    } else {
      modules[name] = {
        name,
        ok: false,
        error: settled.reason?.message || 'rejected',
      };
      failures.push({ module: name, error: settled.reason?.message || 'rejected' });
    }
  }

  const okCount = Object.values(modules).filter(m => m.ok).length;
  const skippedCount = Object.values(modules).filter(m => m.skipped).length;
  const errorCount = Object.values(modules).filter(m => !m.ok && !m.skipped).length;

  return {
    phase: 'T_catalog_extensions',
    version: PATCH_VERSION,
    elapsedMs: Date.now() - t0,
    totalModules: active.length,
    okCount,
    skippedCount,
    errorCount,
    modules,
    failures,
  };
}

// ═══════════════════════════════════════════════════
// ИНТЕГРАЦИЯ В SNAPSHOT
// ═══════════════════════════════════════════════════

/**
 * Извлечение «сигналов» из v6.0 результатов для ensemble.
 *
 * Каждый модуль даёт свой «сигнал» — число от 0 до 1 и текст.
 * Это используется для расширения snapshot.v6_extensions.signals
 * и (опционально) для корректировки финальной вероятности ансамбля.
 */
function extractV6Signals(v6Phase) {
  const signals = [];
  if (!v6Phase || !v6Phase.modules) return signals;

  const m = v6Phase.modules;

  // neural_causal_discovery: количество обнаруженных связей
  if (m.neural_causal_discovery?.ok && m.neural_causal_discovery.result) {
    const r = m.neural_causal_discovery.result;
    signals.push({
      module: 'neural_causal_discovery',
      signal: r.nEdges > 8 ? 'high' : r.nEdges > 4 ? 'medium' : 'low',
      text: `Neural Causal: обнаружено ${r.nEdges} связей, ацикличен=${r.isAcyclic}`,
      value: Math.min(1, r.nEdges / 10),
    });
  }

  // continual_learning: forgetting delta
  if (m.continual_learning?.ok && m.continual_learning.result) {
    const r = m.continual_learning.result;
    signals.push({
      module: 'continual_learning',
      signal: (r.forgettingDelta ?? 0) > 0.1 ? 'high' : 'low',
      text: `Continual: task ${r.taskId}, forgetting delta ${r.forgettingDelta ?? 'N/A'}`,
      value: Math.abs(r.forgettingDelta ?? 0),
    });
  }

  // causal_rl: improvement over random
  if (m.causal_rl?.ok && m.causal_rl.result) {
    const r = m.causal_rl.result;
    const imp = r.evaluation?.improvementPct ?? 0;
    signals.push({
      module: 'causal_rl',
      signal: imp > 20 ? 'high' : imp > 5 ? 'medium' : 'low',
      text: `Causal RL: improvement over random ${imp}%`,
      value: Math.min(1, Math.max(0, imp / 100)),
    });
  }

  // quantum_hypergraph: количество гиперрёбер
  if (m.quantum_hypergraph?.ok && m.quantum_hypergraph.result) {
    const r = m.quantum_hypergraph.result;
    signals.push({
      module: 'quantum_hypergraph',
      signal: r.hypergraph?.nHyperedges > 5 ? 'high' : 'medium',
      text: `Quantum Hypergraph: ${r.hypergraph?.nHyperedges ?? 0} гиперрёбер, MI=${r.hypergraph?.totalMI ?? 0}`,
      value: Math.min(1, (r.hypergraph?.nHyperedges ?? 0) / 10),
    });
  }

  // zk_federated: privacy spent
  if (m.zk_federated?.ok && m.zk_federated.result) {
    const r = m.zk_federated.result;
    signals.push({
      module: 'zk_federated',
      signal: (r.privacy?.privacySpent ?? 0) > 5 ? 'high' : 'low',
      text: `ZK-FL: ${r.nNodes} узлов, loss reduction ${r.training?.lossReduction ?? 0}, privacy spent ${r.privacy?.privacySpent ?? 0}`,
      value: Math.min(1, Math.max(0, (r.training?.lossReduction ?? 0) * 2)),
    });
  }

  return signals;
}

function extractCatalogSignals(catalogPhase) {
  const signals = [];
  if (!catalogPhase || !catalogPhase.modules) return signals;

  const m = catalogPhase.modules;

  // mcmc: hierarchical beta-binomial
  if (m.mcmc?.ok && m.mcmc.result) {
    const r = m.mcmc.result;
    const topRisk = r.hierarchicalBetaBinomial?.topRiskyRegions?.[0];
    signals.push({
      module: 'mcmc',
      signal: 'medium',
      text: `MCMC: топ-риск ${topRisk?.id ?? 'N/A'} (posterior=${topRisk?.posteriorMean ?? 'N/A'}), changePoint=${r.changePoint?.probability ?? 'N/A'}`,
      value: topRisk?.posteriorMean ?? 0,
    });
  }

  // physics_inspired: 4 раздела
  if (m.physics_inspired?.ok && m.physics_inspired.result) {
    const r = m.physics_inspired.result;
    const critRegime = r.soc?.criticality?.regime ?? 'unknown';
    const percRegime = r.percolation?.regime ?? 'unknown';
    const catRegime = r.catastrophe?.regime ?? 'unknown';
    signals.push({
      module: 'physics_inspired',
      signal: catRegime === 'bistable' ? 'high'
        : percRegime === 'supercritical' ? 'high'
        : critRegime === 'critical' ? 'medium' : 'low',
      text: `Physics: SOC=${critRegime}, Percolation=${percRegime}, Catastrophe=${catRegime}`,
      value: catRegime === 'bistable' ? 0.9 : percRegime === 'supercritical' ? 0.8 : 0.3,
    });
  }

  // automl: best model
  if (m.automl?.ok && m.automl.result) {
    const r = m.automl.result;
    signals.push({
      module: 'automl',
      signal: 'medium',
      text: `AutoML: лучшая модель ${r.bestModel}, score ${r.bestScore}`,
      value: Math.min(1, Math.max(0, 1 - (r.bestScore ?? 1))),
    });
  }

  // anomaly_detection: last sweep anomaly
  if (m.anomaly_detection?.ok && m.anomaly_detection.result) {
    const r = m.anomaly_detection.result;
    signals.push({
      module: 'anomaly_detection',
      signal: r.lastSweep?.isAnomaly ? 'high' : 'low',
      text: `Anomaly: last sweep ${r.lastSweep?.isAnomaly ? 'АНОМАЛЕН' : 'нормален'} (${r.lastSweep?.votes}/5), всего ${r.summary?.nAnomalies ?? 0}`,
      value: r.lastSweep?.score ?? 0,
    });
  }

  // graph_sage: node embeddings
  if (m.graph_sage?.ok && m.graph_sage.result) {
    const r = m.graph_sage.result;
    signals.push({
      module: 'graph_sage',
      signal: 'medium',
      text: `GraphSAGE: ${r.nNodes ?? 0} узлов, ${r.nEdges ?? 0} рёбер`,
      value: Math.min(1, (r.nNodes ?? 0) / 100),
    });
  }

  // actor_critic: policy improvement
  if (m.actor_critic?.ok && m.actor_critic.result) {
    const r = m.actor_critic.result;
    const imp = r.improvement ?? 0;
    signals.push({
      module: 'actor_critic',
      signal: imp > 0.2 ? 'high' : 'medium',
      text: `A2C: policy improvement ${imp}`,
      value: Math.min(1, Math.max(0, imp)),
    });
  }

  return signals;
}

/**
 * Применение результатов v6.0 + каталога к snapshot engine.
 *
 * Добавляет:
 *   - snapshot.v6_extensions { phase, elapsedMs, modules, signals }
 *   - snapshot.catalog_extensions { ... }
 *   - snapshot.new_module_signals: [...] (плоский список всех сигналов)
 *
 * @param {Object} snapshot — снапшот от engine
 * @param {Object} v6Phase — результат runV6Phase
 * @param {Object} catalogPhase — результат runCatalogPhase
 * @returns {Object} — мутированный snapshot
 */
export function applyV6ToSnapshot(snapshot, v6Phase, catalogPhase) {
  if (!snapshot) return snapshot;

  const v6Signals = extractV6Signals(v6Phase);
  const catalogSignals = extractCatalogSignals(catalogPhase);

  snapshot.v6_extensions = {
    version: PATCH_VERSION,
    phase: v6Phase?.phase || 'S_v6_extensions',
    elapsedMs: v6Phase?.elapsedMs ?? 0,
    totalModules: v6Phase?.totalModules ?? 0,
    okCount: v6Phase?.okCount ?? 0,
    errorCount: v6Phase?.errorCount ?? 0,
    skippedCount: v6Phase?.skippedCount ?? 0,
    signals: v6Signals,
    moduleResults: v6Phase?.modules ?? {},
    failures: v6Phase?.failures ?? [],
  };

  snapshot.catalog_extensions = {
    version: PATCH_VERSION,
    phase: catalogPhase?.phase || 'T_catalog_extensions',
    elapsedMs: catalogPhase?.elapsedMs ?? 0,
    totalModules: catalogPhase?.totalModules ?? 0,
    okCount: catalogPhase?.okCount ?? 0,
    errorCount: catalogPhase?.errorCount ?? 0,
    skippedCount: catalogPhase?.skippedCount ?? 0,
    signals: catalogSignals,
    moduleResults: catalogPhase?.modules ?? {},
    failures: catalogPhase?.failures ?? [],
  };

  snapshot.new_module_signals = [
    ...v6Signals.map(s => ({ ...s, source: 'v6' })),
    ...catalogSignals.map(s => ({ ...s, source: 'catalog' })),
  ];

  // Расширяем explanation
  if (!snapshot.explanation) snapshot.explanation = { reasoning_steps: [], summary: '' };
  if (!snapshot.explanation.reasoning_steps) snapshot.explanation.reasoning_steps = [];

  for (const sig of snapshot.new_module_signals) {
    snapshot.explanation.reasoning_steps.push({
      module: sig.module,
      signal: sig.signal,
      text: sig.text,
      weight: Math.round(sig.value * 100) / 100,
    });
  }

  // Обновляем summary
  const v6Ok = v6Phase?.okCount ?? 0;
  const catOk = catalogPhase?.okCount ?? 0;
  const totalOk = v6Ok + catOk;
  const totalNew = (v6Phase?.totalModules ?? 0) + (catalogPhase?.totalModules ?? 0);
  snapshot.explanation.summary += ` Фазы S+T: ${totalOk}/${totalNew} новых модулей завершены успешно.`;

  return snapshot;
}

// ═══════════════════════════════════════════════════
// ПОЛНЫЙ ЗАПУСК (для тех, кто хочет одной функцией)
// ═══════════════════════════════════════════════════

/**
 * Запуск обеих фаз (S + T) параллельно.
 *
 * @param {Array} history — sweep'ы
 * @param {Object} options — { v6: {...}, catalog: {...} }
 * @returns {Object} — { v6, catalog, elapsedMs }
 */
export async function runNewPhases(history, options = {}) {
  const t0 = Date.now();

  const [v6, catalog] = await Promise.allSettled([
    runV6Phase(history, options.v6 || {}),
    runCatalogPhase(history, options.catalog || {}),
  ]);

  return {
    v6: v6.status === 'fulfilled' ? v6.value : { ok: false, error: v6.reason?.message },
    catalog: catalog.status === 'fulfilled' ? catalog.value : { ok: false, error: catalog.reason?.message },
    elapsedMs: Date.now() - t0,
  };
}

// ═══════════════════════════════════════════════════
// HEALTHCHECK
// ═══════════════════════════════════════════════════

/**
 * Проверка доступности всех модулей (без выполнения).
 * Возвращает список модулей и их статус.
 */
export function healthcheck() {
  const check = (spec) => ({
    name: spec.name,
    path: spec.path,
    exists: existsSync(join(__dirname, spec.path)),
    minHistory: spec.minHistory,
    timeoutMs: spec.timeoutMs,
    circuitStatus: globalBreaker.getStatus(spec.name),
  });

  return {
    version: PATCH_VERSION,
    v6Modules: V6_MODULES.map(check),
    catalogModules: CATALOG_MODULES.map(check),
  };
}

// ═══════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════

export {
  V6_MODULES,
  CATALOG_MODULES,
  CircuitBreaker,
  PATCH_VERSION,
};

// ═══════════════════════════════════════════════════
// РУКОВОДСТВО ПО ПОДКЛЮЧЕНИЮ К engine.mjs
// ═══════════════════════════════════════════════════
//
// В engine.mjs добавить:
//
// 1) В начале файла:
//
//    import { runV6Phase, runCatalogPhase, applyV6ToSnapshot }
//      from './engine_v6_patch.mjs';
//
// 2) Внутри класса ForecastEngine в методе run(),
//    ПОСЛЕ того как все фазы A-R завершены и snapshot собран,
//    ПЕРЕД публикацией:
//
//    // Фазы S и T — v6.0 + каталог
//    try {
//      const [v6Phase, catalogPhase] = await Promise.all([
//        runV6Phase(history, { disabled: [] }),
//        runCatalogPhase(history, { disabled: [] }),
//      ]);
//      applyV6ToSnapshot(snapshot, v6Phase, catalogPhase);
//    } catch (e) {
//      failures.push({ module: 'v6_v7_patch', error: e.message });
//    }
//
// 3) Верифицировать что snapshot.v6_extensions и snapshot.catalog_extensions
//    появились в JSON. Фронтенд может их отрисовать.
//
// ВАЖНО:
// - Модули можно отключать через options.disabled = ['mcmc', ...]
// - Каждый модуль имеет таймаут (60-120 сек)
// - Circuit breaker: 3 падения подряд → 5 запусков пропуска
// - Параллельный запуск через Promise.allSettled
