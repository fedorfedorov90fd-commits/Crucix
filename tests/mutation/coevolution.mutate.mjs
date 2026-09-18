// tests/mutation/coevolution.mutate.mjs
//
// Mutation testing для Adversarial Co-evolution.
//
// Критические мутации:
//   1. KL-divergence вычисляется неправильно
//   2. Порог адаптации сдвинут (0.03 вместо 0.3)
//   3. Экспоненциальное сглаживание не работает
//   4. predictNextStrategy возвращает случайную стратегию
//   5. Наблюдения не влияют на вероятности
//
// ЗАПУСК:
//   node tests/mutation/coevolution.mutate.mjs
//   или через run_all.mjs
//
// РЕЖИМЫ:
//   Обычный: печатает отчёт в stdout, process.exit(0|1) по порогу.
//   JSON-режим (CRUCIX_MUTATION_JSON=1): печатает только JSON, не выходит
//   с кодом 1. Используется оркестратором run_all.mjs.

import { OpponentModel, AdversarialCoEvolution } from '../../apis/predict/adversarial_coevolution.mjs';

const MUTATIONS = [
  {
    name: 'KL-divergence: порог 0.03 вместо 0.3',
    apply: (OMClass) => {
      OMClass.prototype.detectAdaptation = function() {
        const escalPredictions = this.observations.filter(o => o.ourPrediction === 'escalation');
        const deescPredictions = this.observations.filter(o => o.ourPrediction === 'de-escalation');
        if (escalPredictions.length < 3 || deescPredictions.length < 3) {
          return { adapted: false, reason: 'insufficient_data' };
        }
        const strategyDist = (obs) => {
          const counts = {};
          for (const o of obs) counts[o.strategy] = (counts[o.strategy] || 0) + 1;
          const dist = {};
          for (const [k, v] of Object.entries(counts)) dist[k] = v / obs.length;
          return dist;
        };
        const distEscal = strategyDist(escalPredictions);
        const distDeesc = strategyDist(deescPredictions);
        let kl = 0;
        const allStrategies = new Set([...Object.keys(distEscal), ...Object.keys(distDeesc)]);
        for (const s of allStrategies) {
          const p = distEscal[s] || 0.001;
          const q = distDeesc[s] || 0.001;
          kl += p * Math.log(p / q);
        }
        // МУТАЦИЯ: порог 0.03 вместо 0.3
        const adapted = kl > 0.03;
        return { adapted, klDivergence: kl };
      };
    },
    detect: (OMClass) => {
      const om = new OMClass({ opponentId: 'test' });
      // Небольшое различие: 60/40 vs 40/60
      for (let i = 0; i < 10; i++) om.observe('escalate', { ourPrediction: 'escalation' });
      for (let i = 0; i < 7; i++) om.observe('hold', { ourPrediction: 'escalation' });
      for (let i = 0; i < 10; i++) om.observe('hold', { ourPrediction: 'de-escalation' });
      for (let i = 0; i < 7; i++) om.observe('escalate', { ourPrediction: 'de-escalation' });

      const result = om.detectAdaptation();
      // Оригинал: KL < 0.3 -> adapted = false
      // Мутация: KL > 0.03 -> adapted = true
      return result.adapted === true;
    },
  },

  {
    name: 'Наблюдения не влияют на вероятности',
    apply: (OMClass) => {
      OMClass.prototype.observe = function(strategy, context = {}) {
        this.observations.push({
          timestamp: Date.now(), strategy, context,
          ourPrediction: context.ourPrediction,
        });
        // МУТАЦИЯ: без обновления вероятностей
      };
    },
    detect: (OMClass) => {
      const om = new OMClass({ opponentId: 'test' });
      const before = om.strategyProbabilities.get('escalate');
      for (let i = 0; i < 50; i++) om.observe('escalate');
      const after = om.strategyProbabilities.get('escalate');
      // Оригинал: after >> before (0.25 -> ~0.95)
      // Мутация: after == before
      return Math.abs(after - before) < 0.001;
    },
  },

  {
    name: 'predictNextStrategy возвращает случайную',
    apply: (OMClass) => {
      OMClass.prototype.predictNextStrategy = function() {
        // МУТАЦИЯ: случайная стратегия
        const strategies = [...this.strategyProbabilities.keys()];
        const random = strategies[Math.floor(Math.random() * strategies.length)];
        return {
          strategy: random,
          probability: 1 / strategies.length,
          distribution: Object.fromEntries(this.strategyProbabilities),
        };
      };
    },
    detect: (OMClass) => {
      const om = new OMClass({ opponentId: 'test' });
      // Наблюдаем только 'deceive'
      for (let i = 0; i < 50; i++) om.observe('deceive');

      // Проверяем 10 раз -- мутация даст случайную
      let nonDeceive = 0;
      for (let i = 0; i < 10; i++) {
        const pred = om.predictNextStrategy();
        if (pred.strategy !== 'deceive') nonDeceive++;
      }
      // Оригинал: 0 non-deceive
      // Мутация: > 0
      return nonDeceive > 0;
    },
  },

  {
    name: 'Сглаживание: lr = 1 (мгновенное обновление)',
    apply: (OMClass) => {
      OMClass.prototype.observe = function(strategy, context = {}) {
        this.observations.push({
          timestamp: Date.now(), strategy, context,
          ourPrediction: context.ourPrediction,
        });
        const strategies = [...this.strategyProbabilities.keys()];
        for (const s of strategies) {
          const target = s === strategy ? 1 : 0;
          // МУТАЦИЯ: lr = 1 (мгновенно)
          this.strategyProbabilities.set(s, target);
        }
      };
    },
    detect: (OMClass) => {
      const om = new OMClass({ opponentId: 'test' });
      om.observe('escalate');
      om.observe('hold');
      // Оригинал: P(escalate) ~ 0.5 после двух наблюдений
      // Мутация: P(escalate) = 0 (последнее наблюдение)
      const pEscalate = om.strategyProbabilities.get('escalate');
      return pEscalate === 0;
    },
  },

  {
    name: 'Hard reset вместо плавного сглаживания',
    apply: (OMClass) => {
      OMClass.prototype.observe = function(strategy, context = {}) {
        this.observations.push({
          timestamp: Date.now(), strategy, context,
          ourPrediction: context.ourPrediction,
        });
        const strategies = [...this.strategyProbabilities.keys()];
        for (const s of strategies) {
          // МУТАЦИЯ: hard reset вместо плавного сглаживания
          this.strategyProbabilities.set(s, s === strategy ? 1 : 0);
        }
      };
    },
    detect: (OMClass) => {
      const om = new OMClass({ opponentId: 'test' });
      for (let i = 0; i < 30; i++) om.observe('escalate');
      // Оригинал: плавное затухание, P(hold) ~ 0.25 * 0.9^30 = 0.0106
      // Мутация (hard reset): P(hold) = 0 ровно
      const pHold = om.strategyProbabilities.get('hold');
      return pHold < 0.001;
    },
  },

  {
    name: 'detectAdaptation всегда возвращает false',
    apply: (OMClass) => {
      OMClass.prototype.detectAdaptation = function() {
        return { adapted: false, reason: 'always_false' };
      };
    },
    detect: (OMClass) => {
      const om = new OMClass({ opponentId: 'test' });
      // Сильная адаптация
      for (let i = 0; i < 15; i++) om.observe('escalate', { ourPrediction: 'escalation' });
      for (let i = 0; i < 15; i++) om.observe('deceive', { ourPrediction: 'de-escalation' });

      const result = om.detectAdaptation();
      // Оригинал: adapted = true (KL >> 0.3)
      // Мутация: adapted = false
      return result.adapted === false;
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
    console.log('  Mutation Testing - Adversarial Co-evolution');
    console.log('=======================================================');
    console.log('');

    let killed = 0, survived = 0;
    const details = [];

    for (const mutation of MUTATIONS) {
      const moduleUrl = new URL('../../apis/predict/adversarial_coevolution.mjs?v=' + Date.now() + Math.random(), import.meta.url);
      const { OpponentModel: OM } = await import(moduleUrl.href);

      mutation.apply(OM);

      let caught = false, error = null;
      try {
        caught = mutation.detect(OM);
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
  return argv1.endsWith('coevolution.mutate.mjs');
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
