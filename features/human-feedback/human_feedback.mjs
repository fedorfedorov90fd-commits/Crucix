// features/human-feedback/human_feedback.mjs
//
// Human Feedback Learning для Crucix
//
// ===================================================================
// СТАТУС: заготовка, готова к интеграции, но не вызывается из engine.mjs
// ===================================================================
//
// ЗАМЫСЕЛ
// -------
// Модуль замыкает обучающий цикл прогностической системы через оператора.
// В мире LLM это RLHF (Reinforcement Learning from Human Feedback).
// Применённое не к языковой модели, а к прогностическому ансамблю.
//
// Короткая формулировка: оператор подтверждает или опровергает прогноз,
// система сразу корректирует веса признаков, не дожидаясь, пока событие
// произойдёт или не произойдёт.
//
// ПОЧЕМУ ЭТО ВАЖНО
// ----------------
// 1. Быстрое обучение на малых данных (пока нет 3-6 месяцев истории).
// 2. Обработка редких событий (Brier Score по ним почти не двигается).
// 3. Доверие оператора к системе (когда он видит, что его оценка меняет модель).
// 4. Соединение экспертного знания и модельного (контекст + вероятности).
// 5. Механизм "что если" (ручное изменение входных данных оператором).
//
// КОНКУРЕНТНОЕ ПРЕИМУЩЕСТВО
// -------------------------
// Ни Palantir, ни Recorded Future, ни Seldon Vault публично не делают
// этого. У них операторская валидация уходит в отчёт, а не в модель.
//
// АРХИТЕКТУРА (гибридный вариант -- рекомендуется)
// ------------------------------------------------
// Оператор ставит метку good / bad / uncertain, плюс может дать текстовый
// комментарий. Система обновляет веса признаков через градиентный шаг.
// Комментарии сохраняются в лог (отправка в LLM -- отдельная задача).
//
// ЧТО ЖДЁТ РЕАЛИЗАЦИИ СНАРУЖИ
// ---------------------------
// 1. Интерфейс оператора (dashboard/human_feedback.html).
// 2. Интеграция в engine.mjs (после фазы F калибровки).
// 3. Хранилище истории (runs/predictions/human_feedback.json).
// 4. Потребитель обновлённых весов (пока отсутствует).
//
// РЕШЕНИЯ AI ПО УМОЛЧАНИЮ
// -----------------------
// - Обновление весов ПОСЛЕ фазы F калибровки (учитывать калибровку).
// - Начинать только с весов признаков (не источников/моделей ансамбля).
// - Комментарии сохранять в лог, не отправлять в LLM на первом этапе.
// - Хранилище: runs/predictions/human_feedback.json.
//
// ИСТОРИЯ
// -------
// Замысел появился в 4часть.txt (строка 1266) как одна фраза. Кода не было.
// Этот файл -- попытка развернуть замысел до состояния, в котором его
// можно реализовать в любое время без потери контекста.

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------- КОНСТАНТЫ ----------

const FEEDBACK_DIR = join(__dirname, '..', '..', 'runs', 'predictions');
const FEEDBACK_FILE = join(FEEDBACK_DIR, 'human_feedback.json');
const DEFAULT_LEARNING_RATE = 0.05;
const DEFAULT_MOMENTUM = 0.9;
const MAX_HISTORY_ENTRIES = 500;

// ---------- КЛАСС HumanFeedbackLearner ----------

/**
 * HumanFeedbackLearner -- обучение на обратной связи от оператора.
 *
 * Основные методы:
 *   - recordFeedback(feedback) -- запись оценки оператора
 *   - updateWeights()          -- градиентный шаг
 *   - getCurrentWeights()      -- текущие веса признаков
 *   - getMetrics()             -- метрики (сколько сигналов, какие признаки двигаются)
 *   - toJSON() / fromJSON()    -- сериализация
 */
export class HumanFeedbackLearner {
  constructor(config = {}) {
    this.learningRate = config.learningRate ?? DEFAULT_LEARNING_RATE;
    this.momentum = config.momentum ?? DEFAULT_MOMENTUM;
    this.maxHistoryEntries = config.maxHistoryEntries ?? MAX_HISTORY_ENTRIES;

    // Веса признаков. Ключ -- имя признака (vix, conflictCount, ...)
    this.featureWeights = new Map();

    // Импульс для градиентного шага (стандартный SGD с momentum)
    this.featureVelocities = new Map();

    // История обратной связи
    this.feedbackHistory = [];

    // Счётчики
    this.totalFeedback = 0;
    this.goodCount = 0;
    this.badCount = 0;
    this.uncertainCount = 0;

    // Последнее обновление
    this.lastUpdate = null;
  }

  /**
   * Инициализация весов признаков из внешнего источника
   * (например, из permutationImportance в explainability.mjs)
   *
   * @param {Object} initialWeights -- { featureName: weight }
   */
  initializeWeights(initialWeights) {
    for (const [name, weight] of Object.entries(initialWeights)) {
      if (!this.featureWeights.has(name)) {
        this.featureWeights.set(name, weight);
        this.featureVelocities.set(name, 0);
      }
    }
  }

  /**
   * Запись оценки оператора.
   *
   * @param {Object} feedback -- {
   *   predictionId: string,     -- ID прогноза, к которому относится оценка
   *   signature: string,        -- 'good' | 'bad' | 'uncertain'
   *   comment: string,          -- опциональный текстовый комментарий
   *   context: Object,          -- { features, predictedProb, actualOutcome, ... }
   *   operatorId: string,       -- ID оператора (если несколько)
   * }
   * @returns {Object} -- { accepted, reason, weightsBefore, weightsAfter }
   */
  recordFeedback(feedback) {
    // Валидация
    if (!feedback || typeof feedback !== 'object') {
      return { accepted: false, reason: 'invalid_feedback' };
    }
    if (!['good', 'bad', 'uncertain'].includes(feedback.signature)) {
      return { accepted: false, reason: 'invalid_signature' };
    }
    if (!feedback.context || !feedback.context.features) {
      return { accepted: false, reason: 'missing_features' };
    }

    // Снимок весов до обновления
    const weightsBefore = Object.fromEntries(this.featureWeights);

    // Запись в историю
    const entry = {
      timestamp: Date.now(),
      predictionId: feedback.predictionId || null,
      signature: feedback.signature,
      comment: feedback.comment || null,
      context: {
        features: feedback.context.features,
        predictedProb: feedback.context.predictedProb ?? null,
        actualOutcome: feedback.context.actualOutcome ?? null,
      },
      operatorId: feedback.operatorId || 'default',
    };

    this.feedbackHistory.push(entry);
    if (this.feedbackHistory.length > this.maxHistoryEntries) {
      this.feedbackHistory.shift();
    }

    // Счётчики
    this.totalFeedback++;
    if (feedback.signature === 'good') this.goodCount++;
    else if (feedback.signature === 'bad') this.badCount++;
    else if (feedback.signature === 'uncertain') this.uncertainCount++;

    // Обновление весов
    const update = this.updateWeights(entry);

    // Снимок весов после
    const weightsAfter = Object.fromEntries(this.featureWeights);

    this.lastUpdate = new Date().toISOString();

    return {
      accepted: true,
      reason: 'ok',
      update,
      weightsBefore,
      weightsAfter,
    };
  }

  /**
   * Градиентный шаг обновления весов признаков.
   *
   * Логика:
   *   - good:     признаки, повлиявшие на прогноз, получают положительный градиент
   *   - bad:      те же признаки получают отрицательный градиент
   *   - uncertain: обновление минимальное (небольшой положительный градиент)
   *
   * Формула (упрощённый SGD с momentum):
   *   v_i = momentum * v_i + lr * grad_i
   *   w_i = w_i + v_i
   *
   * @param {Object} entry -- запись из feedbackHistory
   * @returns {Object} -- { updatedFeatures, totalDelta }
   */
  updateWeights(entry) {
    const { signature, context } = entry;
    const features = context.features || {};
    const featuresCount = Object.keys(features).length;

    if (featuresCount === 0) {
      return { updatedFeatures: 0, totalDelta: 0 };
    }

    // Коэффициент масштабирования
    let gradientScale;
    if (signature === 'good') gradientScale = 1.0;
    else if (signature === 'bad') gradientScale = -1.0;
    else gradientScale = 0.2; // uncertain -- мягкое обновление

    const updatedFeatures = [];
    let totalDelta = 0;

    for (const [name, value] of Object.entries(features)) {
      // Если признака ещё нет в весах, добавляем с нейтральным весом
      if (!this.featureWeights.has(name)) {
        this.featureWeights.set(name, 1.0);
        this.featureVelocities.set(name, 0);
      }

      const currentWeight = this.featureWeights.get(name);
      const currentVelocity = this.featureVelocities.get(name);

      // Градиент: чем сильнее признак отклоняется от нейтрального,
      // тем больше он влияет на прогноз, тем больше градиент.
      // Нормализованное значение признака -- если это уже в диапазоне [0,1]
      // или около того.
      const normalizedValue = Math.max(0, Math.min(1, value));
      const deviation = normalizedValue - 0.5;
      const grad = gradientScale * deviation * this.learningRate;

      // Обновление с momentum
      const newVelocity = this.momentum * currentVelocity + grad;
      const newWeight = currentWeight + newVelocity;

      // Ограничение веса, чтобы не улетел
      const clampedWeight = Math.max(0.05, Math.min(10.0, newWeight));

      this.featureWeights.set(name, clampedWeight);
      this.featureVelocities.set(name, newVelocity);

      const delta = clampedWeight - currentWeight;
      totalDelta += Math.abs(delta);

      updatedFeatures.push({
        name,
        value,
        oldWeight: currentWeight,
        newWeight: clampedWeight,
        delta,
      });
    }

    return {
      updatedFeatures: updatedFeatures.length,
      totalDelta,
      details: updatedFeatures,
    };
  }

  /**
   * Текущие веса признаков.
   */
  getCurrentWeights() {
    return Object.fromEntries(this.featureWeights);
  }

  /**
   * Метрики состояния обучения.
   */
  getMetrics() {
    const weights = [...this.featureWeights.values()];
    const meanWeight = weights.length > 0
      ? weights.reduce((s, w) => s + w, 0) / weights.length
      : 0;

    // Топ-признаки по весу
    const topFeatures = [...this.featureWeights.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, weight]) => ({ name, weight }));

    // Топ-признаки, которые сильнее всего изменились за последние 20 обновлений
    const recentMovers = [];
    if (this.feedbackHistory.length >= 2) {
      const recentEntries = this.feedbackHistory.slice(-20);
      const allFeatureNames = new Set();
      for (const entry of recentEntries) {
        for (const name of Object.keys(entry.context?.features || {})) {
          allFeatureNames.add(name);
        }
      }
      for (const name of allFeatureNames) {
        const current = this.featureWeights.get(name) || 1.0;
        // Для простоты -- берём нейтральный вес 1.0 как точку отсчёта
        const delta = Math.abs(current - 1.0);
        recentMovers.push({ name, weight: current, deltaFromNeutral: delta });
      }
      recentMovers.sort((a, b) => b.deltaFromNeutral - a.deltaFromNeutral);
    }

    // Согласованность сигналов
    const agreementRate = this.totalFeedback > 0
      ? (this.goodCount + this.badCount) / this.totalFeedback
      : 0;

    return {
      totalFeedback: this.totalFeedback,
      goodCount: this.goodCount,
      badCount: this.badCount,
      uncertainCount: this.uncertainCount,
      featureCount: this.featureWeights.size,
      meanWeight,
      topFeatures,
      recentMovers: recentMovers.slice(0, 5),
      agreementRate,
      lastUpdate: this.lastUpdate,
      interpretation: this._interpretMetrics(),
    };
  }

  _interpretMetrics() {
    if (this.totalFeedback === 0) {
      return 'Обратной связи ещё не было. Модуль ожидает сигнала оператора.';
    }
    if (this.totalFeedback < 5) {
      return 'Мало данных для значимых выводов. Продолжайте размечать прогнозы.';
    }
    if (this.agreementRate > 0.8) {
      return 'Высокая согласованность операторских оценок. Модель стабильна.';
    }
    if (this.agreementRate < 0.5) {
      return 'Противоречивые оценки оператора. Возможна неоднозначность прогнозов.';
    }
    return 'Умеренная согласованность. Продолжайте разметку.';
  }

  /**
   * Механизм "что если" -- пересчёт прогноза при изменении входных данных.
   * Это упрощённая версия, для полной нужен доступ к ансамблю.
   *
   * @param {Object} basePrediction -- { features, predictedProb }
   * @param {Object} overrides -- { featureName: newValue }
   * @returns {Object} -- { newFeatures, weightDelta, expectedShift }
   */
  whatIf(basePrediction, overrides) {
    if (!basePrediction || !basePrediction.features) {
      return { error: 'invalid_base_prediction' };
    }

    const baseFeatures = basePrediction.features;
    const baseProb = basePrediction.predictedProb ?? 0.5;

    const newFeatures = { ...baseFeatures };
    for (const [name, value] of Object.entries(overrides || {})) {
      newFeatures[name] = value;
    }

    // Пересчёт с учётом весов
    let weightedBase = 0;
    let weightedNew = 0;
    let totalWeight = 0;

    for (const [name, value] of Object.entries(baseFeatures)) {
      const weight = this.featureWeights.get(name) ?? 1.0;
      weightedBase += value * weight;
      totalWeight += weight;
    }
    for (const [name, value] of Object.entries(newFeatures)) {
      const weight = this.featureWeights.get(name) ?? 1.0;
      weightedNew += value * weight;
    }

    const baseComposite = totalWeight > 0 ? weightedBase / totalWeight : 0.5;
    const newComposite = totalWeight > 0 ? weightedNew / totalWeight : 0.5;

    const relativeShift = baseComposite > 0 ? (newComposite - baseComposite) / baseComposite : 0;
    const expectedProbShift = baseProb * relativeShift;

    return {
      baseFeatures,
      newFeatures,
      overrides,
      baseComposite,
      newComposite,
      relativeShift,
      expectedProbShift,
      newPredictedProb: Math.max(0, Math.min(1, baseProb + expectedProbShift)),
      interpretation: `При изменении входных данных прогноз сдвинется на ${(expectedProbShift * 100).toFixed(1)} п.п.`,
    };
  }

  /**
   * Сериализация состояния.
   */
  toJSON() {
    return JSON.stringify({
      learningRate: this.learningRate,
      momentum: this.momentum,
      maxHistoryEntries: this.maxHistoryEntries,
      featureWeights: Object.fromEntries(this.featureWeights),
      featureVelocities: Object.fromEntries(this.featureVelocities),
      feedbackHistory: this.feedbackHistory,
      totalFeedback: this.totalFeedback,
      goodCount: this.goodCount,
      badCount: this.badCount,
      uncertainCount: this.uncertainCount,
      lastUpdate: this.lastUpdate,
    }, null, 2);
  }

  /**
   * Восстановление состояния.
   */
  static fromJSON(json) {
    const data = JSON.parse(json);
    const learner = new HumanFeedbackLearner({
      learningRate: data.learningRate,
      momentum: data.momentum,
      maxHistoryEntries: data.maxHistoryEntries,
    });

    learner.featureWeights = new Map(Object.entries(data.featureWeights || {}));
    learner.featureVelocities = new Map(Object.entries(data.featureVelocities || {}));
    learner.feedbackHistory = data.feedbackHistory || [];
    learner.totalFeedback = data.totalFeedback || 0;
    learner.goodCount = data.goodCount || 0;
    learner.badCount = data.badCount || 0;
    learner.uncertainCount = data.uncertainCount || 0;
    learner.lastUpdate = data.lastUpdate || null;

    return learner;
  }

  /**
   * Сохранение в файл.
   */
  save(filepath = null) {
    const target = filepath || FEEDBACK_FILE;
    const dir = dirname(target);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(target, this.toJSON());
    return target;
  }

  /**
   * Загрузка из файла.
   */
  static load(filepath = null) {
    const target = filepath || FEEDBACK_FILE;
    if (!existsSync(target)) return new HumanFeedbackLearner();
    try {
      const json = readFileSync(target, 'utf-8');
      return HumanFeedbackLearner.fromJSON(json);
    } catch (e) {
      console.warn('[human_feedback] Load error:', e.message);
      return new HumanFeedbackLearner();
    }
  }
}

// ---------- ИНТЕГРАЦИОННАЯ ФУНКЦИЯ ----------

/**
 * Интеграция в конвейер Crucix. Вызывается из engine.mjs ПОСЛЕ фазы F
 * (калибровка), чтобы учесть уже откалиброванные вероятности.
 *
 * ВАЖНО: сейчас эта функция НЕ вызывается из engine.mjs. Она подготовлена
 * для того момента, когда будет решено, где именно в конвейере её запускать.
 *
 * @param {Object} latest -- данные последнего sweep
 * @param {Object} predictions -- прогнозы (после калибровки)
 * @param {Object} options -- { save: boolean, applyNewWeights: boolean }
 * @returns {Object} -- { loaded, feedbackApplied, weightsUpdate, metrics }
 */
export function crucixHumanFeedback(latest, predictions, options = {}) {
  const { save = true, applyNewWeights = false } = options;

  // Загрузка состояния
  const learner = HumanFeedbackLearner.load();

  // Проверка: есть ли свежая обратная связь от оператора
  // (оператор мог оставить метку через dashboard между sweep-циклами)
  // Пока этот механизм не подключён, функция просто возвращает текущее
  // состояние и метрики.

  const metrics = learner.getMetrics();
  const weights = learner.getCurrentWeights();

  // Сохранение
  if (save) {
    learner.save();
  }

  return {
    module: 'human_feedback',
    loaded: true,
    feedbackApplied: false, // пока обратная связь не подключена к engine
    currentWeights: weights,
    metrics,
    interpretation: metrics.interpretation,
    note: 'Модуль готов к интеграции. См. engine_integration.md в этой же папке.',
    timestamp: new Date().toISOString(),
  };
}

export default HumanFeedbackLearner;
