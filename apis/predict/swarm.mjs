// apis/predict/swarm.mjs
// Агентное социальное моделирование (MiroFish-подход для Crucix).
//
// Теоретическая основа:
//   Epstein, J. M., & Axtell, R. (1996). "Growing Artificial Societies:
//   Social Science from the Bottom Up". MIT Press.
//   Gilbert, N., & Troitzsch, K. G. (2005). "Simulation for the Social
//   Scientist" (2nd ed.). Open University Press.
//   Axelrod, R. (1997). "The Complexity of Cooperation". Princeton.
//
// Идея:
//   Прогноз рождается не из статистики, а из эмерджентного поведения
//   агентов. Каждый агент имеет роль, MBTI-тип, набор черт (riskAversion,
//   influence, volatility, openness, groupIdentity). Агенты реагируют
//   на события, влияют на соседей, голосуют за изменения состояния.
//
// Отличие от LLM-агентов:
//   LLM-агенты в llm_agents.mjs используют API для "рассуждения".
//   Swarm-агенты — это быстрая поведенческая модель без LLM-вызовов:
//   500 агентов × 20 раундов выполняются за миллисекунды.
//
// Применение в Crucix:
//   Симуляция геополитических/социальных сценариев. Пример: новость о
//   новых санкциях -> эскалация напряжения -> часть агентов паникует ->
//   кластеризация мнений -> прогноз исхода.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// КОНСТАНТЫ
// ============================================================

const MBTI_TYPES = [
  'INTJ', 'ENTJ', 'INTP', 'ENTP',
  'INFJ', 'ENFJ', 'INFP', 'ENFP',
  'ISTJ', 'ESTJ', 'ISTP', 'ESTP',
  'ISFJ', 'ESFJ', 'ISFP', 'ESFP',
];

const ACTOR_ROLES = [
  { role: 'government',      weight: 0.15, baseInfluence: 0.90, baseRisk: 0.30 },
  { role: 'military',        weight: 0.10, baseInfluence: 0.85, baseRisk: 0.60 },
  { role: 'diplomat',        weight: 0.10, baseInfluence: 0.70, baseRisk: 0.20 },
  { role: 'business_leader', weight: 0.15, baseInfluence: 0.60, baseRisk: 0.40 },
  { role: 'media',           weight: 0.10, baseInfluence: 0.50, baseRisk: 0.50 },
  { role: 'civilian',        weight: 0.30, baseInfluence: 0.20, baseRisk: 0.50 },
  { role: 'analyst',         weight: 0.05, baseInfluence: 0.40, baseRisk: 0.30 },
  { role: 'activist',        weight: 0.05, baseInfluence: 0.35, baseRisk: 0.70 },
];

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function pickWeightedRole() {
  const total = ACTOR_ROLES.reduce((s, r) => s + r.weight, 0);
  let r = Math.random() * total;
  for (const ar of ACTOR_ROLES) {
    r -= ar.weight;
    if (r <= 0) return ar;
  }
  return ACTOR_ROLES[0];
}

// ============================================================
// ГЕНЕРАЦИЯ АГЕНТОВ
// ============================================================

function generateAgent(id) {
  const selectedRole = pickWeightedRole();
  const mbti = MBTI_TYPES[Math.floor(Math.random() * MBTI_TYPES.length)];
  const noise = () => (Math.random() - 0.5) * 0.3;

  const traits = {
    riskAversion: clamp01(selectedRole.baseRisk + noise()),
    influence: clamp01(selectedRole.baseInfluence + noise()),
    volatility: clamp01(0.3 + Math.random() * 0.4),
    openness: clamp01(0.5 + noise()),
    groupIdentity: clamp01(0.4 + noise() * 2),
  };

  return {
    id: `agent_${id}`,
    persona: `${selectedRole.role}_${mbti}`,
    role: selectedRole.role,
    mbti,
    traits,
    memory: { shortTerm: [], longTerm: {}, interactionHistory: [] },
    state: {
      mood: 0.5,
      position: Math.random(),
      resources: clamp01(0.5 + noise() * 0.3),
      alliances: [],
      informationLevel: clamp01(0.3 + Math.random() * 0.4),
    },
  };
}

function generateSwarm(count) {
  return Array.from({ length: count }, (_, i) => generateAgent(i));
}

// ============================================================
// ПОВЕДЕНЧЕСКАЯ ЛОГИКА
// ============================================================

function reactToEvent(event, agent) {
  const t = agent.traits;
  const sev = event.severity || 0.5;
  const isThreat = event.type === 'conflict' || event.type === 'crisis';
  const isExtro = agent.mbti.startsWith('E');
  const isJudger = agent.mbti.includes('J');
  const isThinker = agent.mbti.includes('T');

  let moodShift = 0;
  let positionShift = 0;
  let action = 'observe';

  if (isThreat) {
    moodShift = -sev * (0.5 + t.riskAversion);
    positionShift = sev * t.groupIdentity * (agent.state.position > 0.5 ? 1 : -1);
    if (t.riskAversion > 0.7 && sev > 0.6) action = 'panic';
    else if (t.influence > 0.6) action = 'respond';
  } else if (event.type === 'deescalation') {
    moodShift = sev * 0.3;
    positionShift = -sev * 0.1;
    action = 'support';
  } else if (event.type === 'economic') {
    moodShift = sev * (event.direction === 'negative' ? -0.4 : 0.3) * t.riskAversion;
    action = isThinker ? 'analyze' : 'react';
  }

  if (isExtro) { moodShift *= 1.3; if (action === 'observe') action = 'spread'; }
  if (isJudger && action === 'observe') action = 'decide';

  return { moodShift, positionShift, action };
}

function decide(agent, env) {
  const tension = env.tension;
  const mood = agent.state.mood;
  if (mood < 0.2 && tension > 0.7) return { action: 'retreat', intensity: 0.8 };
  if (mood > 0.8 && tension < 0.3) return { action: 'expand', intensity: 0.6 };
  if (agent.traits.volatility > 0.7 && Math.random() < 0.1) {
    return { action: 'radicalize', intensity: 0.5 };
  }
  return { action: 'maintain', intensity: 0.3 };
}

// ============================================================
// СРЕДА СИМУЛЯЦИИ
// ============================================================

class SimulationEnvironment {
  constructor(config = {}) {
    this.tension = config.initialTension !== undefined ? config.initialTension : 0.5;
    this.economicStability = config.economicStability !== undefined ? config.economicStability : 0.6;
    this.informationFlow = config.informationFlow !== undefined ? config.informationFlow : 0.5;
    this.externalPressure = config.externalPressure !== undefined ? config.externalPressure : 0.3;
    this.round = 0;
    this.events = [];
    this.injectedEvents = [];
  }

  injectEvent(event) {
    this.injectedEvents.push({ round: this.round, ...event });
    this.events.push({ round: this.round, ...event });
  }

  update(agents) {
    const avgMood = agents.reduce((s, a) => s + a.state.mood, 0) / agents.length;
    const avgPos = agents.reduce((s, a) => s + a.state.position, 0) / agents.length;
    const polarization =
      agents.reduce((s, a) => s + Math.abs(a.state.position - avgPos), 0) / agents.length;

    this.tension = clamp01(
      this.tension * 0.9 + polarization * 0.3 + (1 - avgMood) * 0.2 + this.externalPressure * 0.1
    );
    this.economicStability = clamp01(
      this.economicStability * 0.95 + avgMood * 0.05 - this.tension * 0.03
    );
    this.informationFlow = clamp01(
      this.informationFlow * 0.9 + 0.1 * (1 - this.tension)
    );
    this.round++;
  }

  get activeEvents() {
    return this.events.filter((e) => e.round >= this.round - 3);
  }

  getState() {
    return {
      round: this.round,
      tension: this.tension,
      economicStability: this.economicStability,
      informationFlow: this.informationFlow,
      externalPressure: this.externalPressure,
      activeEvents: this.activeEvents,
    };
  }
}

// ============================================================
// ОДИН РАУНД СИМУЛЯЦИИ
// ============================================================

function simulationRound(agents, env) {
  const actions = {};
  const moods = [];
  const positions = [];

  for (const agent of agents) {
    for (const event of env.activeEvents) {
      const r = reactToEvent(event, agent);
      agent.state.mood = clamp01(agent.state.mood + r.moodShift);
      agent.state.position = clamp01(agent.state.position + r.positionShift);
      agent.memory.shortTerm.push({ event: event.type, reaction: r.action, round: env.round });
      if (agent.memory.shortTerm.length > 10) agent.memory.shortTerm.shift();
      actions[r.action] = (actions[r.action] || 0) + 1;
    }

    const d = decide(agent, env);
    actions[d.action] = (actions[d.action] || 0) + 1;

    const radius = Math.floor(agent.traits.influence * 10);
    for (let j = 0; j < radius; j++) {
      const idx = Math.floor(Math.random() * agents.length);
      if (agents[idx] === agent) continue;
      const target = agents[idx];
      const inf = agent.traits.influence * 0.1 * (agent.state.mood - target.state.mood);
      target.state.mood = clamp01(target.state.mood + inf * 0.1);
    }

    moods.push(agent.state.mood);
    positions.push(agent.state.position);
  }

  env.update(agents);

  const sortedPos = [...positions].sort((a, b) => a - b);

  return {
    round: env.round,
    avgMood: moods.reduce((a, b) => a + b, 0) / moods.length,
    avgPosition: positions.reduce((a, b) => a + b, 0) / positions.length,
    polarization: {
      p25: sortedPos[Math.floor(sortedPos.length * 0.25)],
      p50: sortedPos[Math.floor(sortedPos.length * 0.50)],
      p75: sortedPos[Math.floor(sortedPos.length * 0.75)],
    },
    actions,
    environment: env.getState(),
  };
}

// ============================================================
// ПОЛНЫЙ ЗАПУСК СИМУЛЯЦИИ (async — для совместимости с engine)
// ============================================================

async function runSimulation(config = {}) {
  const {
    agentCount = 500,
    rounds = 20,
    seedEvent,
    environment: envCfg = {},
    godEyeMode = false,
    godEyeInjectAt,
    godEyeEvent,
  } = config;

  const agents = generateSwarm(agentCount);
  const env = new SimulationEnvironment(envCfg);
  if (seedEvent) env.injectEvent(seedEvent);

  const history = [];
  for (let r = 0; r < rounds; r++) {
    if (godEyeMode && godEyeInjectAt === r && godEyeEvent) {
      env.injectEvent(godEyeEvent);
    }
    history.push(simulationRound(agents, env));
  }

  const trajectory = {
    mood: history.map((h) => h.avgMood),
    tension: history.map((h) => h.environment.tension),
    economic: history.map((h) => h.environment.economicStability),
  };

  return {
    agents: agents.length,
    rounds,
    history,
    trajectory,
    finalState: history[history.length - 1],
    outcome: classifyOutcome(history[history.length - 1], trajectory),
    injectedEvents: env.injectedEvents,
  };
}

function classifyOutcome(final, traj) {
  const tension = final.environment.tension;
  const mood = final.avgMood;
  const spread = (final.polarization.p75 || 0.5) - (final.polarization.p25 || 0.5);
  const moodTrend =
    traj.mood.slice(-5).reduce((a, b) => a + b, 0) / 5 -
    traj.mood.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

  if (tension > 0.8 && spread > 0.4) {
    return { type: 'escalation', probability: 0.8, description: 'High tension + polarization -> escalation' };
  }
  if (tension > 0.7 && mood < 0.3) {
    return { type: 'crisis', probability: 0.7, description: 'Crisis: high tension, low mood' };
  }
  if (tension < 0.3 && mood > 0.7) {
    return { type: 'stable', probability: 0.75, description: 'Stability' };
  }
  if (moodTrend < -0.05) {
    return { type: 'deteriorating', probability: 0.6, description: 'Deteriorating' };
  }
  if (spread > 0.5) {
    return { type: 'polarized', probability: 0.65, description: 'Social split' };
  }
  return { type: 'uncertain', probability: 0.5, description: 'Uncertain outcome' };
}

// ============================================================
// ИНТЕГРАЦИЯ С CRUCIX
// ============================================================

function buildSeedEvent(latest) {
  const vix = (latest && latest.fred && latest.fred.vix) || 20;
  const conflicts =
    latest && latest.gdelt && Array.isArray(latest.gdelt.conflictEvents)
      ? latest.gdelt.conflictEvents.length
      : 0;
  const sanctions = (latest && latest.sanctions && latest.sanctions.count) || 0;

  if (vix > 30 || conflicts > 10) {
    return {
      type: 'conflict',
      severity: Math.min(1, (vix - 20) / 30 + conflicts / 20),
      direction: 'negative',
      source: 'crucix_sweep',
    };
  }
  if (vix > 22 || sanctions > 3) {
    return { type: 'economic', severity: 0.5, direction: 'negative', source: 'crucix_sweep' };
  }
  if (vix < 18 && conflicts < 3) {
    return { type: 'deescalation', severity: 0.4, direction: 'positive', source: 'crucix_sweep' };
  }
  return { type: 'neutral', severity: 0.3, direction: 'neutral', source: 'crucix_sweep' };
}

function computeInitialTension(latest) {
  const vix = (latest && latest.fred && latest.fred.vix) || 20;
  const conflicts =
    latest && latest.gdelt && Array.isArray(latest.gdelt.conflictEvents)
      ? latest.gdelt.conflictEvents.length
      : 0;
  return clamp01((vix - 15) / 30 + conflicts / 30);
}

function computeEconStability(latest) {
  const vix = (latest && latest.fred && latest.fred.vix) || 20;
  const hy = (latest && latest.fred && latest.fred.hySpread) || 3;
  return clamp01(1 - (vix - 15) / 40 - (hy - 2) / 10);
}

function computeExternalPressure(latest) {
  const s = (latest && latest.sanctions && latest.sanctions.count) || 0;
  const c =
    latest && latest.gdelt && Array.isArray(latest.gdelt.conflictEvents)
      ? latest.gdelt.conflictEvents.length
      : 0;
  return clamp01(s / 20 + c / 30);
}

async function crucixSwarmForecast(latest, options = {}) {
  const seedEvent = buildSeedEvent(latest);
  const config = {
    agentCount: options.agentCount || 500,
    rounds: options.rounds || 20,
    seedEvent,
    environment: {
      initialTension: computeInitialTension(latest),
      economicStability: computeEconStability(latest),
      informationFlow: 0.5,
      externalPressure: computeExternalPressure(latest),
    },
    godEyeMode: !!options.godEyeEvent,
    godEyeInjectAt: options.godEyeInjectAt || Math.floor((options.rounds || 20) / 2),
    godEyeEvent: options.godEyeEvent,
  };

  const result = await runSimulation(config);

  // Сохранение
  try {
    const dir = join(__dirname, '..', '..', 'runs', 'predictions');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `swarm_${Date.now()}.json`), JSON.stringify(result, null, 2));
  } catch (e) {
    // Игнорируем ошибки записи — модуль должен работать даже без диска
  }

  return {
    module: 'swarm',
    outcome: result.outcome,
    agentCount: result.agents,
    rounds: result.rounds,
    finalTension: result.finalState.environment.tension,
    finalMood: result.finalState.avgMood,
    polarization: result.finalState.polarization,
    trajectory: result.trajectory,
    injectedEvents: result.injectedEvents,
    timestamp: new Date().toISOString(),
  };
}

export {
  generateSwarm,
  generateAgent,
  SimulationEnvironment,
  simulationRound,
  runSimulation,
  classifyOutcome,
  buildSeedEvent,
  computeInitialTension,
  computeEconStability,
  computeExternalPressure,
  crucixSwarmForecast,
};
