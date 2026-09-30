// apis/predict/naivebayes.mjs
// Наивный байесовский классификатор (Gaussian Naive Bayes)
// для определения режима системы по признакам sweep.
//
// Теоретическая основа:
//   Duda, R. O., Hart, P. E., & Stork, D. G. (2001).
//   "Pattern Classification" (2nd ed.). Wiley. Глава 3.
//
//   Для каждого класса c и признака x_i:
//     P(c | x) ∝ P(c) · Π P(x_i | c)
//
//   Гауссовское предположение:  P(x_i | c) ~ N(μ_ci, σ²_ci)
//
// Применение в Crucix:
//   Классификация текущего режима системы (stable / deescalation /
//   unstable / escalation / crisis) по вектору признаков из sweep:
//   VIX, HY-спред, количество конфликтных событий, санкции, алерты.
//
// Особенности реализации:
//   * Обучение на исторических sweep-данных из runs/memory/
//   * Логарифмические вероятности для численной устойчивости
//   * Регуляризация дисперсии (var + eps) — защита от нулевой дисперсии
//   * Сериализация/десериализация модели для сохранения между сессиями

/**
 * Извлечение признаков из одного sweep в вектор.
 * Возвращает объект {feature_name: value}, который затем превращается
 * в числовой вектор в порядке, определяемом классом.
 *
 * @param {Object} sweep — запись из runs/memory/ или latest.json
 * @returns {Object} — {vix, hySpread, conflictCount, sanctionsCount, newAlerts, escalatedAlerts, ...}
 */
function sweepToFeatures(sweep) {
  const features = {};

  // --- Рыночные показатели (FRED) ---
  if (sweep && sweep.fred) {
    if (typeof sweep.fred.vix === 'number') features.vix = sweep.fred.vix;
    if (typeof sweep.fred.hySpread === 'number') features.hySpread = sweep.fred.hySpread;
    if (typeof sweep.fred.treasury10y === 'number') features.treasury10y = sweep.fred.treasury10y;
  }

  // --- Геополитические (GDELT) ---
  if (sweep && sweep.gdelt) {
    const events = Array.isArray(sweep.gdelt.conflictEvents)
      ? sweep.gdelt.conflictEvents
      : [];
    features.conflictCount = events.length;
    if (typeof sweep.gdelt.avgGoldsteinScore === 'number') {
      features.avgGoldsteinScore = sweep.gdelt.avgGoldsteinScore;
    } else {
      features.avgGoldsteinScore = 0;
    }
  }

  // --- Санкции ---
  if (sweep && sweep.sanctions) {
    features.sanctionsCount = sweep.sanctions.count || sweep.sanctions.recentCount || 0;
  }

  // --- Дельта-алерты (внутренние) ---
  if (sweep && sweep.delta) {
    features.newAlerts = sweep.delta.newAlerts || 0;
    features.escalatedAlerts = sweep.delta.escalatedAlerts || 0;
  }

  // --- Радиация (максимум по всем станциям) ---
  if (sweep && sweep.radiation) {
    const stations = Object.values(sweep.radiation);
    const cpmValues = stations
      .map((s) => (s && typeof s.cpm === 'number' ? s.cpm : 0))
      .filter((v) => v > 0);
    features.maxRadiation = cpmValues.length > 0 ? Math.max(...cpmValues) : 0;
  }

  // --- Энергетика ---
  if (sweep && sweep.energy && typeof sweep.energy.oilPrice === 'number') {
    features.oilPrice = sweep.energy.oilPrice;
  }

  // --- Защита от пустого вектора: если нет признаков — ставим нули ---
  if (Object.keys(features).length === 0) {
    features.vix = 20;
    features.conflictCount = 0;
  }

  return features;
}

/**
 * Gaussian Naive Bayes классификатор.
 * Хранит для каждого класса:
 *   - prior P(c)
 *   - для каждого признака: {mean, variance}
 */
class GaussianNaiveBayes {
  constructor(options = {}) {
    this.classes = [];                  // ['crisis', 'escalation', ...]
    this.features = [];                 // ['vix', 'hySpread', ...]
    this.parameters = {};               // { class: { feature: {mean, variance} } }
    this.priors = {};                   // { class: priorProb }
    this.trained = false;
    this.varSmoothing = options.varSmoothing || 1e-6;
  }

  /**
   * Обучение на исторических данных.
   *
   * @param {Array<{features: Object, label: string}>} trainingData
   * @returns {GaussianNaiveBayes} — this (fluent interface)
   */
  fit(trainingData) {
    if (!Array.isArray(trainingData) || trainingData.length === 0) {
      this.trained = false;
      return this;
    }

    // --- Группировка по классам ---
    const byClass = {};
    for (const row of trainingData) {
      if (!row || !row.features || !row.label) continue;
      if (!byClass[row.label]) byClass[row.label] = [];
      byClass[row.label].push(row.features);
    }

    this.classes = Object.keys(byClass);
    if (this.classes.length === 0) {
      this.trained = false;
      return this;
    }

    // --- Собираем множество всех признаков ---
    const featureSet = new Set();
    for (const row of trainingData) {
      if (!row || !row.features) continue;
      for (const key of Object.keys(row.features)) featureSet.add(key);
    }
    this.features = [...featureSet];

    // --- Вычисляем параметры для каждого класса ---
    const totalSamples = trainingData.length;
    for (const cls of this.classes) {
      const samples = byClass[cls];
      this.priors[cls] = samples.length / totalSamples;
      this.parameters[cls] = {};

      for (const feat of this.features) {
        const values = samples
          .map((s) => s[feat])
          .filter((v) => typeof v === 'number' && !isNaN(v));

        if (values.length === 0) {
          this.parameters[cls][feat] = { mean: 0, variance: 1 };
          continue;
        }

        // Среднее
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        // Дисперсия (ML-оценка с регуляризацией)
        const variance =
          values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;

        this.parameters[cls][feat] = {
          mean,
          variance: Math.max(variance, this.varSmoothing),
        };
      }
    }

    this.trained = true;
    return this;
  }

  /**
   * Гауссовская функция правдоподобия:
   *   N(x | μ, σ²) = 1 / √(2πσ²) · exp(-(x-μ)² / (2σ²))
   *
   * Возвращает логарифм PDF для численной устойчивости.
   *
   * @param {number} x
   * @param {number} mean
   * @param {number} variance
   * @returns {number} — log(N(x | μ, σ²))
   */
  _logGaussianPdf(x, mean, variance) {
    const v = Math.max(variance, 1e-10);
    const diff = x - mean;
    return -0.5 * Math.log(2 * Math.PI * v) - (diff * diff) / (2 * v);
  }

  /**
   * Предсказание класса и вероятностей для вектора признаков.
   *
   * @param {Object} features
   * @returns {{predicted: string, probabilities: Object, logProbs: Object, margin: number}}
   */
  predict(features) {
    if (!this.trained) {
      return {
        predicted: 'unknown',
        probabilities: {},
        logProbs: {},
        margin: 0,
      };
    }

    const logProbs = {};

    for (const cls of this.classes) {
      // Начинаем с log-prior
      let logProb = Math.log(this.priors[cls] || 1e-10);

      for (const feat of this.features) {
        const value = features[feat];
        if (typeof value !== 'number' || isNaN(value)) continue;

        const params = this.parameters[cls][feat];
        if (!params) continue;

        logProb += this._logGaussianPdf(value, params.mean, params.variance);
      }

      logProbs[cls] = logProb;
    }

    // --- Нормализация через log-sum-exp ---
    const maxLog = Math.max(...Object.values(logProbs));
    const expProbs = {};
    let sum = 0;
    for (const cls of this.classes) {
      expProbs[cls] = Math.exp(logProbs[cls] - maxLog);
      sum += expProbs[cls];
    }

    const probabilities = {};
    for (const cls of this.classes) {
      probabilities[cls] = sum > 0 ? expProbs[cls] / sum : 1 / this.classes.length;
    }

    // --- Определение предсказанного класса ---
    let predicted = this.classes[0];
    let maxProb = probabilities[predicted];
    for (const cls of this.classes) {
      if (probabilities[cls] > maxProb) {
        maxProb = probabilities[cls];
        predicted = cls;
      }
    }

    // --- Margin: разница между топ-1 и топ-2 ---
    const sorted = Object.values(probabilities).sort((a, b) => b - a);
    const margin = sorted.length > 1 ? sorted[0] - sorted[1] : sorted[0];

    return { predicted, probabilities, logProbs, margin };
  }

  /**
   * Сериализация модели в JSON-строку.
   */
  serialize() {
    return JSON.stringify({
      classes: this.classes,
      features: this.features,
      parameters: this.parameters,
      priors: this.priors,
      trained: this.trained,
      varSmoothing: this.varSmoothing,
    });
  }

  /**
   * Восстановление модели из JSON-строки.
   */
  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const model = new GaussianNaiveBayes({
      varSmoothing: data.varSmoothing || 1e-6,
    });
    model.classes = data.classes || [];
    model.features = data.features || [];
    model.parameters = data.parameters || {};
    model.priors = data.priors || {};
    model.trained = !!data.trained;
    return model;
  }

  /**
   * Возвращает человекочитаемое описание модели.
   */
  describe() {
    return {
      trained: this.trained,
      classes: this.classes,
      features: this.features,
      priors: this.priors,
    };
  }
}

export { GaussianNaiveBayes, sweepToFeatures };
