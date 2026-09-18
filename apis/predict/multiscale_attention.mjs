// apis/predict/multiscale_attention.mjs
//
// Multi-scale Attention Dynamics
// Моделирование внимания одновременно на нескольких временных горизонтах.
//
// Теоретическая основа:
//   - Wu & Huberman (2007). "Novelty and collective attention", PNAS.
//     -- attention decay as power law with varying exponents.
//   - Wu, Hofman, Mason, Watts (2011). "Who says what to whom on Twitter", WWW.
//     -- multi-scale attention dynamics.
//   - Lehmann, Goncalves, Ramasco (2012). "Dynamical classes of collective
//     attention in Twitter", WWW. -- три класса: fast, medium, slow.
//
// Ключевая идея:
//   Внимание к теме имеет разную динамику на разных горизонтах:
//   - Short (1-6ч): резкие всплески, half-life ~2ч
//   - Medium (6-48ч): устойчивый рост/спад, half-life ~12ч
//   - Long (2-14 дней): медленная эволюция, half-life ~72ч
//
//   Единый half-life вводит в заблуждение. Multi-scale даёт:
//   - Параллельные прогнозы для каждого горизонта
//   - Композитный сигнал: когда ВСЕ три растут -> устойчивый тренд
//   - Дивергенция: short растёт, но long падает -> шум, не тренд

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// === MULTI-SCALE ATTENTION MODEL ===

/**
 * Один масштаб внимания -- обёртка над AttentionDynamics с собственным half-life.
 */
class AttentionScale {
  constructor(name, halfLifeHours) {
    this.name = name;
    this.halfLifeHours = halfLifeHours;
    this.topics = new Map();
    this.lastUpdate = Date.now();
  }

  update(topicId, newMentions, hoursPassed) {
    if (!this.topics.has(topicId)) {
      this.topics.set(topicId, {
        id: topicId,
        attention: 0,
        momentum: 0,
        velocity: 0,
        history: [],
      });
    }
    const topic = this.topics.get(topicId);
    const decay = Math.exp(-hoursPassed * Math.log(2) / this.halfLifeHours);
    const old = topic.attention;
    topic.attention = topic.attention * decay + newMentions;
    topic.momentum = topic.attention - old;
    topic.velocity = topic.momentum / Math.max(hoursPassed, 0.01);
    topic.history.push({
      t: Date.now(),
      attention: topic.attention,
      momentum: topic.momentum,
      velocity: topic.velocity,
    });
    if (topic.history.length > 100) topic.history.shift();
    return topic;
  }

  getAllocation() {
    const total = [...this.topics.values()].reduce((s, t) => s + t.attention, 0);
    if (total === 0) return {};
    const alloc = {};
    for (const [id, t] of this.topics) {
      alloc[id] = {
        share: t.attention / total,
        attention: t.attention,
        momentum: t.momentum,
        velocity: t.velocity,
      };
    }
    return alloc;
  }

  predictExplosive(topN, horizonHours) {
    const preds = [];
    for (const [id, topic] of this.topics) {
      if (topic.history.length < 3) continue;
      const recent = topic.history.slice(-3);
      const velocityTrend =
        (recent[recent.length - 1].velocity - recent[0].velocity) / recent.length;
      const predicted =
        topic.attention + topic.velocity * horizonHours + 0.5 * velocityTrend * horizonHours ** 2;
      const explosiveness = Math.max(0, topic.velocity + velocityTrend * 10);
      preds.push({
        topic: id,
        currentAttention: topic.attention,
        predictedAttention: predicted,
        explosiveness,
        velocity: topic.velocity,
        willExplode: explosiveness > 1.0 && predicted > topic.attention * 1.5,
      });
    }
    return preds.sort((a, b) => b.explosiveness - a.explosiveness).slice(0, topN);
  }
}

// === MULTI-SCALE ENGINE ===

/**
 * Multi-scale Attention Engine.
 *
 * Масштабы по умолчанию (Lehmann et al., 2012):
 *   - "fast":     half-life = 2 часа   -- короткие всплески
 *   - "medium":   half-life = 12 часов -- дневная динамика
 *   - "slow":     half-life = 72 часа  -- многодневные тренды
 */
export class MultiScaleAttention {
  constructor(config = {}) {
    this.scales = {
      fast: new AttentionScale('fast', config.fastHalfLife || 2),
      medium: new AttentionScale('medium', config.mediumHalfLife || 12),
      slow: new AttentionScale('slow', config.slowHalfLife || 72),
    };
    this.updateCount = 0;
    this.lastTimestamp = null;
  }

  /**
   * Обновление всех масштабов.
   */
  update(topics, timestamp) {
    const now = timestamp ? new Date(timestamp).getTime() : Date.now();
    const hoursPassed = this.lastTimestamp
      ? Math.max(0.001, (now - this.lastTimestamp) / (1000 * 60 * 60))
      : 0.25;
    this.lastTimestamp = now;
    this.updateCount++;

    for (const scale of Object.values(this.scales)) {
      for (const [topicId, mentions] of topics) {
        scale.update(topicId, mentions, hoursPassed);
      }
    }
  }

  /**
   * Композитная оценка темы: агрегация по всем масштабам.
   *
   * Используется weighted geometric mean:
   *   composite = (fast * medium * slow)^(1/3)
   *
   * Свойства:
   *   - Требует согласия ВСЕХ масштабов для высокого composite
   *   - Дивергенция понижает composite
   *   - Устойчива к выбросам
   */
  compositeTopicScore(topicId) {
    const scores = {};
    for (const [name, scale] of Object.entries(this.scales)) {
      const topic = scale.topics.get(topicId);
      scores[name] = topic ? topic.attention : 0;
    }

    const values = Object.values(scores).filter(v => v > 0);
    if (values.length === 0) {
      return { composite: 0, scores, agreement: 0 };
    }

    // Geometric mean
    const product = values.reduce((p, v) => p * v, 1);
    const geometricMean = Math.pow(product, 1 / values.length);

    // Agreement: coefficient of variation (1 - CV)
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const cv = Math.sqrt(variance) / (mean || 1);
    const agreement = Math.max(0, 1 - cv);

    return {
      composite: geometricMean,
      scores,
      agreement,
      divergent: cv > 0.5,
    };
  }

  /**
   * Обнаружение дивергенции между масштабами.
   *
   * Дивергенция: fast momentum > 0, slow momentum < 0 (или наоборот).
   * Это означает шум или краткосрочный всплеск без структурного тренда.
   */
  detectDivergence() {
    const divergences = [];
    const topicIds = new Set();
    for (const scale of Object.values(this.scales)) {
      for (const id of scale.topics.keys()) topicIds.add(id);
    }

    for (const id of topicIds) {
      const fast = this.scales.fast.topics.get(id);
      const slow = this.scales.slow.topics.get(id);
      if (!fast || !slow) continue;

      // Проверяем знаки momentum
      if (Math.sign(fast.momentum) !== Math.sign(slow.momentum) &&
          Math.abs(fast.momentum) > 0.5 && Math.abs(slow.momentum) > 0.5) {
        divergences.push({
          topic: id,
          fastMomentum: fast.momentum,
          slowMomentum: slow.momentum,
          type: fast.momentum > 0 ? 'short_spike_no_trend' : 'trend_fading_short_recovery',
          interpretation: fast.momentum > 0
            ? 'Краткосрочный всплеск без структурного тренда'
            : 'Долгосрочный тренд угасает, но краткосрочное восстановление',
        });
      }
    }
    return divergences;
  }

  /**
   * Cross-scale correlation: насколько масштабы двигаются вместе.
   */
  crossScaleCorrelation() {
    const topicIds = new Set();
    for (const scale of Object.values(this.scales)) {
      for (const id of scale.topics.keys()) topicIds.add(id);
    }

    const correlations = [];
    for (const id of topicIds) {
      const fast = this.scales.fast.topics.get(id);
      const slow = this.scales.slow.topics.get(id);
      if (!fast || !slow || fast.history.length < 5 || slow.history.length < 5) continue;

      const n = Math.min(fast.history.length, slow.history.length);
      const fastSeries = fast.history.slice(-n).map(h => h.attention);
      const slowSeries = slow.history.slice(-n).map(h => h.attention);

      const corr = pearsonCorrelation(fastSeries, slowSeries);

      correlations.push({
        topic: id,
        correlation: corr,
        interpretation: corr > 0.7 ? 'масштабы согласованы'
          : corr > 0.3 ? 'слабая связь'
          : 'масштабы независимы',
      });
    }
    return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
  }

  /**
   * Композитная explosive-оценка по всем масштабам.
   */
  predictMultiScale(topN = 10, horizonHours = 24) {
    const topicIds = new Set();
    for (const scale of Object.values(this.scales)) {
      for (const id of scale.topics.keys()) topicIds.add(id);
    }

    const predictions = [];
    for (const id of topicIds) {
      const composite = this.compositeTopicScore(id);
      const fast = this.scales.fast.topics.get(id);
      const medium = this.scales.medium.topics.get(id);
      const slow = this.scales.slow.topics.get(id);

      // Multi-scale explosiveness: голосование
      const votes = [
        fast?.velocity || 0,
        medium?.velocity || 0,
        slow?.velocity || 0,
      ].filter(v => v > 0.2);

      // Composite explosiveness = geometric mean of velocities
      const allVelocities = [fast?.velocity || 0, medium?.velocity || 0, slow?.velocity || 0];
      const positiveVelocities = allVelocities.filter(v => v > 0);
      const explosiveness = positiveVelocities.length > 0
        ? Math.pow(positiveVelocities.reduce((p, v) => p * v, 1), 1 / positiveVelocities.length)
        : 0;

      const willExplode = votes.length >= 2 && explosiveness > 0.5;
      const multiScaleConfirmed = composite.agreement > 0.6;

      predictions.push({
        topic: id,
        compositeScore: composite.composite,
        agreement: composite.agreement,
        divergent: composite.divergent,
        multiScaleConfirmed,
        explosiveness,
        votesAcrossScales: votes.length,
        willExplode,
        scores: composite.scores,
      });
    }

    return predictions
      .sort((a, b) => b.explosiveness - a.explosiveness)
      .slice(0, topN);
  }
}

// === УТИЛИТЫ ===

function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  return num / Math.sqrt((dx2 * dy2) || 1e-9);
}

// === ИНТЕГРАЦИЯ С CRUCIX ===

export function crucixMultiScaleAttention(history, stateFile = null) {
  const filepath = stateFile ||
    join(__dirname, '..', '..', 'runs', 'predictions', 'multiscale_attention.json');

  // Загрузка состояния
  let msa;
  try {
    if (existsSync(filepath)) {
      const data = JSON.parse(readFileSync(filepath, 'utf-8'));
      msa = new MultiScaleAttention(data.config || {});
      // Восстановление из data.scales
      for (const [scaleName, scaleData] of Object.entries(data.scales || {})) {
        if (msa.scales[scaleName]) {
          for (const topic of scaleData.topics || []) {
            msa.scales[scaleName].topics.set(topic.id, topic);
          }
        }
      }
      msa.updateCount = data.updateCount || 0;
      msa.lastTimestamp = data.lastTimestamp || null;
    } else {
      msa = new MultiScaleAttention();
    }
  } catch (e) {
    console.warn('[multiscale-attention] Load error:', e.message);
    msa = new MultiScaleAttention();
  }

  // Извлечение топиков из последних sweep
  const latest = history[history.length - 1];
  const topics = new Map();
  if (latest?.gdelt?.conflictEvents) {
    for (const evt of latest.gdelt.conflictEvents) {
      const words = (evt.summary || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4);
      for (const w of words) {
        topics.set(w, (topics.get(w) || 0) + 1);
      }
    }
  }

  // Обновление
  if (topics.size > 0) {
    msa.update(topics, latest?.timestamp);
  }

  // Аналитика
  const divergence = msa.detectDivergence();
  const correlations = msa.crossScaleCorrelation();
  const predictions = msa.predictMultiScale(15, 24);

  const result = {
    module: 'multiscale_attention',
    scales: {
      fast: { halfLifeHours: msa.scales.fast.halfLifeHours, topics: msa.scales.fast.topics.size },
      medium: { halfLifeHours: msa.scales.medium.halfLifeHours, topics: msa.scales.medium.topics.size },
      slow: { halfLifeHours: msa.scales.slow.halfLifeHours, topics: msa.scales.slow.topics.size },
    },
    totalTopics: new Set([
      ...msa.scales.fast.topics.keys(),
      ...msa.scales.medium.topics.keys(),
      ...msa.scales.slow.topics.keys(),
    ]).size,
    divergences: divergence,
    correlations: correlations.slice(0, 10),
    predictions: predictions.slice(0, 10),
    multiScaleExplosive: predictions.filter(p => p.willExplode).length,
    multiScaleConfirmed: predictions.filter(p => p.multiScaleConfirmed).length,
    updateCount: msa.updateCount,
    timestamp: new Date().toISOString(),
  };

  // Сохранение
  const dir = join(__dirname, '..', '..', 'runs', 'predictions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filepath, JSON.stringify({
    config: {
      fastHalfLife: msa.scales.fast.halfLifeHours,
      mediumHalfLife: msa.scales.medium.halfLifeHours,
      slowHalfLife: msa.scales.slow.halfLifeHours,
    },
    scales: Object.fromEntries(
      Object.entries(msa.scales).map(([name, s]) => [
        name,
        {
          topics: [...s.topics.values()].map(t => ({
            id: t.id,
            attention: t.attention,
            momentum: t.momentum,
            velocity: t.velocity,
            history: t.history.slice(-30),
          })),
        },
      ])
    ),
    updateCount: msa.updateCount,
    lastTimestamp: msa.lastTimestamp,
  }, null, 2));

  return result;
}

export { AttentionScale };
