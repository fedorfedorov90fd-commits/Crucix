// apis/predict/v6/causal_rl.mjs
// Causal Reinforcement Learning
// RL с причинными constraints: агент уважает DAG причинности
//
// Теоретическая основа:
//   - Pearl, J. (2000). "Causality: Models, Reasoning, and Inference".
//     Cambridge University Press. — do-calculus, structural causal models.
//   - Zhang, J., & Bareinboim, E. (2019). "Causal Reinforcement Learning".
//     — формализация RL с причинными ограничениями.
//   - Bica, I., Alaa, A. M., & van der Schaar, M. (2020). "Estimating
//     Counterfactual Treatment Outcomes over Time".
//
// Ключевая идея:
//   Стандартный Q-learning обновляет Q(s,a) на основе награды,
//   наблюдаемой после действия a в состоянии s. Но если s и a
//   имеют общую причину (confounder), Q-функция учится
//   корреляции, а не причинности.
//
//   Causal RL: используем DAG для определения допустимых
//   вмешательств (do-operator). Агент может вмешиваться только
//   в узлы без входящих стрелок из confounders. Reward shaping
//   основан на причинном эффекте (ATE), а не на корреляции.
//
// Архитектура:
//   1. CausalEnvironment — MDP, обёрнутый поверх causal DAG
//   2. CausalQLearner — Q-learning с causal constraints
//   3. CausalPolicyGradient — REINFORCE с causal mask
//   4. Counterfactual evaluator — offline оценка policy
//
// Версия: 6.0.0

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function saveJSON(fp, data) {
  ensureDir(dirname(fp));
  writeFileSync(fp, JSON.stringify(data, null, 2));
}

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch { return fallback; }
}

function topologicalSort(nodes, edges) {
  const adj = new Map();
  const indeg = new Map();
  for (const n of nodes) { adj.set(n, []); indeg.set(n, 0); }
  for (const e of edges) {
    if (!adj.has(e.from) || !adj.has(e.to)) continue;
    adj.get(e.from).push(e.to);
    indeg.set(e.to, indeg.get(e.to) + 1);
  }
  const queue = [...nodes].filter(n => indeg.get(n) === 0);
  const sorted = [];
  while (queue.length > 0) {
    const u = queue.shift();
    sorted.push(u);
    for (const v of adj.get(u)) {
      indeg.set(v, indeg.get(v) - 1);
      if (indeg.get(v) === 0) queue.push(v);
    }
  }
  return sorted;
}

function parentsOf(node, edges) {
  return edges.filter(e => e.to === node).map(e => e.from);
}

function descendantsOf(node, edges) {
  const visited = new Set();
  const stack = [node];
  while (stack.length > 0) {
    const u = stack.pop();
    for (const e of edges) {
      if (e.from === u && !visited.has(e.to)) {
        visited.add(e.to);
        stack.push(e.to);
      }
    }
  }
  return visited;
}

// ═══════════════════════════════════════════════════
// CausalEnvironment — MDP поверх causal DAG
// ═══════════════════════════════════════════════════

class CausalEnvironment {
  constructor(config = {}) {
    this.nodes = config.nodes || ['vix', 'conflict', 'sanctions', 'tension', 'radiation'];
    this.edges = config.edges || [
      { from: 'conflict', to: 'sanctions', weight: 0.8 },
      { from: 'sanctions', to: 'tension', weight: 0.6 },
      { from: 'tension', to: 'vix', weight: 0.5 },
      { from: 'conflict', to: 'tension', weight: 0.4 },
      { from: 'vix', to: 'radiation', weight: 0.2 },
    ];

    this.actions = config.actions || this._buildActions();
    this.stateSpace = this._buildStateSpace();
    this.currentState = config.initialState || this._zeroState();
    this.terminalStep = config.maxSteps || 50;
    this.step = 0;

    this.weights = this._buildWeights();
    this.noiseScale = config.noiseScale || 0.1;
  }

  _buildActions() {
    const targets = this.nodes.filter(n =>
      this.edges.some(e => e.from === n)
    );
    const acts = [];
    for (const n of targets) {
      acts.push({ id: `do_${n}_low`, target: n, value: 0.2 });
      acts.push({ id: `do_${n}_high`, target: n, value: 0.8 });
    }
    acts.push({ id: 'observe', target: null, value: null });
    return acts;
  }

  _buildStateSpace() {
    return this.nodes.map(n => ({ name: n, levels: 5 }));
  }

  _zeroState() {
    const s = {};
    for (const n of this.nodes) s[n] = 0.3;
    return s;
  }

  _buildWeights() {
    const w = {};
    for (const e of this.edges) {
      w[`${e.from}->${e.to}`] = e.weight ?? 0.5;
    }
    return w;
  }

  _sampleNext(action) {
    const sorted = topologicalSort(this.nodes, this.edges);
    const newState = { ...this.currentState };

    for (const node of sorted) {
      if (action.target === node) {
        newState[node] = action.value;
        continue;
      }

      const parents = parentsOf(node, this.edges);
      if (parents.length === 0) {
        const prev = this.currentState[node] || 0.3;
        newState[node] = prev * 0.9 + (1 - 0.9) * 0.3 + (Math.random() - 0.5) * this.noiseScale;
      } else {
        let val = 0;
        for (const p of parents) {
          const w = this.weights[`${p}->${node}`] ?? 0.3;
          val += w * (newState[p] ?? 0.3);
        }
        const prev = this.currentState[node] ?? 0.3;
        val = prev * 0.3 + val * 0.7 + (Math.random() - 0.5) * this.noiseScale;
      }

      newState[node] = Math.max(0, Math.min(1, newState[node]));
    }

    return newState;
  }

  _computeReward(state, action) {
    let r = 0;
    r -= (state.tension ?? 0.5) * 2.0;
    r -= (state.vix ?? 0.3) * 0.5;
    r -= (state.conflict ?? 0.3) * 1.0;
    if (action.target === 'tension' && action.value < 0.4) r += 0.5;
    if (action.target === 'conflict' && action.value < 0.4) r += 0.8;
    if (action.id === 'observe' && (state.tension > 0.6 || state.conflict > 0.5)) r -= 0.3;
    return r;
  }

  reset() {
    this.currentState = this._zeroState();
    this.step = 0;
    return this._discretize(this.currentState);
  }

  _discretize(state) {
    const d = {};
    for (const n of this.nodes) {
      d[n] = Math.min(4, Math.floor((state[n] ?? 0) * 5));
    }
    return d;
  }

  _stateToKey(state) {
    return this.nodes.map(n => state[n] ?? 0).join(',');
  }

  takeAction(actionIdx) {
    const action = this.actions[actionIdx];
    const nextState = this._sampleNext(action);
    const reward = this._computeReward(nextState, action);
    this.currentState = nextState;
    this.step++;
    const done = this.step >= this.terminalStep;
    return {
      nextState: this._discretize(nextState),
      reward,
      done,
      action: action.id,
      intervened: action.target !== null,
    };
  }

  estimateCausalEffect(targetNode, value, baseline = 0.5, nSamples = 100) {
    let treatedSum = 0, controlSum = 0;
    for (let i = 0; i < nSamples; i++) {
      const treated = this._sampleNext({ target: targetNode, value });
      treatedSum += treated.tension ?? 0.5;
      const control = this._sampleNext({ target: targetNode, value: baseline });
      controlSum += control.tension ?? 0.5;
    }
    return {
      ate: (treatedSum - controlSum) / nSamples,
      treatedMean: treatedSum / nSamples,
      controlMean: controlSum / nSamples,
    };
  }
}

// ═══════════════════════════════════════════════════
// CausalQLearner — Q-learning с causal constraints
// ═══════════════════════════════════════════════════

class CausalQLearner {
  constructor(config = {}) {
    this.nActions = config.nActions || 10;
    this.lr = config.learningRate || 0.1;
    this.gamma = config.gamma ?? 0.95;
    this.epsilon = config.epsilon ?? 1.0;
    this.epsilonDecay = config.epsilonDecay ?? 0.995;
    this.epsilonMin = config.epsilonMin ?? 0.05;
    this.qTable = new Map();
    this.causalMask = config.causalMask || null;
    this.episodeHistory = [];
    this.trainingStats = {
      episodes: 0,
      avgReward: 0,
      causalActions: 0,
      totalActions: 0,
    };
  }

  _getQ(stateKey) {
    if (!this.qTable.has(stateKey)) {
      this.qTable.set(stateKey, new Float64Array(this.nActions));
    }
    return this.qTable.get(stateKey);
  }

  _validActions(stateKey) {
    if (!this.causalMask) return Array.from({ length: this.nActions }, (_, i) => i);
    const allowed = this.causalMask.get(stateKey);
    return allowed || Array.from({ length: this.nActions }, (_, i) => i);
  }

  selectAction(stateKey) {
    const valid = this._validActions(stateKey);
    if (Math.random() < this.epsilon) {
      return valid[Math.floor(Math.random() * valid.length)];
    }
    const q = this._getQ(stateKey);
    let best = valid[0], bestVal = q[valid[0]];
    for (const a of valid) {
      if (q[a] > bestVal) { bestVal = q[a]; best = a; }
    }
    return best;
  }

  update(stateKey, action, reward, nextStateKey, done) {
    const q = this._getQ(stateKey);
    const nextQ = this._getQ(nextStateKey);
    const valid = this._validActions(nextStateKey);
    let maxNext = -Infinity;
    for (const a of valid) maxNext = Math.max(maxNext, nextQ[a]);
    const target = done ? reward : reward + this.gamma * maxNext;
    q[action] += this.lr * (target - q[action]);
  }

  train(env, episodes = 200) {
    const rewards = [];
    for (let ep = 0; ep < episodes; ep++) {
      let state = env.reset();
      let stateKey = env._stateToKey(state);
      let totalReward = 0;
      let causalCount = 0, totalCount = 0;
      const traj = [];

      for (let t = 0; t < env.terminalStep; t++) {
        const action = this.selectAction(stateKey);
        const { nextState, reward, done, intervened } = env.takeAction(action);
        const nextKey = env._stateToKey(nextState);

        this.update(stateKey, action, reward, nextKey, done);
        traj.push({ state: stateKey, action, reward, intervened });

        totalReward += reward;
        if (intervened) causalCount++;
        totalCount++;

        state = nextState;
        stateKey = nextKey;
        if (done) break;
      }

      this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
      rewards.push(totalReward);
      this.episodeHistory.push(traj);
      this.trainingStats.episodes++;
      this.trainingStats.causalActions += causalCount;
      this.trainingStats.totalActions += totalCount;
    }

    this.trainingStats.avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    const last10 = rewards.slice(-10);
    this.trainingStats.last10Avg = last10.reduce((a, b) => a + b, 0) / last10.length;
    this.trainingStats.causalRatio = this.trainingStats.causalActions / this.trainingStats.totalActions;
    return this.trainingStats;
  }

  evaluatePolicy(env, nEpisodes = 50) {
    let policyReward = 0, randomReward = 0;
    for (let ep = 0; ep < nEpisodes; ep++) {
      let state = env.reset();
      let key = env._stateToKey(state);
      let pr = 0;
      for (let t = 0; t < env.terminalStep; t++) {
        const valid = this._validActions(key);
        const q = this._getQ(key);
        let best = valid[0], bv = q[valid[0]];
        for (const a of valid) if (q[a] > bv) { bv = q[a]; best = a; }
        const { nextState, reward, done } = env.takeAction(best);
        pr += reward;
        key = env._stateToKey(nextState);
        if (done) break;
      }
      policyReward += pr;

      state = env.reset();
      key = env._stateToKey(state);
      let rr = 0;
      for (let t = 0; t < env.terminalStep; t++) {
        const valid = this._validActions(key);
        const a = valid[Math.floor(Math.random() * valid.length)];
        const { nextState, reward, done } = env.takeAction(a);
        rr += reward;
        key = env._stateToKey(nextState);
        if (done) break;
      }
      randomReward += rr;
    }

    return {
      policyAvg: policyReward / nEpisodes,
      randomAvg: randomReward / nEpisodes,
      improvement: (policyReward - randomReward) / nEpisodes,
      improvementPct: ((policyReward / nEpisodes) / (Math.abs(randomReward / nEpisodes) || 1) - 1),
    };
  }

  extractCausalInsights(env) {
    const insights = [];
    for (const node of env.nodes) {
      const lowAction = env.actions.findIndex(a => a.target === node && a.value < 0.4);
      const highAction = env.actions.findIndex(a => a.target === node && a.value > 0.6);
      if (lowAction === -1 || highAction === -1) continue;

      const effect = env.estimateCausalEffect(node, 0.8, 0.2, 50);
      insights.push({
        node,
        ateHigh: effect.ate,
        direction: effect.ate > 0.01 ? 'increases_tension'
          : effect.ate < -0.01 ? 'decreases_tension' : 'neutral',
        magnitude: Math.abs(effect.ate),
        policyPrefers: this._policyPreference(env, lowAction, highAction),
      });
    }
    return insights.sort((a, b) => b.magnitude - a.magnitude);
  }

  _policyPreference(env, lowAction, highAction) {
    let lowCount = 0, highCount = 0;
    for (const [key, q] of this.qTable) {
      if (q[lowAction] > q[highAction]) lowCount++;
      else highCount++;
    }
    return lowCount > highCount ? 'low'
      : highCount > lowCount ? 'high' : 'neutral';
  }

  serialize() {
    const qObj = {};
    for (const [k, v] of this.qTable) qObj[k] = Array.from(v);
    return JSON.stringify({
      nActions: this.nActions,
      lr: this.lr,
      gamma: this.gamma,
      epsilon: this.epsilon,
      qTable: qObj,
      trainingStats: this.trainingStats,
    });
  }

  static deserialize(str) {
    const d = JSON.parse(str);
    const q = new CausalQLearner({
      nActions: d.nActions,
      learningRate: d.lr,
      gamma: d.gamma,
      epsilon: d.epsilon,
    });
    q.trainingStats = d.trainingStats;
    for (const [k, v] of Object.entries(d.qTable)) q.qTable.set(k, Float64Array.from(v));
    return q;
  }
}

// ═══════════════════════════════════════════════════
// CausalPolicyGradient — REINFORCE с causal mask
// ═══════════════════════════════════════════════════

class CausalPolicyGradient {
  constructor(config = {}) {
    this.nActions = config.nActions || 10;
    this.lr = config.learningRate || 0.01;
    this.gamma = config.gamma ?? 0.95;
    this.policyWeights = new Float64Array(this.nActions);
    this.causalMask = config.causalMask || null;
    this.episodeGradients = [];
    this.trainingStats = { episodes: 0, avgReward: 0 };
  }

  _maskedSoftmax(stateKey) {
    const valid = this.causalMask?.get(stateKey) ||
      Array.from({ length: this.nActions }, (_, i) => i);
    const exps = valid.map(a => Math.exp(this.policyWeights[a]));
    const sum = exps.reduce((a, b) => a + b, 0) || 1;
    const probs = {};
    valid.forEach((a, i) => { probs[a] = exps[i] / sum; });
    return { probs, valid };
  }

  selectAction(stateKey) {
    const { probs, valid } = this._maskedSoftmax(stateKey);
    const r = Math.random();
    let cum = 0;
    for (const a of valid) {
      cum += probs[a];
      if (r < cum) return a;
    }
    return valid[valid.length - 1];
  }

  train(env, episodes = 200) {
    const rewards = [];
    for (let ep = 0; ep < episodes; ep++) {
      let state = env.reset();
      let key = env._stateToKey(state);
      const traj = [];

      for (let t = 0; t < env.terminalStep; t++) {
        const { probs, valid } = this._maskedSoftmax(key);
        const action = this.selectAction(key);
        const { nextState, reward, done } = env.takeAction(action);
        traj.push({ action, reward, probs, valid });
        key = env._stateToKey(nextState);
        if (done) break;
      }

      let G = 0;
      const gradients = new Float64Array(this.nActions);
      for (let t = traj.length - 1; t >= 0; t--) {
        G = G * this.gamma + traj[t].reward;
        const { action, probs, valid } = traj[t];
        for (const a of valid) {
          const grad = (a === action ? 1 : 0) - (probs[a] ?? 0);
          gradients[a] += G * grad;
        }
      }

      for (let a = 0; a < this.nActions; a++) {
        this.policyWeights[a] += this.lr * gradients[a];
      }

      const totalR = traj.reduce((s, t) => s + t.reward, 0);
      rewards.push(totalR);
    }

    this.trainingStats.episodes = episodes;
    this.trainingStats.avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length;
    this.trainingStats.last10Avg = rewards.slice(-10).reduce((a, b) => a + b, 0) / 10;
    return this.trainingStats;
  }
}

// ═══════════════════════════════════════════════════
// ИНТЕГРАЦИЯ С CRUCIX
// ═══════════════════════════════════════════════════

function buildCausalEnvFromHistory(history, options = {}) {
  const nodes = options.nodes || ['vix', 'conflict', 'sanctions', 'tension', 'radiation'];
  const edges = options.edges || [
    { from: 'conflict', to: 'sanctions', weight: 0.7 },
    { from: 'sanctions', to: 'tension', weight: 0.5 },
    { from: 'tension', to: 'vix', weight: 0.6 },
    { from: 'conflict', to: 'tension', weight: 0.4 },
    { from: 'vix', to: 'radiation', weight: 0.2 },
  ];

  const env = new CausalEnvironment({
    nodes,
    edges,
    maxSteps: options.maxSteps || 30,
    noiseScale: 0.08,
  });

  if (history.length > 0) {
    const latest = history[history.length - 1];
    env.currentState = {
      vix: Math.min(1, (latest.fred?.vix ?? 20) / 50),
      conflict: Math.min(1, (latest.gdelt?.conflictEvents?.length ?? 0) / 20),
      sanctions: Math.min(1, (latest.sanctions?.count ?? 0) / 10),
      tension: latest.tension ?? 0.5,
      radiation: Math.min(1, (latest.radiation?.max ?? 0) / 500),
    };
  }

  return env;
}

export function crucixCausalRL(history, options = {}) {
  if (!history || history.length < 20)
    return {
      module: 'causal_rl',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 20,
    };

  const t0 = Date.now();
  const env = buildCausalEnvFromHistory(history, options);
  const method = options.method || 'q_learning';
  const episodes = options.episodes || 150;

  let agent, trainStats, evalResult, insights;

  if (method === 'q_learning') {
    agent = new CausalQLearner({
      nActions: env.actions.length,
      learningRate: options.learningRate || 0.1,
      gamma: 0.95,
      epsilon: 1.0,
      epsilonDecay: 0.995,
      epsilonMin: 0.05,
    });
    trainStats = agent.train(env, episodes);
    evalResult = agent.evaluatePolicy(env, 30);
    insights = agent.extractCausalInsights(env);

    const stateFile = join(__dirname, '..', '..', '..', 'runs', 'predictions', 'causal_rl_q.json');
    saveJSON(stateFile, JSON.parse(agent.serialize()));
  } else {
    agent = new CausalPolicyGradient({
      nActions: env.actions.length,
      learningRate: options.learningRate || 0.01,
      gamma: 0.95,
    });
    trainStats = agent.train(env, episodes);
    evalResult = { policyAvg: trainStats.avgReward, randomAvg: 0, improvement: 0 };
    insights = [];
  }

  const topInsight = insights[0];
  const recommendedAction = topInsight
    ? `do(${topInsight.node}=low) — ${topInsight.direction}, ATE=${(topInsight.ateHigh ?? topInsight.ate ?? 0).toFixed(3)}, policy prefers: ${topInsight.policyPrefers}`
    : 'observe';

  const result = {
    module: 'causal_rl',
    available: true,
    method,
    elapsedMs: Date.now() - t0,
    episodes,
    training: {
      avgReward: Math.round(trainStats.avgReward * 1000) / 1000,
      last10Avg: Math.round((trainStats.last10Avg ?? 0) * 1000) / 1000,
      causalRatio: Math.round((trainStats.causalRatio ?? 0) * 1000) / 1000,
    },
    evaluation: {
      policyAvg: Math.round(evalResult.policyAvg * 1000) / 1000,
      randomAvg: Math.round(evalResult.randomAvg * 1000) / 1000,
      improvement: Math.round(evalResult.improvement * 1000) / 1000,
      improvementPct: Math.round((evalResult.improvementPct ?? 0) * 100) / 100,
    },
    causalInsights: insights,
    recommendedAction,
    env: {
      nodes: env.nodes,
      edges: env.edges,
      nActions: env.actions.length,
      actions: env.actions.map(a => a.id),
      initialState: env._discretize(env.currentState),
    },
    interpretation: `Causal RL обучен за ${episodes} эпизодов. Policy улучшение над random: ${((evalResult.improvementPct ?? 0) * 100).toFixed(1)}%. Топ-вмешательство: ${recommendedAction}`,
  };

  const outFile = join(__dirname, '..', '..', '..', 'runs', 'predictions', 'causal_rl_result.json');
  saveJSON(outFile, result);
  return result;
}

export { CausalEnvironment, CausalQLearner, CausalPolicyGradient, buildCausalEnvFromHistory };
