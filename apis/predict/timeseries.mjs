// apis/predict/timeseries.mjs
// Прогнозирование временных рядов: ETS (экспоненциальное сглаживание) + AR(p).
//
// Теоретическая основа:
//   Hyndman, R. J., & Athanasopoulos, G. (2021). "Forecasting: Principles
//   and Practice" (3rd ed.). OTexts. Главы 8 (ETS) и 9 (ARIMA).
//   Box, G. E. P., Jenkins, G. M., Reinsel, G. C., & Ljung, G. M. (2015).
//   "Time Series Analysis: Forecasting and Control" (5th ed.). Wiley.
//
// Методы, реализованные в модуле:
//   1. SES  — Simple Exponential Smoothing (для рядов без тренда)
//   2. Holt — двойное сглаживание с линейным трендом
//   3. AR(p) — авторегрессия порядка p через МНК
//   4. Автовыбор — сравнение RMSE, выбор лучшей модели
//
// Применение в Crucix:
//   Прогноз VIX, HY-спреда, количества конфликтов, санкций и других метрик
//   на 3-5 шагов вперёд с доверительными интервалами.

// ============================================================
// Вспомогательные матричные операции (для AR через МНК)
// ============================================================

function transpose(m) {
  if (!m || m.length === 0) return [];
  return m[0].map((_, i) => m.map((row) => row[i]));
}

function matMul(a, b) {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) sum += a[i][k] * b[k][j];
      result[i][j] = sum;
    }
  }
  return result;
}

function matVecMul(m, v) {
  return m.map((row) => row.reduce((s, val, i) => s + val * v[i], 0));
}

function matInv(m) {
  const n = m.length;
  const aug = m.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    // Partial pivot
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];

    if (Math.abs(aug[i][i]) < 1e-12) aug[i][i] += 1e-6;

    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const f = aug[k][i] / aug[i][i];
      for (let j = i; j < 2 * n; j++) aug[k][j] -= f * aug[i][j];
    }

    const d = aug[i][i];
    for (let j = n; j < 2 * n; j++) aug[i][j] /= d;
  }

  return aug.map((row) => row.slice(n));
}

// ============================================================
// 1. SES — Simple Exponential Smoothing
// ============================================================

/**
 * Простое экспоненциальное сглаживание (для рядов без тренда).
 *
 * Формула:  level_t = α·y_t + (1-α)·level_{t-1}
 * Прогноз:  ŷ_{t+h} = level_t  (для любого h)
 *
 * @param {number[]} series
 * @param {number} alpha — коэффициент сглаживания 0..1
 * @param {number} horizon — сколько шагов вперёд
 * @returns {{forecast: number[], fitted: number[], level: number}}
 */
function simpleExponentialSmoothing(series, alpha = 0.3, horizon = 3) {
  if (!series || series.length === 0) {
    return { forecast: [], fitted: [], level: 0 };
  }

  let level = series[0];
  const fitted = [level];

  for (let i = 1; i < series.length; i++) {
    level = alpha * series[i] + (1 - alpha) * level;
    fitted.push(level);
  }

  const forecast = Array(horizon).fill(level);
  return { forecast, fitted, level };
}

// ============================================================
// 2. Holt — линейный тренд
// ============================================================

/**
 * Двойное экспоненциальное сглаживание Хольта (учитывает тренд).
 *
 * Формулы:
 *   level_t = α·y_t + (1-α)·(level_{t-1} + trend_{t-1})
 *   trend_t = β·(level_t - level_{t-1}) + (1-β)·trend_{t-1}
 * Прогноз: ŷ_{t+h} = level_t + h·trend_t
 *
 * @param {number[]} series
 * @param {number} alpha — сглаживание уровня
 * @param {number} beta  — сглаживание тренда
 * @param {number} horizon
 * @returns {{forecast: number[], fitted: number[], level: number, trend: number}}
 */
function holtLinear(series, alpha = 0.3, beta = 0.1, horizon = 3) {
  if (!series || series.length < 2) {
    const v = series && series.length ? series[0] : 0;
    return { forecast: Array(horizon).fill(v), fitted: [v], level: v, trend: 0 };
  }

  let level = series[0];
  let trend = series[1] - series[0];
  const fitted = [level, level + trend];

  for (let i = 2; i < series.length; i++) {
    const newLevel = alpha * series[i] + (1 - alpha) * (level + trend);
    trend = beta * (newLevel - level) + (1 - beta) * trend;
    level = newLevel;
    fitted.push(level + trend);
  }

  const forecast = [];
  for (let h = 1; h <= horizon; h++) forecast.push(level + h * trend);

  return { forecast, fitted, level, trend };
}

// ============================================================
// 3. AR(p) — авторегрессия через МНК
// ============================================================

/**
 * Авторегрессионная модель порядка p.
 *
 * Модель: y_t = c + Σ φ_j · y_{t-j} + ε_t
 * Оценка коэффициентов через нормальное уравнение МНК:
 *   β = (Xᵀ X)^{-1} Xᵀ y
 *
 * @param {number[]} series
 * @param {number} p — порядок AR
 * @param {number} horizon
 * @returns {{forecast: number[], coefficients: number[], intercept: number, residuals: number[]}}
 */
function autoregression(series, p = 2, horizon = 3) {
  const n = series.length;
  if (n < p + 2) {
    const v = n > 0 ? series[n - 1] : 0;
    return {
      forecast: Array(horizon).fill(v),
      coefficients: [],
      intercept: v,
      residuals: [],
    };
  }

  // Построение X, y для регрессии
  const X = [];
  const y = [];
  for (let i = p; i < n; i++) {
    const row = [1]; // intercept
    for (let j = 1; j <= p; j++) row.push(series[i - j]);
    X.push(row);
    y.push(series[i]);
  }

  // β = (XᵀX)^{-1} Xᵀy
  const Xt = transpose(X);
  const XtX = matMul(Xt, X);
  const XtXInv = matInv(XtX);
  const Xty = matVecMul(Xt, y);
  const beta = matVecMul(XtXInv, Xty);

  const intercept = beta[0];
  const coefficients = beta.slice(1);

  // Остатки
  const residuals = [];
  for (let i = 0; i < X.length; i++) {
    let pred = intercept;
    for (let j = 0; j < p; j++) pred += coefficients[j] * X[i][j + 1];
    residuals.push(y[i] - pred);
  }

  // Прогноз — рекурсивно
  const forecast = [];
  const history = series.slice();
  for (let h = 0; h < horizon; h++) {
    let pred = intercept;
    for (let j = 0; j < p; j++) {
      pred += coefficients[j] * history[history.length - 1 - j];
    }
    forecast.push(pred);
    history.push(pred);
  }

  return { forecast, coefficients, intercept, residuals };
}

// ============================================================
// Доверительные интервалы
// ============================================================

/**
 * Добавление доверительных интервалов к точечному прогнозу.
 * Использует остатки модели для оценки σ и расширяет интервал
 * с горизонтом (по корню из h — стандартная практика для random walk).
 *
 * @param {number[]} forecast — точечный прогноз
 * @param {number[]} residuals
 * @param {number} confidence — 0.90 | 0.95 | 0.99
 * @returns {Array<{value, lower, upper, std}>}
 */
function addConfidenceIntervals(forecast, residuals, confidence = 0.95) {
  const zScores = { 0.90: 1.645, 0.95: 1.96, 0.99: 2.576 };
  const z = zScores[confidence] || 1.96;

  const resid = (residuals || []).filter((r) => typeof r === 'number' && isFinite(r));
  if (resid.length === 0) {
    return forecast.map((value) => ({ value, lower: value, upper: value, std: 0 }));
  }

  const variance = resid.reduce((s, r) => s + r * r, 0) / Math.max(resid.length - 1, 1);
  const sigma = Math.sqrt(variance);

  return forecast.map((value, h) => {
    const widening = Math.sqrt(1 + h * 0.1);
    const margin = z * sigma * widening;
    return {
      value,
      lower: value - margin,
      upper: value + margin,
      std: sigma * widening,
    };
  });
}

// ============================================================
// Автовыбор лучшей модели
// ============================================================

/**
 * RMSE (Root Mean Squared Error) для массива остатков.
 */
function rmse(residuals) {
  const r = (residuals || []).filter((x) => typeof x === 'number' && isFinite(x));
  if (r.length === 0) return Infinity;
  return Math.sqrt(r.reduce((s, x) => s + x * x, 0) / r.length);
}

/**
 * Полный прогноз с автовыбором лучшей модели.
 *
 * Алгоритм:
 *   1. Обучить все три модели (SES, Holt, AR)
 *   2. Оценить качество каждой по RMSE остатков
 *   3. Выбрать лучшую, добавить доверительные интервалы
 *
 * @param {number[]} series
 * @param {number} horizon
 * @returns {{bestModel: string, forecast: number[], intervals: Array, allModels: Object}}
 */
function forecastSeries(series, horizon = 3) {
  if (!series || series.length < 5) {
    const mean = series && series.length
      ? series.reduce((a, b) => a + b, 0) / series.length
      : 0;
    return {
      bestModel: 'mean',
      forecast: Array(horizon).fill(mean),
      intervals: Array(horizon).fill({ value: mean, lower: mean, upper: mean, std: 0 }),
      allModels: { mean: { forecast: Array(horizon).fill(mean), rmse: 0 } },
    };
  }

  // --- SES ---
  const ses = simpleExponentialSmoothing(series, 0.3, horizon);
  const sesResiduals = series.map((v, i) => v - ses.fitted[i]);
  const sesRmse = rmse(sesResiduals);

  // --- Holt ---
  const holt = holtLinear(series, 0.3, 0.1, horizon);
  const holtResiduals = series.map((v, i) => v - holt.fitted[i]);
  const holtRmse = rmse(holtResiduals);

  // --- AR(2) ---
  const ar = autoregression(series, 2, horizon);
  const arRmse = rmse(ar.residuals);

  const allModels = {
    ses: { forecast: ses.forecast, rmse: sesRmse, residuals: sesResiduals },
    holt: { forecast: holt.forecast, rmse: holtRmse, residuals: holtResiduals },
    ar: { forecast: ar.forecast, rmse: arRmse, residuals: ar.residuals },
  };

  // --- Выбор лучшей по RMSE ---
  let bestModel = 'ses';
  let bestRmse = sesRmse;
  if (holtRmse < bestRmse) { bestModel = 'holt'; bestRmse = holtRmse; }
  if (arRmse < bestRmse) { bestModel = 'ar'; bestRmse = arRmse; }

  const bestForecast = allModels[bestModel].forecast;
  const bestResiduals = allModels[bestModel].residuals;

  return {
    bestModel,
    bestRmse,
    forecast: bestForecast,
    intervals: addConfidenceIntervals(bestForecast, bestResiduals, 0.95),
    allModels,
  };
}

// ============================================================
// Готовый сценарий для Crucix
// ============================================================

/**
 * Прогноз VIX по историческим sweep-данным.
 */
function forecastVix(history, horizon = 3) {
  const series = (history || [])
    .map((s) => (s && s.fred ? s.fred.vix : null))
    .filter((v) => typeof v === 'number' && !isNaN(v));
  if (series.length < 5) return { error: 'insufficient_data', count: series.length };
  return { metric: 'vix', horizon, ...forecastSeries(series, horizon) };
}

/**
 * Прогноз количества конфликтов GDELT.
 */
function forecastConflicts(history, horizon = 3) {
  const series = (history || []).map((s) =>
    s && s.gdelt && Array.isArray(s.gdelt.conflictEvents)
      ? s.gdelt.conflictEvents.length
      : 0
  );
  if (series.length < 5) return { error: 'insufficient_data', count: series.length };
  return { metric: 'conflicts', horizon, ...forecastSeries(series, horizon) };
}

/**
 * Прогноз HY-спреда.
 */
function forecastHySpread(history, horizon = 3) {
  const series = (history || [])
    .map((s) => (s && s.fred ? s.fred.hySpread : null))
    .filter((v) => typeof v === 'number' && !isNaN(v));
  if (series.length < 5) return { error: 'insufficient_data', count: series.length };
  return { metric: 'hySpread', horizon, ...forecastSeries(series, horizon) };
}

export {
  simpleExponentialSmoothing,
  holtLinear,
  autoregression,
  addConfidenceIntervals,
  forecastSeries,
  forecastVix,
  forecastConflicts,
  forecastHySpread,
  rmse,
};
