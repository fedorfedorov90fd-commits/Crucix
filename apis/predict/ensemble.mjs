// apis/predict/ensemble.mjs
// Ансамблирование прогностических моделей с динамическим взвешиванием.
//
// Теоретическая основа:
//   Bates, J. M., & Granger, C. W. J. (1969). "The Combination of Forecasts".
//   Operational Research Quarterly, 20(4), 451-468.
//   Timmermann, A. (2006). "Forecast Combinations". Handbook of Economic
//   Forecasting, Vol. 1, 135-196. Elsevier.
//
//   Ключевая идея: ансамбль прогнозов превосходит любую отдельную модель
//   при условии, что модели не полностью коррелированы. Классические методы
//   агрегации:
//     1. Weighted average — линейная комбинация
//     2. Logarithmic opinion pool — геометрическое среднее (байесовски оптимальное)
//     3. Median — устойчивость к выбросам
//
// Применение в Crucix:
//   Объединение прогнозов байесовского ядра, цепей Маркова, Монте-Карло,
//   временных рядов, каскадов и LLM-агентов в единый ответ.

// ============================================================
// Базовые методы агрегации
// ============================================================

/**
 * Взвешенное среднее прогнозов.
 * Классический метод Бейтса-Грейнджера.
 *
 * @param {Array<{source: string, forecast: number, weight?: number}>} predictions
 * @returns {number} — итоговая вероятность
 */
function weightedAverage(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return 0.5;

  let totalWeight = 0;
  let weightedSum = 0;

  for (const p of predictions) {
    if (!p || typeof p.forecast !== 'number') continue;
    const w = typeof p.weight === 'number' ? p.weight : 1;
    weightedSum += p.forecast * w;
    totalWeight += w;
  }

  return totalWeight === 0 ? 0.5 : weightedSum / totalWeight;
}

/**
 * Logarithmic Opinion Pool.
 * Геометрическое среднее — байесовски оптимальный метод при
 * независимых экспертах с собственными распределениями.
 *
 * Более консервативен: наказывает за разногласия.
 *
 * @param {Array<{forecast: number, weight?: number}>} predictions
 * @returns {number}
 */
function logOpinionPool(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return 0.5;

  let logNum = 0;      // Σ w · log(p_i)
  let logDen = 0;      // Σ w · log(1-p_i)
  let totalWeight = 0;

  for (const p of predictions) {
    if (!p || typeof p.forecast !== 'number') continue;
    const w = typeof p.weight === 'number' ? p.weight : 1;
    const f = Math.max(0.001, Math.min(0.999, p.forecast));
    logNum += w * Math.log(f);
    logDen += w * Math.log(1 - f);
    totalWeight += w;
  }

  if (totalWeight === 0) return 0.5;

  logNum /= totalWeight;
  logDen /= totalWeight;

  const expNum = Math.exp(logNum);
  const expDen = Math.exp(logDen);
  const prob = expNum / (expNum + expDen);
  return Math.max(0.001, Math.min(0.999, prob));
}

/**
 * Медиана прогнозов — устойчива к выбросам.
 *
 * @param {Array<{forecast: number}>} predictions
 * @returns {number}
 */
function medianForecast(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return 0.5;

  const sorted = predictions
    .filter((p) => p && typeof p.forecast === 'number')
    .map((p) => p.forecast)
    .sort((a, b) => a - b);

  if (sorted.length === 0) return 0.5;

  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Trimmed mean — отбрасываем крайние значения, усредняем центральные.
 * Robust метод для ансамблей с шумными моделями.
 *
 * @param {Array<{forecast: number}>} predictions
 * @param {number} trimFraction — доля отбрасываемых с каждой стороны (0..0.4)
 */
function trimmedMean(predictions, trimFraction = 0.1) {
  if (!Array.isArray(predictions) || predictions.length < 3) {
    return weightedAverage(predictions);
  }

  const sorted = predictions
    .filter((p) => p && typeof p.forecast === 'number')
    .map((p) => p.forecast)
    .sort((a, b) => a - b);

  const n = sorted.length;
  const k = Math.floor(n * trimFraction);
  const trimmed = sorted.slice(k, n - k);

  if (trimmed.length === 0) return sorted[Math.floor(n / 2)];

  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

// ============================================================
// Ансамбль с автоматическим выбором метода
// ============================================================

/**
 * Полный ансамбль прогнозов.
 *
 * @param {Object} params
 * @param {Array<{source: string, forecast: number, weight?: number}>} params.predictions
 * @param {Object} params.brierWeights — веса из ForecastTracker
 * @param {string} params.method — 'weighted' | 'logpool' | 'median' | 'trimmed' | 'auto'
 * @returns {Object} — {probability, method, disagreement, contributions}
 */
function ensembleForecast({ predictions, brierWeights = {}, method = 'auto' }) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return {
      probability: 0.5,
      method: 'default',
      disagreement: 0,
      contributions: [],
    };
  }

  // --- Применяем веса из Brier Score ---
  const weighted = predictions.map((p) => ({
    source: p.source || 'unknown',
    forecast: typeof p.forecast === 'number' ? p.forecast : 0.5,
    weight:
      brierWeights[p.source] !== undefined
        ? brierWeights[p.source]
        : typeof p.weight === 'number'
        ? p.weight
        : 1,
  }));

  // --- Мера разногласия (дисперсия прогнозов) ---
  const forecasts = weighted.map((p) => p.forecast);
  const mean = forecasts.reduce((a, b) => a + b, 0) / forecasts.length;
  const disagreement = Math.sqrt(
    forecasts.reduce((sum, f) => sum + (f - mean) ** 2, 0) / forecasts.length
  );

  // --- Выбор метода ---
  let result;
  let usedMethod = method;

  if (method === 'auto') {
    if (disagreement > 0.25) {
      // Сильные разногласия — устойчивость важнее
      result = trimmedMean(weighted, 0.15);
      usedMethod = 'trimmed';
    } else if (disagreement > 0.15) {
      // Умеренные разногласия — медиана
      result = medianForecast(weighted);
      usedMethod = 'median';
    } else {
      // Согласие моделей — log pool
      result = logOpinionPool(weighted);
      usedMethod = 'logpool';
    }
  } else {
    switch (method) {
      case 'weighted':
        result = weightedAverage(weighted);
        break;
      case 'logpool':
        result = logOpinionPool(weighted);
        break;
      case 'median':
        result = medianForecast(weighted);
        break;
      case 'trimmed':
        result = trimmedMean(weighted, 0.15);
        break;
      default:
        result = weightedAverage(weighted);
        usedMethod = 'weighted';
    }
  }

  // --- Вклады каждого источника ---
  const contributions = weighted
    .map((p) => ({
      source: p.source,
      forecast: p.forecast,
      weight: p.weight,
      deviation: p.forecast - result,
    }))
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

  return {
    probability: Math.max(0.001, Math.min(0.999, result)),
    method: usedMethod,
    disagreement,
    contributions,
    rawForecasts: forecasts,
  };
}

// ============================================================
// Специализированный ансамбль для события Crucix
// ============================================================

/**
 * Ансамбль для конкретного события: собирает прогнозы из всех моделей
 * и агрегирует их с учётом Brier-весов.
 *
 * @param {Object} models — {bayesian, markov, montecarlo, timeseries}
 * @param {Object} event — {id, name, prior, evidence, ...}
 * @param {Object} latestSweep — текущие данные
 * @param {Object} brierWeights — веса из ForecastTracker
 * @returns {Object}
 */
function crucixEventEnsemble(models, event, latestSweep, brierWeights = {}) {
  const predictions = [];

  // --- 1. Байесовское ядро ---
  if (models.bayesian && typeof models.bayesian.updateEvent === 'function' && event.evidence) {
    try {
      const bayesResult = models.bayesian.updateEvent(event, event.evidence);
      predictions.push({
        source: 'bayesian',
        forecast: bayesResult.posterior,
      });
    } catch (e) {
      // пропускаем
    }
  }

  // --- 2. Цепь Маркова ---
  if (models.markov && event.currentState) {
    try {
      const markovResult = models.markov.predictNext(event.currentState);
      const crisisProb =
        (markovResult.distribution && markovResult.distribution[event.targetState]) || 0;
      predictions.push({
        source: 'markov',
        forecast: crisisProb,
      });
    } catch (e) {
      // пропускаем
    }
  }

  // --- 3. Монте-Карло ---
  if (models.montecarlo) {
    try {
      const mcResult = models.montecarlo(latestSweep);
      const mcProb =
        (mcResult.probabilities && mcResult.probabilities[event.outcomeClass]) || 0;
      predictions.push({
        source: 'montecarlo',
        forecast: mcProb,
      });
    } catch (e) {
      // пропускаем
    }
  }

  // --- 4. Временной ряд ---
  if (models.timeseries && event.history) {
    try {
      const tsResult = models.timeseries.forecastSeries(event.history, event.horizon || 3);
      // Нормализация прогноза к вероятности
      const lastForecast = tsResult.forecast[0] || 0;
      const tsProb = Math.max(0.001, Math.min(0.999, lastForecast / 100));
      predictions.push({
        source: 'timeseries',
        forecast: tsProb,
      });
    } catch (e) {
      // пропускаем
    }
  }

  if (predictions.length === 0) {
    return {
      probability: event.prior || 0.5,
      method: 'prior',
      disagreement: 0,
      contributions: [],
    };
  }

  return ensembleForecast({
    predictions,
    brierWeights,
    method: 'auto',
  });
}

// ============================================================
// Утилиты
// ============================================================

/**
 * Кросс-валидация методов ансамбля на исторических данных.
 * Возвращает Brier Score каждого метода.
 */
function crossValidateEnsemble(historicalPredictions, method = 'auto') {
  const valid = historicalPredictions.filter(
    (p) =>
      p &&
      Array.isArray(p.predictions) &&
      typeof p.actual === 'number'
  );

  if (valid.length === 0) return null;

  let sumSquaredError = 0;

  for (const item of valid) {
    const result = ensembleForecast({
      predictions: item.predictions,
      method,
    });
    sumSquaredError += (result.probability - item.actual) ** 2;
  }

  return sumSquaredError / valid.length;
}

/**
 * Утилита: сравнение всех методов на одном наборе.
 */
function compareMethods(predictions, actual) {
  const methods = ['weighted', 'logpool', 'median', 'trimmed'];
  const results = {};

  for (const method of methods) {
    const r = ensembleForecast({ predictions, method });
    results[method] = {
      probability: r.probability,
      squaredError: (r.probability - actual) ** 2,
    };
  }

  // Auto
  const rAuto = ensembleForecast({ predictions, method: 'auto' });
  results.auto = {
    probability: rAuto.probability,
    squaredError: (rAuto.probability - actual) ** 2,
    selectedMethod: rAuto.method,
  };

  // Лучший по squared error
  let best = 'auto';
  let bestError = results.auto.squaredError;
  for (const m of methods) {
    if (results[m].squaredError < bestError) {
      bestError = results[m].squaredError;
      best = m;
    }
  }

  return {
    results,
    bestMethod: best,
    bestError,
  };
}

export {
  weightedAverage,
  logOpinionPool,
  medianForecast,
  trimmedMean,
  ensembleForecast,
  crucixEventEnsemble,
  crossValidateEnsemble,
  compareMethods,
};
