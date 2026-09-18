// apis/predict/attention_dynamics.mjs
// Collective Attention Dynamics
// Анализ того, куда направлено коллективное внимание и как оно перетекает.
// Внимание — самый ранний сигнал: опережает действия на 24-72 часа.
//
// Теоретическая основа:
//   - Wu & Huberman (2007). "Novelty and collective attention", PNAS.
//     Затухание внимания как степенной закон.
//   - Lehmann, Gonçalves, Ramasco (2012). "Dynamical classes of
//     collective attention in Twitter", WWW. Три класса: fast, medium, slow.
//
// Ключевые метрики:
//   - attention  — накопленное внимание с экспоненциальным затуханием
//   - momentum   — изменение attention за шаг
//   - velocity   — momentum за единицу времени
//   - explosiveness = velocity + acceleration * 10
//
// Контракт Тип B (внутренний модуль apis/predict/*):
//   - export const meta (id, name, layer, category, description, version, depends, exports)
//   - export class Name
//   - export function name
//   Никаких route / methods / handler.
//   Только ESM, никаких require.
//   Портабельность — через fileURLToPath(import.meta.url).

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const meta = {
  id: 'attention_dynamics',
  name: 'Collective Attention Dynamics',
  layer: 8,
  category: 'information',
  description: 'Коллективное внимание как самый ранний сигнал: затухание по half-life, momentum, velocity, детекция перетока внимания между темами, прогноз взрывных тем на 24ч.',
  version: '2.0.0',
  depends: [],
  exports: ['AttentionDynamics', 'extractTopicsFromSweep', 'crucixAttentionDynamics'],
};

// ─── МОДЕЛЬ ВНИМАНИЯ ───────────────────────────────

export class AttentionDynamics {
  constructor(config = {}) {
    this.topics = new Map();       // topicId → { attention, momentum, velocity, sources }
    this.totalAttention = 0;
    this.halfLifeHours = config.halfLifeHours || 24;  // период полураспада внимания
    this.sources = config.sources || ['gdelt', 'news', 'social', 'polymarket'];
  }

  /**
   * Обновление внимания к теме
   * @param {string} topicId
   * @param {number} newMentions — сколько новых упоминаний в этом sweep
   * @param {number} hoursPassed — сколько прошло с прошлого обновления
   */
  update(topicId, newMentions, hoursPassed = 0.25) {
    if (!this.topics.has(topicId)) {
      this.topics.set(topicId, {
        id: topicId,
        attention: 0,
        momentum: 0,
        velocity: 0,
        history: [],
        lastUpdate: Date.now(),
      });
    }

    const topic = this.topics.get(topicId);
    const decay = Math.exp(-hoursPassed / this.halfLifeHours * Math.log(2));

    // Attention = decay + newMentions
    const oldAttention = topic.attention;
    topic.attention = topic.attention * decay + newMentions;

    // Momentum = изменение attention
    topic.momentum = topic.attention - oldAttention;

    // Velocity = momentum за единицу времени
    topic.velocity = topic.momentum / Math.max(hoursPassed, 0.01);

    // История (последние 50 точек)
    topic.history.push({
      timestamp: Date.now(),
      attention: topic.attention,
      momentum: topic.momentum,
      velocity: topic.velocity,
    });
    if (topic.history.length > 50) topic.history.shift();

    topic.lastUpdate = Date.now();

    return topic;
  }

  /**
   * Распределение внимания между темами
   * Возвращает долю каждой темы в общем внимании
   */
  getAttentionAllocation() {
    const total = [...this.topics.values()].reduce((s, t) => s + t.attention, 0);
    if (total === 0) return {};

    const allocation = {};
    for (const [id, topic] of this.topics) {
      allocation[id] = {
        share: topic.attention / total,
        attention: topic.attention,
        momentum: topic.momentum,
        velocity: topic.velocity,
      };
    }
    return allocation;
  }

  /**
   * Attention Shift Detection:
   * Обнаружение момента, когда внимание перетекает от одной темы к другой
   */
  detectShifts(windowSize = 5) {
    const topicsArray = [...this.topics.values()];
    if (topicsArray.length < 2) return { shifts: [] };

    const shifts = [];
    const allocation = this.getAttentionAllocation();

    // Для каждой пары тем
    for (let i = 0; i < topicsArray.length; i++) {
      for (let j = i + 1; j < topicsArray.length; j++) {
        const a = topicsArray[i];
        const b = topicsArray[j];

        if (a.history.length < windowSize || b.history.length < windowSize) continue;

        const recentA = a.history.slice(-windowSize);
        const recentB = b.history.slice(-windowSize);

        const aTrend = recentA[recentA.length - 1].attention - recentA[0].attention;
        const bTrend = recentB[recentB.length - 1].attention - recentB[0].attention;

        // Shift: один растёт, другой падает
        if (aTrend > 0 && bTrend < 0 && Math.abs(aTrend) > 0.5 && Math.abs(bTrend) > 0.5) {
          const totalShift = Math.min(Math.abs(aTrend), Math.abs(bTrend));
          shifts.push({
            from: b.id,
            to: a.id,
            magnitude: totalShift,
            aTrend,
            bTrend,
            interpretation: `Внимание перетекает от "${b.id}" к "${a.id}" (${totalShift.toFixed(2)} ед.)`,
          });
        }
      }
    }

    return {
      shifts: shifts.sort((a, b) => b.magnitude - a.magnitude),
      totalShifts: shifts.length,
    };
  }

  /**
   * Предсказание: какая тема «взорвётся» в ближайшие N часов?
   * На основе velocity + momentum
   */
  predictExplosive(topN = 5, horizonHours = 24) {
    const predictions = [];

    for (const [id, topic] of this.topics) {
      if (topic.history.length < 3) continue;

      // Простая линейная экстраполяция
      const recent = topic.history.slice(-3);
      const velocityTrend = (recent[recent.length - 1].velocity - recent[0].velocity) / recent.length;
      const predictedAttention = topic.attention + topic.velocity * horizonHours + 0.5 * velocityTrend * horizonHours ** 2;

      // Explosiveness = velocity + acceleration
      const explosiveness = Math.max(0, topic.velocity + velocityTrend * 10);

      predictions.push({
        topic: id,
        currentAttention: topic.attention,
        predictedAttention,
        explosiveness,
        velocity: topic.velocity,
        momentum: topic.momentum,
        willExplode: explosiveness > 1.0 && predictedAttention > topic.attention * 1.5,
      });
    }

    return predictions
      .sort((a, b) => b.explosiveness - a.explosiveness)
      .slice(0, topN);
  }

  toJSON() {
    return {
      topics: [...this.topics.values()].map(t => ({
        id: t.id, attention: t.attention, momentum: t.momentum, velocity: t.velocity,
      })),
      totalTopics: this.topics.size,
      attentionAllocation: this.getAttentionAllocation(),
    };
  }
}

// ─── ИЗВЛЕЧЕНИЕ ТЕМ ИЗ GDELT ───────────────────────

function extractTopicsFromSweep(latest) {
  const topics = new Map();  // topicId → mentions

  // Топики из GDELT событий
  if (latest.gdelt?.conflictEvents) {
    for (const event of latest.gdelt.conflictEvents) {
      const keywords = (event.summary || event.description || '').toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4);

      // Каждое ключевое слово — тема
      for (const kw of keywords) {
        topics.set(kw, (topics.get(kw) || 0) + 1);
      }
    }
  }

  return topics;
}

// ─── ИНТЕГРАЦИЯ С CRUCIX ───────────────────────────

export function crucixAttentionDynamics(latest, history, stateFile = null) {
  const filepath = stateFile || join(__dirname, '..', '..', 'runs', 'predictions', 'attention_state.json');

  // Загрузка состояния
  let ad;
  try {
    if (existsSync(filepath)) {
      const raw = readFileSync(filepath, 'utf-8');
      const data = JSON.parse(raw);
      ad = new AttentionDynamics({ halfLifeHours: data.halfLifeHours || 24 });
      for (const t of data.topics || []) {
        ad.topics.set(t.id, {
          id: t.id, attention: t.attention, momentum: t.momentum,
          velocity: t.velocity, history: t.history || [], lastUpdate: Date.now(),
        });
      }
    } else {
      ad = new AttentionDynamics();
    }
  } catch (e) {
    console.warn('[attention_dynamics] Ошибка загрузки состояния:', e.message);
    ad = new AttentionDynamics();
  }

  // Обновление внимания
  const topics = extractTopicsFromSweep(latest);
  for (const [topicId, mentions] of topics) {
    ad.update(topicId, mentions, 0.25);
  }

  // Анализ
  const allocation = ad.getAttentionAllocation();
  const shifts = ad.detectShifts();
  const explosive = ad.predictExplosive(10, 24);

  const result = {
    module: 'attention_dynamics',
    totalTopics: ad.topics.size,
    attentionAllocation: allocation,
    shifts: shifts.shifts.slice(0, 5),
    topExplosive: explosive,
    totalAttention: [...ad.topics.values()].reduce((s, t) => s + t.attention, 0),
    timestamp: new Date().toISOString(),
  };

  // Сохранение
  const dir = join(__dirname, '..', '..', 'runs', 'predictions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filepath, JSON.stringify({
    halfLifeHours: ad.halfLifeHours,
    topics: [...ad.topics.values()].map(t => ({
      id: t.id, attention: t.attention, momentum: t.momentum,
      velocity: t.velocity, history: t.history.slice(-20),
    })),
  }, null, 2));

  return result;
}

export { extractTopicsFromSweep };
