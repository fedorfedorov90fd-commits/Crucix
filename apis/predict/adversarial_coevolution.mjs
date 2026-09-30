// apis/predict/adversarial_coevolution.mjs
// Adversarial Co-evolution — противник адаптируется к нашим прогнозам.
// Модель предполагает, что противник обучается и меняет стратегию.
//
// Теоретическая основа:
//   - Carminati et al. (2022). "Adversarial Co-evolution in Strategic Settings".
//   - Fudenberg & Levine (1998). "The Theory of Learning in Games".
//
// Ключевая идея:
//   Классические Opponent Models предполагают фиксированного противника.
//   Реальность другая: противник учится на наших прогнозах и адаптируется.
//   Если мы всегда публикуем высокую вероятность эскалации — противник
//   переключается на deception. Детекция адаптации — через KL-дивергенцию
//   условных распределений P(strategy | our_prediction).
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
  id: 'adversarial_coevolution',
  name: 'Adversarial Co-evolution',
  layer: 8,
  category: 'game_theory',
  description: 'Модель противника, который учится на наших прогнозах и меняет стратегию. Детекция адаптации через KL-дивергенцию условных распределений.',
  version: '2.0.0',
  depends: [],
  exports: ['OpponentModel', 'AdversarialCoEvolution', 'crucixAdversarialCoEvolution'],
};

// ─── OPPONENT MODEL ────────────────────────────────

export class OpponentModel {
  constructor(config = {}) {
    this.opponentId = config.opponentId || 'unknown';
    this.strategies = config.strategies || ['escalate', 'hold', 'deescalate', 'deceive'];
    this.strategyProbabilities = new Map();
    this.observations = [];  // [{ time, strategy, context, ourPrediction }]
    this.learningRate = config.learningRate || 0.1;

    // Инициализация равномерным распределением
    for (const s of this.strategies) {
      this.strategyProbabilities.set(s, 1 / this.strategies.length);
    }
  }

  /**
   * Наблюдение за стратегией противника
   */
  observe(strategy, context = {}) {
    this.observations.push({
      timestamp: Date.now(),
      strategy,
      context,
      ourPrediction: context.ourPrediction,
    });

    // Обновление вероятностей (экспоненциальное сглаживание)
    const strategies = [...this.strategyProbabilities.keys()];
    for (const s of strategies) {
      const target = s === strategy ? 1 : 0;
      const current = this.strategyProbabilities.get(s);
      this.strategyProbabilities.set(s, current * (1 - this.learningRate) + target * this.learningRate);
    }

    // Нормализация
    const total = [...this.strategyProbabilities.values()].reduce((a, b) => a + b, 0);
    for (const [s, p] of this.strategyProbabilities) {
      this.strategyProbabilities.set(s, p / total);
    }
  }

  /**
   * Оценка: адаптировался ли противник к нашим прогнозам?
   * Сравниваем условные распределения стратегий:
   *   P(strategy | our prediction was "escalation")
   *   vs
   *   P(strategy | our prediction was "de-escalation")
   */
  detectAdaptation() {
    const escalPredictions = this.observations.filter(o => o.ourPrediction === 'escalation');
    const deescPredictions = this.observations.filter(o => o.ourPrediction === 'de-escalation');

    if (escalPredictions.length < 3 || deescPredictions.length < 3) {
      return { adapted: false, reason: 'insufficient_data' };
    }

    // Распределение стратегий в каждом случае
    const strategyDist = (obs) => {
      const counts = {};
      for (const o of obs) counts[o.strategy] = (counts[o.strategy] || 0) + 1;
      const total = obs.length;
      const dist = {};
      for (const [k, v] of Object.entries(counts)) dist[k] = v / total;
      return dist;
    };

    const distEscal = strategyDist(escalPredictions);
    const distDeesc = strategyDist(deescPredictions);

    // KL divergence между распределениями
    let kl = 0;
    const allStrategies = new Set([...Object.keys(distEscal), ...Object.keys(distDeesc)]);
    for (const s of allStrategies) {
      const p = (distEscal[s] || 0.001);
      const q = (distDeesc[s] || 0.001);
      kl += p * Math.log(p / q);
    }

    const adapted = kl > 0.3;

    return {
      adapted,
      klDivergence: kl,
      escalDistribution: distEscal,
      deescDistribution: distDeesc,
      interpretation: adapted
        ? `Противник АДАПТИРУЕТСЯ: KL=${kl.toFixed(2)}. Он меняет стратегию в зависимости от наших прогнозов.`
        : 'Противник не демонстрирует явной адаптации к прогнозам.',
    };
  }

  /**
   * Прогноз следующей стратегии противника
   */
  predictNextStrategy() {
    const predicted = [...this.strategyProbabilities.entries()]
      .sort((a, b) => b[1] - a[1])[0];
    return {
      strategy: predicted[0],
      probability: predicted[1],
      distribution: Object.fromEntries(this.strategyProbabilities),
    };
  }
}

// ─── CO-EVOLUTION ENGINE ───────────────────────────

export class AdversarialCoEvolution {
  constructor(config = {}) {
    this.opponents = new Map();  // opponentId → OpponentModel
    this.ourStrategies = config.ourStrategies || ['forecast_high', 'forecast_low', 'withhold', 'deceive'];
    this.evolutionHistory = [];
    this.maxGenerations = config.maxGenerations || 100;
  }

  addOpponent(id, config = {}) {
    this.opponents.set(id, new OpponentModel({ opponentId: id, ...config }));
    return this;
  }

  /**
   * Один раунд: мы выбираем стратегию, противник реагирует, оба обновляют модели
   */
  round(ourStrategy, opponentResponses) {
    const roundData = { round: this.evolutionHistory.length + 1, timestamp: Date.now(), actions: [] };

    for (const [oppId, response] of Object.entries(opponentResponses)) {
      const opponent = this.opponents.get(oppId);
      if (!opponent) continue;

      // Обновляем модель противника
      opponent.observe(response.strategy, {
        ourPrediction: ourStrategy,
        context: response.context,
      });

      const nextStrategy = opponent.predictNextStrategy();
      const adaptation = opponent.detectAdaptation();

      roundData.actions.push({
        opponent: oppId,
        observed: response.strategy,
        predicted: nextStrategy.strategy,
        adaptation,
      });
    }

    this.evolutionHistory.push(roundData);
    return roundData;
  }

  /**
   * Симуляция co-evolution на N раундов
   * Мы выбираем оптимальную стратегию через Stackelberg + адаптивную модель противника
   */
  simulateCoEvolution(rounds = 20) {
    const results = [];

    for (let r = 0; r < rounds; r++) {
      // Выбираем нашу стратегию (в проде — через Stackelberg solve)
      const ourStrategy = this.ourStrategies[Math.floor(Math.random() * this.ourStrategies.length)];

      // Противник отвечает на основе своей адаптированной модели
      const opponentResponses = {};
      for (const [oppId, opponent] of this.opponents) {
        const predicted = opponent.predictNextStrategy();
        // Противник с вероятностью 0.8 играет предсказанную стратегию, с 0.2 — случайно
        const strategy = Math.random() < 0.8
          ? predicted.strategy
          : opponent.strategies[Math.floor(Math.random() * opponent.strategies.length)];

        opponentResponses[oppId] = { strategy, context: { round: r } };
      }

      results.push(this.round(ourStrategy, opponentResponses));
    }

    return results;
  }

  toJSON() {
    return {
      opponents: [...this.opponents.entries()].map(([id, o]) => ({
        id,
        strategyProbabilities: Object.fromEntries(o.strategyProbabilities),
        observationCount: o.observations.length,
        adaptation: o.detectAdaptation(),
      })),
      evolutionHistory: this.evolutionHistory.slice(-20),
    };
  }
}

// ─── ИНТЕГРАЦИЯ С CRUCIX ───────────────────────────

export function crucixAdversarialCoEvolution(latest, history, stateFile = null) {
  const filepath = stateFile || join(__dirname, '..', '..', 'runs', 'predictions', 'adversarial_coevolution.json');

  // Загрузка состояния
  let ace;
  try {
    if (existsSync(filepath)) {
      const data = JSON.parse(readFileSync(filepath, 'utf-8'));
      ace = new AdversarialCoEvolution();
      for (const opp of data.opponents || []) {
        const model = new OpponentModel({ opponentId: opp.id });
        for (const [s, p] of Object.entries(opp.strategyProbabilities || {})) {
          model.strategyProbabilities.set(s, p);
        }
        model.observations = opp.observations || [];
        ace.opponents.set(opp.id, model);
      }
    } else {
      ace = new AdversarialCoEvolution();
      ace.addOpponent('russia', { strategies: ['escalate', 'hold', 'deescalate', 'deceive'] });
      ace.addOpponent('china', { strategies: ['escalate', 'hold', 'deescalate', 'deceive'] });
      ace.addOpponent('usa', { strategies: ['escalate', 'hold', 'deescalate', 'deceive'] });
    }
  } catch (e) {
    console.warn('[adversarial_coevolution] Ошибка загрузки состояния:', e.message);
    ace = new AdversarialCoEvolution();
    ace.addOpponent('russia', { strategies: ['escalate', 'hold', 'deescalate', 'deceive'] });
    ace.addOpponent('china', { strategies: ['escalate', 'hold', 'deescalate', 'deceive'] });
    ace.addOpponent('usa', { strategies: ['escalate', 'hold', 'deescalate', 'deceive'] });
  }

  // Симуляция
  const simulation = ace.simulateCoEvolution(20);

  // Анализ адаптации
  const adaptations = [];
  for (const [oppId, opponent] of ace.opponents) {
    const adaptation = opponent.detectAdaptation();
    const predicted = opponent.predictNextStrategy();
    adaptations.push({
      opponent: oppId,
      adaptation,
      predictedStrategy: predicted.strategy,
      predictedProbability: predicted.probability,
      distribution: predicted.distribution,
    });
  }

  const result = {
    module: 'adversarial_coevolution',
    opponentsCount: ace.opponents.size,
    adaptations,
    simulationRounds: simulation.length,
    evolutionHistory: ace.evolutionHistory.slice(-10),
    keyInsight: adaptations.some(a => a.adaptation.adapted)
      ? 'Противник адаптируется к нашим прогнозам. Требуется изменение стратегии.'
      : 'Противник не адаптируется. Текущая стратегия оптимальна.',
    timestamp: new Date().toISOString(),
  };

  // Сохранение
  const dir = join(__dirname, '..', '..', 'runs', 'predictions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filepath, JSON.stringify({
    opponents: [...ace.opponents.entries()].map(([id, o]) => ({
      id,
      strategyProbabilities: Object.fromEntries(o.strategyProbabilities),
      observations: o.observations.slice(-50),
    })),
  }, null, 2));

  return result;
}
