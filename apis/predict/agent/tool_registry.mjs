// apis/predict/agent/tool_registry.mjs
// Tool Registry — единый реестр всех доступных модулей для LLM-агента.
//
// Назначение:
//   Описывает каждый модуль так, чтобы LLM мог понять:
//     - что он делает,
//     - какие входы принимает,
//     - что возвращает,
//     - когда вызывать.
//
// Registry — единственный whitelist. LLM не может вызвать модуль, которого
// нет в реестре. Это safety-границa между LLM и файловой системой.
//
// Каждый tool:
//   {
//     name: string,              уникальное имя (совпадает с ключом)
//     description: string,       что делает
//     argsSchema: {arg: type},   схема аргументов
//     defaults: {...},           значения по умолчанию
//     minHistory: number,        минимальная история
//     callFn: async (history, args) => result,  как вызывать
//     category: string,          v6 | catalog | v7 | base
//     returns: string,           краткое описание результата
//     when: string,              когда использовать
//   }
//
// Версия: 8.0.0

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRED = join(__dirname, '..');
const RUNS = join(__dirname, '..', '..', '..', 'runs');

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch { return fallback; }
}

/**
 * Загружает историю sweep'ов из runs/history.json.
 * Если нет — возвращает пустой массив.
 */
function loadHistory() {
  const hist = loadJSON(join(RUNS, 'history.json'), null);
  if (Array.isArray(hist)) return hist;
  if (hist && Array.isArray(hist.sweeps)) return hist.sweeps;
  return [];
}

// ═══════════════════════════════════════════════════
// ОПИСАНИЯ TOOLS
// ═══════════════════════════════════════════════════

/**
 * Все tools. Ключ — имя tool, значение — описание.
 * callFn загружается лениво (через dynamic import) при первом вызове.
 */
const TOOL_DEFINITIONS = {

  // ═══════════════════════════════════════════════════
  // BASE — 45 базовых модулей через engine
  // ═══════════════════════════════════════════════════

  engine_full: {
    description: 'Запустить полный конвейер engine.mjs (16 фаз A–U). Возвращает полный snapshot со всеми модулями.',
    argsSchema: { profile: 'string' },
    defaults: { profile: 'balanced' },
    minHistory: 30,
    category: 'base',
    returns: 'snapshot: { events, v6_extensions, catalog_extensions, v7_extensions, explanation, topRisks }',
    when: 'Общий прогноз по всем событиям. Самый тяжёлый вызов (~30-60 секунд).',
    path: './engine.mjs',
    fn: 'runForecastPipeline',
  },

  regime_shift: {
    description: 'Детекция смены режима в индикаторах (экономика, геополитика).',
    argsSchema: {},
    defaults: {},
    minHistory: 20,
    category: 'base',
    returns: '{ regimeShiftDetected, severity, indicators }',
    when: 'Оператор спрашивает про структурные изменения, "новый режим".',
    path: './regime_shift.mjs',
    fn: 'crucixRegimeShiftDetection',
  },

  explainability: {
    description: 'Объяснимость прогноза через permutation importance и counterfactuals.',
    argsSchema: { eventId: 'string' },
    defaults: {},
    minHistory: 10,
    category: 'base',
    returns: '{ permutation, counterfactuals, reasoning }',
    when: 'Оператор спрашивает "почему такой прогноз".',
    path: './explainability.mjs',
    fn: 'crucixExplainableForecast',
  },

  // ═══════════════════════════════════════════════════
  // V6.0 — 5 научных модулей
  // ═══════════════════════════════════════════════════

  neural_causal_discovery: {
    description: 'Поиск причинного DAG через NO TEARS (непрерывная оптимизация ацикличности).',
    argsSchema: { iterations: 'number' },
    defaults: { iterations: 80 },
    minHistory: 20,
    category: 'v6',
    returns: '{ discoveredEdges, isAcyclic, nEdges, density }',
    when: 'Нужна структура причинности. "Какие переменные влияют на tension".',
    path: './v6/neural_causal_discovery.mjs',
    fn: 'crucixNeuralCausalDiscovery',
  },

  continual_learning: {
    description: 'Дообучение модели без catastrophic forgetting (EWC + Synaptic Intelligence).',
    argsSchema: { method: 'string', epochs: 'number' },
    defaults: { method: 'ewc', epochs: 30 },
    minHistory: 30,
    category: 'v6',
    returns: '{ method, lossBefore, lossAfter, forgettingDelta, prediction }',
    when: 'Оператор спрашивает про адаптацию модели к новым данным.',
    path: './v6/continual_learning.mjs',
    fn: 'crucixContinualLearning',
  },

  causal_rl: {
    description: 'Q-learning с причинными constraints. Оптимальные действия без correlation-bias.',
    argsSchema: { episodes: 'number', method: 'string' },
    defaults: { episodes: 150, method: 'q_learning' },
    minHistory: 20,
    category: 'v6',
    returns: '{ training, evaluation, causalInsights, recommendedAction }',
    when: 'Оператор спрашивает "какое действие оптимально" с причинным анализом.',
    path: './v6/causal_rl.mjs',
    fn: 'crucixCausalRL',
  },

  quantum_hypergraph: {
    description: 'Поиск MAP-гиперграфа (N-арные связи) через квантовый отжиг.',
    argsSchema: { nSteps: 'number' },
    defaults: { nSteps: 1000 },
    minHistory: 30,
    category: 'v6',
    returns: '{ hypergraph, topEdges, annealing }',
    when: 'Нужны N-арные связи (A+B+C→D), а не пары.',
    path: './v6/quantum_hypergraph.mjs',
    fn: 'crucixQuantumHypergraph',
  },

  zk_federated: {
    description: 'Zero-Knowledge Federated Learning для распределённого обучения с privacy.',
    argsSchema: { nNodes: 'number', rounds: 'number' },
    defaults: { nNodes: 4, rounds: 5 },
    minHistory: 30,
    category: 'v6',
    returns: '{ privacy, training, security }',
    when: 'Развёртывание на нескольких серверах, privacy-critical.',
    path: './v6/zk_federated.mjs',
    fn: 'crucixZKFederated',
  },

  // ═══════════════════════════════════════════════════
  // CATALOG — 6 модулей
  // ═══════════════════════════════════════════════════

  mcmc: {
    description: 'Байесовский вывод (Metropolis-Hastings, HMC, Hierarchical Beta-Binomial).',
    argsSchema: { poissonIterations: 'number', changePointIterations: 'number' },
    defaults: { poissonIterations: 500, changePointIterations: 500 },
    minHistory: 20,
    category: 'catalog',
    returns: '{ hierarchicalBetaBinomial, poissonRegression, logisticRegression, changePoint }',
    when: 'Нужны распределения параметров, а не точечные оценки.',
    path: './models/mcmc.mjs',
    fn: 'crucixMCMC',
  },

  physics_inspired: {
    description: 'SOC (Bak-Tang-Wiesenfeld) + Percolation + Catastrophe Theory + Chaos.',
    argsSchema: {},
    defaults: {},
    minHistory: 20,
    category: 'catalog',
    returns: '{ soc, percolation, catastrophe, chaos }',
    when: 'Определение критичности, бистабильности, хаоса.',
    path: './models/physics_inspired.mjs',
    fn: 'crucixPhysicsInspired',
  },

  automl: {
    description: 'AutoML + Bayesian Optimization для выбора лучшей модели и гиперпараметров.',
    argsSchema: {},
    defaults: {},
    minHistory: 30,
    category: 'catalog',
    returns: '{ models, bestModel, bestScore, leaderboard }',
    when: 'Автоматический подбор модели (linear vs mlp).',
    path: './automl.mjs',
    fn: 'crucixAutoML',
  },

  anomaly_detection: {
    description: 'Isolation Forest + LOF + Mahalanobis + One-Class SVM + DBSCAN ансамбль.',
    argsSchema: { contamination: 'number' },
    defaults: { contamination: 0.05 },
    minHistory: 20,
    category: 'catalog',
    returns: '{ summary, lastSweep, topAnomalies, explanation }',
    when: 'Поиск аномальных sweep\'ов, объяснение отклонений.',
    path: './anomaly_detection.mjs',
    fn: 'crucixAnomalyDetection',
  },

  graph_sage: {
    description: 'GraphSAGE — индуктивный GNN для графа сущностей.',
    argsSchema: {},
    defaults: {},
    minHistory: 20,
    category: 'catalog',
    returns: '{ embeddings, nNodes, nEdges }',
    when: 'Работа с графом: страны, организации, события.',
    path: './models/graph_sage.mjs',
    fn: 'crucixGraphSAGE',
  },

  actor_critic: {
    description: 'A2C (Advantage Actor-Critic) с GAE для политики алертов.',
    argsSchema: { episodes: 'number' },
    defaults: { episodes: 100 },
    minHistory: 20,
    category: 'catalog',
    returns: '{ training, policy, improvement }',
    when: 'Оптимизация политики алертов.',
    path: './models/actor_critic.mjs',
    fn: 'crucixActorCritic',
  },

  // ═══════════════════════════════════════════════════
  // V7.0 — 5 модулей Simulation Engine
  // ═══════════════════════════════════════════════════

  world_model: {
    description: 'World Models (Ha & Schmidhuber): VAE + MDN-RNN + Controller. Воображение будущего.',
    argsSchema: { vaeEpochs: 'number', rnnEpochs: 'number', latentDim: 'number', horizon: 'number' },
    defaults: { vaeEpochs: 3, rnnEpochs: 2, latentDim: 8, horizon: 12 },
    minHistory: 30,
    category: 'v7',
    returns: '{ training, quality, imagination, direction }',
    when: 'Симуляция будущего без реальных данных.',
    path: './v7/world_model.mjs',
    fn: 'crucixWorldModel',
  },

  neural_ode: {
    description: 'Neural ODE (Chen 2018): непрерывная динамика dz/dt = f(z, t). RK4 + counterfactual rewind.',
    argsSchema: { epochs: 'number', horizon: 'number', hiddenDim: 'number' },
    defaults: { epochs: 3, horizon: 12, hiddenDim: 16 },
    minHistory: 20,
    category: 'v7',
    returns: '{ training, forecast, counterfactual, rewind }',
    when: 'Плавная динамика, откат назад, "что было раньше".',
    path: './v7/neural_ode.mjs',
    fn: 'crucixNeuralODE',
  },

  dreamer: {
    description: 'Dreamer — actor-critic обучение в latent space через imagination.',
    argsSchema: { trainSteps: 'number', horizon: 'number', latentDim: 'number' },
    defaults: { trainSteps: 15, horizon: 8, latentDim: 8 },
    minHistory: 30,
    category: 'v7',
    returns: '{ evaluation, bestAction, finalRollout, training }',
    when: 'Оптимальная политика действий в latent space.',
    path: './v7/dreamer.mjs',
    fn: 'crucixDreamer',
  },

  continuous_causal: {
    description: 'Continuous-Time SCM: Neural ODE + do-operator + ATE. Counterfactual в непрерывном времени.',
    argsSchema: { epochs: 'number', horizon: 'number', interventionVar: 'string', treatmentValue: 'number' },
    defaults: { epochs: 3, horizon: 10, interventionVar: 'tension', treatmentValue: 0.8 },
    minHistory: 20,
    category: 'v7',
    returns: '{ dag, training, forecast, counterfactual, ate }',
    when: 'Запросы "что если X=Y", причинный анализ с do-operator.',
    path: './v7/continuous_causal.mjs',
    fn: 'crucixContinuousCausal',
  },

  simulation_engine: {
    description: 'Simulation Engine v7.0 — оркестратор 4 модулей v7. Синтез + confidence + answers.',
    argsSchema: { horizon: 'number' },
    defaults: { horizon: 12 },
    minHistory: 30,
    category: 'v7',
    returns: '{ moduleStatus, synthesis, answers, interpretation }',
    when: 'Полная симуляция с ответами на типовые вопросы оператора.',
    path: './v7/simulation_engine.mjs',
    fn: 'crucixSimulationEngine',
  },
};

// ═══════════════════════════════════════════════════
// TOOL REGISTRY CLASS
// ═══════════════════════════════════════════════════

class ToolRegistry {
  constructor(config = {}) {
    this.tools = new Map();
    this.cache = new Map();
    this.auditPath = config.auditPath || join(RUNS, 'agent', 'tool_calls.json');
    this.audit = [];

    for (const [name, def] of Object.entries(TOOL_DEFINITIONS)) {
      this.tools.set(name, { name, ...def });
    }
  }

  has(name) {
    return this.tools.has(name);
  }

  get(name) {
    return this.tools.get(name) || null;
  }

  /**
   * Список всех tools в формате для LLM-планировщика.
   */
  listAll() {
    return [...this.tools.values()].map(t => ({
      name: t.name,
      description: t.description,
      argsSchema: t.argsSchema,
      category: t.category,
      when: t.when,
      minHistory: t.minHistory,
    }));
  }

  /**
   * Список по категории.
   */
  listByCategory(category) {
    return [...this.tools.values()]
      .filter(t => t.category === category)
      .map(t => ({
        name: t.name,
        description: t.description,
        argsSchema: t.argsSchema,
      }));
  }

  /**
   * Санитизация аргументов: оставить только те, что в argsSchema,
   * привести к правильным типам, применить defaults.
   */
  sanitizeArgs(name, args) {
    const tool = this.get(name);
    if (!tool) return {};
    const out = { ...tool.defaults };
    for (const [k, v] of Object.entries(args || {})) {
      if (!(k in tool.argsSchema)) continue;
      const expected = tool.argsSchema[k];
      if (expected === 'number') {
        const n = Number(v);
        if (Number.isFinite(n)) out[k] = n;
      } else if (expected === 'string') {
        out[k] = String(v).slice(0, 200);
      } else if (expected === 'boolean') {
        out[k] = Boolean(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  /**
   * Ленивая загрузка модуля через dynamic import.
   */
  async loadModule(tool) {
    if (this.cache.has(tool.name)) {
      return this.cache.get(tool.name);
    }
    const modPath = join(PRED, tool.path);
    const mod = await import(modPath);
    const fn = mod[tool.fn];
    if (typeof fn !== 'function') {
      throw new Error(`Export ${tool.fn} не найден в ${tool.path}`);
    }
    const cacheEntry = { mod, fn };
    this.cache.set(tool.name, cacheEntry);
    return cacheEntry;
  }

  /**
   * Вызов tool.
   *
   * @param {string} name — имя tool
   * @param {Object} rawArgs — аргументы от LLM
   * @param {Object} options — { history, timeoutMs, snapshot }
   * @returns {Object} — { ok, tool, args, result, elapsedMs, error }
   */
  async call(name, rawArgs = {}, options = {}) {
    const t0 = Date.now();

    if (!this.has(name)) {
      return {
        ok: false,
        tool: name,
        error: 'unknown_tool',
        elapsedMs: Date.now() - t0,
      };
    }

    const tool = this.get(name);
    const args = this.sanitizeArgs(name, rawArgs);
    const history = options.history || loadHistory();

    // Проверка minHistory
    if (history.length < tool.minHistory) {
      return {
        ok: false,
        tool: name,
        args,
        error: 'insufficient_history',
        actual: history.length,
        minimumRequired: tool.minHistory,
        elapsedMs: Date.now() - t0,
      };
    }

    this.audit.push({
      ts: new Date().toISOString(),
      event: 'call_start',
      tool: name,
      args,
    });

    try {
      const { fn } = await this.loadModule(tool);
      const timeoutMs = options.timeoutMs || 180_000;

      const result = await Promise.race([
        Promise.resolve(fn(history, args)),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs)
        ),
      ]);

      const elapsed = Date.now() - t0;
      this.audit.push({
        ts: new Date().toISOString(),
        event: 'call_success',
        tool: name,
        elapsedMs: elapsed,
      });

      return {
        ok: true,
        tool: name,
        args,
        result,
        elapsedMs: elapsed,
      };
    } catch (e) {
      const elapsed = Date.now() - t0;
      this.audit.push({
        ts: new Date().toISOString(),
        event: 'call_error',
        tool: name,
        error: e.message,
        elapsedMs: elapsed,
      });

      return {
        ok: false,
        tool: name,
        args,
        error: e.message,
        elapsedMs: elapsed,
      };
    }
  }

  /**
   * Сохранить audit-лог.
   */
  flushAudit() {
    ensureDir(dirname(this.auditPath));
    writeFileSync(this.auditPath, JSON.stringify(this.audit, null, 2));
    return this.auditPath;
  }

  /**
   * Краткая статистика реестра.
   */
  stats() {
    const byCategory = {};
    for (const tool of this.tools.values()) {
      byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
    }
    return {
      total: this.tools.size,
      byCategory,
      cached: this.cache.size,
      auditSize: this.audit.length,
    };
  }
}

// ═══════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════

export {
  ToolRegistry,
  TOOL_DEFINITIONS,
  loadHistory,
};

// CLI-helper для healthcheck
if (import.meta.url === `file://${process.argv[1]}`) {
  const reg = new ToolRegistry();
  const stats = reg.stats();
  console.log('=== TOOL REGISTRY ===');
  console.log('Total tools:', stats.total);
  console.log('By category:', JSON.stringify(stats.byCategory, null, 2));
  console.log('');
  console.log('=== TOOLS ===');
  for (const t of reg.listAll()) {
    console.log(`  [${t.category}] ${t.name} (minHistory=${t.minHistory})`);
    console.log(`      ${t.description.slice(0, 100)}...`);
  }
}
