// tests/mutation/attention.mutate.mjs
//
// Mutation testing для Attention Dynamics.
//
// Критические мутации:
//   1. Отключение затухания (decay = 1)
//   2. Инверсия знака momentum
//   3. Ошибка в нормализации allocation (sum != 1)
//   4. detectShifts игнорирует направление (любое изменение)
//   5. predictExplosive не учитывает velocity
//
// ЗАПУСК:
//   node tests/mutation/attention.mutate.mjs
//   или через run_all.mjs
//
// РЕЖИМЫ:
//   Обычный: печатает отчёт в stdout, process.exit(0|1) по порогу.
//   JSON-режим (CRUCIX_MUTATION_JSON=1): печатает только JSON, не выходит
//   с кодом 1. Используется оркестратором run_all.mjs.

import { AttentionDynamics } from '../../apis/predict/attention_dynamics.mjs';

const MUTATIONS = [
  {
    name: 'Отключение затухания (decay всегда 1)',
    apply: (ADClass) => {
      const originalUpdate = ADClass.prototype.update;
      ADClass.prototype.update = function(topicId, newMentions, hoursPassed = 0.25) {
        if (!this.topics.has(topicId)) {
          this.topics.set(topicId, {
            id: topicId, attention: 0, momentum: 0, velocity: 0,
            history: [], lastUpdate: Date.now(),
          });
        }
        const topic = this.topics.get(topicId);
        const oldAttention = topic.attention;
        // МУТАЦИЯ: decay = 1 (без затухания)
        topic.attention = topic.attention + newMentions;
        topic.momentum = topic.attention - oldAttention;
        topic.velocity = topic.momentum / Math.max(hoursPassed, 0.01);
        topic.history.push({ timestamp: Date.now(), attention: topic.attention, momentum: topic.momentum, velocity: topic.velocity });
        if (topic.history.length > 50) topic.history.shift();
        return topic;
      };
    },
    detect: (ADClass) => {
      const ad = new ADClass({ halfLifeHours: 1 });
      ad.update('topic', 10, 0.01);
      const after = ad.topics.get('topic').attention;
      // Проходит 24 часа без упоминаний
      ad.update('topic', 0, 24);
      const after24h = ad.topics.get('topic').attention;
      // Оригинал: затухание -> after24h << after (примерно 0)
      // Мутация: after24h == after
      return after24h > after * 0.5;
    },
  },

  {
    name: 'Momentum имеет обратный знак',
    apply: (ADClass) => {
      const originalUpdate = ADClass.prototype.update;
      ADClass.prototype.update = function(topicId, newMentions, hoursPassed = 0.25) {
        if (!this.topics.has(topicId)) {
          this.topics.set(topicId, {
            id: topicId, attention: 0, momentum: 0, velocity: 0,
            history: [], lastUpdate: Date.now(),
          });
        }
        const topic = this.topics.get(topicId);
        const decay = Math.exp(-hoursPassed / this.halfLifeHours * Math.log(2));
        const oldAttention = topic.attention;
        topic.attention = topic.attention * decay + newMentions;
        // МУТАЦИЯ: momentum = oldAttention - topic.attention (инверсия знака)
        topic.momentum = oldAttention - topic.attention;
        topic.velocity = topic.momentum / Math.max(hoursPassed, 0.01);
        topic.history.push({ timestamp: Date.now(), attention: topic.attention, momentum: topic.momentum, velocity: topic.velocity });
        if (topic.history.length > 50) topic.history.shift();
        return topic;
      };
    },
    detect: (ADClass) => {
      const ad = new ADClass({ halfLifeHours: 1000 });
      ad.update('topic', 10, 0.01);
      ad.update('topic', 10, 0.01);
      // Оригинал: momentum > 0 (растёт)
      // Мутация: momentum < 0
      return ad.topics.get('topic').momentum < 0;
    },
  },

  {
    name: 'detectShifts игнорирует направление',
    apply: (ADClass) => {
      ADClass.prototype.detectShifts = function(windowSize = 5) {
        const topicsArray = [...this.topics.values()];
        const shifts = [];
        // МУТАЦИЯ: любое изменение = shift (без проверки направления)
        for (let i = 0; i < topicsArray.length; i++) {
          for (let j = i + 1; j < topicsArray.length; j++) {
            const a = topicsArray[i], b = topicsArray[j];
            if (a.history.length < windowSize || b.history.length < windowSize) continue;
            const aTrend = a.history[a.history.length - 1].attention - a.history[0].attention;
            const bTrend = b.history[b.history.length - 1].attention - b.history[0].attention;
            // МУТАЦИЯ: без проверки знаков
            shifts.push({
              from: b.id, to: a.id,
              magnitude: Math.abs(aTrend - bTrend),
            });
          }
        }
        return { shifts, totalShifts: shifts.length };
      };
    },
    detect: (ADClass) => {
      const ad = new ADClass({ halfLifeHours: 1000 });
      // Обе темы растут одинаково -- не должно быть shifts
      for (let i = 0; i < 10; i++) {
        ad.update('a', 10, 0.01);
        ad.update('b', 10, 0.01);
      }
      const shifts = ad.detectShifts(5);
      // Оригинал: 0 shifts (оба растут, ни один не падает)
      // Мутация: > 0 shifts
      return shifts.totalShifts > 0;
    },
  },

  {
    name: 'Allocation не нормализуется (sum != 1)',
    apply: (ADClass) => {
      ADClass.prototype.getAttentionAllocation = function() {
        const allocation = {};
        for (const [id, topic] of this.topics) {
          // МУТАЦИЯ: share = attention, не normalizes
          allocation[id] = {
            share: topic.attention,
            attention: topic.attention,
            momentum: topic.momentum,
            velocity: topic.velocity,
          };
        }
        return allocation;
      };
    },
    detect: (ADClass) => {
      const ad = new ADClass({ halfLifeHours: 1000 });
      ad.update('a', 10, 0.01);
      ad.update('b', 20, 0.01);
      ad.update('c', 30, 0.01);
      const alloc = ad.getAttentionAllocation();
      const sum = Object.values(alloc).reduce((s, a) => s + a.share, 0);
      // Оригинал: sum = 1
      // Мутация: sum = 60
      return Math.abs(sum - 1) > 0.01;
    },
  },

  {
    name: 'predictExplosive игнорирует velocity',
    apply: (ADClass) => {
      ADClass.prototype.predictExplosive = function(topN = 5, horizonHours = 24) {
        const predictions = [];
        for (const [id, topic] of this.topics) {
          if (topic.history.length < 3) continue;
          // МУТАЦИЯ: explosiveness = 0 всегда
          predictions.push({
            topic: id, currentAttention: topic.attention,
            predictedAttention: topic.attention,
            explosiveness: 0,
            velocity: topic.velocity, momentum: topic.momentum,
            willExplode: false,
          });
        }
        return predictions.sort((a, b) => b.explosiveness - a.explosiveness).slice(0, topN);
      };
    },
    detect: (ADClass) => {
      const ad = new ADClass({ halfLifeHours: 1000 });
      // Быстро растущая тема
      for (let i = 0; i < 10; i++) ad.update('rising', 20, 0.01);
      const preds = ad.predictExplosive(5, 24);
      // Оригинал: explosiveness > 0 для rising
      // Мутация: explosiveness = 0
      return preds.length > 0 && preds[0].explosiveness === 0;
    },
  },

  {
    name: 'Half-life игнорируется (используется 24 по умолчанию)',
    apply: (ADClass) => {
      // Мутация: патчим update, используем half-life 24 всегда
      const originalUpdate = ADClass.prototype.update;
      ADClass.prototype.update = function(topicId, newMentions, hoursPassed = 0.25) {
        if (!this.topics.has(topicId)) {
          this.topics.set(topicId, {
            id: topicId, attention: 0, momentum: 0, velocity: 0,
            history: [], lastUpdate: Date.now(),
          });
        }
        const topic = this.topics.get(topicId);
        // МУТАЦИЯ: half-life всегда 24, независимо от this.halfLifeHours
        const decay = Math.exp(-hoursPassed / 24 * Math.log(2));
        const oldAttention = topic.attention;
        topic.attention = topic.attention * decay + newMentions;
        topic.momentum = topic.attention - oldAttention;
        topic.velocity = topic.momentum / Math.max(hoursPassed, 0.01);
        topic.history.push({ timestamp: Date.now(), attention: topic.attention, momentum: topic.momentum, velocity: topic.velocity });
        if (topic.history.length > 50) topic.history.shift();
        return topic;
      };
    },
    detect: (ADClass) => {
      // Конфигурируем с halfLifeHours = 1 (быстрое затухание)
      const ad = new ADClass({ halfLifeHours: 1 });
      ad.update('topic', 10, 0.01);
      const before = ad.topics.get('topic').attention;
      // 1 час без упоминаний
      ad.update('topic', 0, 1);
      const after1h = ad.topics.get('topic').attention;
      // Оригинал с halfLife=1: after1h = before * 0.5
      // Мутация с halfLife=24: after1h ~ before * 0.97
      const ratio = after1h / before;
      return ratio > 0.7;
    },
  },
];

const MUTATION_TARGET_SCORE = 0.7;

const JSON_MODE = typeof process !== 'undefined'
  && process.env
  && process.env.CRUCIX_MUTATION_JSON === '1';

async function runMutationTests() {
  const originalLog = console.log;
  if (JSON_MODE) console.log = () => {};

  try {
    console.log('=======================================================');
    console.log('  Mutation Testing - Attention Dynamics');
    console.log('=======================================================');
    console.log('');

    let killed = 0, survived = 0;
    const details = [];

    for (const mutation of MUTATIONS) {
      const moduleUrl = new URL('../../apis/predict/attention_dynamics.mjs?v=' + Date.now() + Math.random(), import.meta.url);
      const { AttentionDynamics: AD } = await import(moduleUrl.href);

      mutation.apply(AD);

      let caught = false, error = null;
      try {
        caught = mutation.detect(AD);
      } catch (e) {
        caught = true;
        error = e.message;
      }

      if (caught) {
        killed++;
        console.log(`  [KILLED]    ${mutation.name}`);
      } else {
        survived++;
        console.log(`  [SURVIVED]  ${mutation.name}`);
      }
      details.push({ name: mutation.name, killed: caught, error });
    }

    const total = killed + survived;
    const score = total > 0 ? killed / total : 0;
    console.log('');
    console.log(`  Mutation score: ${(score * 100).toFixed(1)}% (${killed}/${total})`);
    console.log(`  Target: ${(MUTATION_TARGET_SCORE * 100).toFixed(1)}%`);
    console.log('');

    return {
      killed,
      survived,
      errors: 0,
      total,
      score,
      details,
      mutations: details,
    };
  } finally {
    if (JSON_MODE) console.log = originalLog;
  }
}

const isDirectRun = (() => {
  if (typeof process === 'undefined' || !process.argv) return false;
  const argv1 = process.argv[1] || '';
  return argv1.endsWith('attention.mutate.mjs');
})();

if (isDirectRun) {
  if (JSON_MODE) {
    runMutationTests()
      .then((result) => {
        process.stdout.write(JSON.stringify(result) + '\n');
        process.exit(0);
      })
      .catch((e) => {
        process.stdout.write(JSON.stringify({
          killed: 0, survived: 0, errors: 1, total: 0, score: 0,
          crash: true, reason: e.message,
        }) + '\n');
        process.exit(0);
      });
  } else {
    runMutationTests()
      .then((result) => {
        const passed = result.score >= MUTATION_TARGET_SCORE;
        if (passed) {
          console.log('  PASSED');
          process.exit(0);
        } else {
          console.error(`  FAILED: mutation score below ${(MUTATION_TARGET_SCORE * 100).toFixed(1)}%`);
          process.exit(1);
        }
      })
      .catch((e) => {
        console.error('Mutation test crash:', e);
        process.exit(1);
      });
  }
}

export { runMutationTests };
