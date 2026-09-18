// apis/predict/models/evt.mjs
// Extreme Value Theory — моделирование хвостов распределений.
//
// Теоретическая основа:
//   Fisher, R. A., & Tippett, L. H. C. (1928). "Limiting Forms of the
//   Frequency Distribution of the Largest or Smallest Member of a Sample".
//   Proceedings of the Cambridge Philosophical Society, 24(2), 180-190.
//   Pickands, J. (1975). "Statistical Inference Using Extreme Order
//   Statistics". Annals of Statistics, 3(1), 119-131.
//   Embrechts, P., Klüppelberg, C., & Mikosch, T. (1997). "Modelling
//   Extremal Events for Insurance and Finance". Springer.
//
//   Block Maxima (GEV):
//     G(z) = exp(−(1 + ξ·(z−μ)/σ)^(−1/ξ))
//
//   Peaks Over Threshold (GPD):
//     F(x) = 1 − (1 + ξ·x/σ)^(−1/ξ)
//
//   ξ > 0 — тяжёлый хвост (Fréchet)
//   ξ = 0 — экспоненциальный (Gumbel)
//   ξ < 0 — ограниченный (Weibull)
//
// Применение в Crucix:
//   Оценка вероятности экстремальных событий (VIX > 40, конфликты > 25)
//   на основе хвоста исторического распределения.

// ============================================================
// Generalized Pareto Distribution (GPD)
// ============================================================

class GPD {
  constructor({ sigma = 1, xi = 0.1 } = {}) {
    this.sigma = sigma;
    this.xi = xi;
  }

  pdf(x) {
    if (x < 0) return 0;
    if (Math.abs(this.xi) < 1e-8) {
      return (1 / this.sigma) * Math.exp(-x / this.sigma);
    }
    return (1 / this.sigma) *
      Math.pow(1 + (this.xi * x) / this.sigma, -1 / this.xi - 1);
  }

  cdf(x) {
    if (x < 0) return 0;
    if (Math.abs(this.xi) < 1e-8) {
      return 1 - Math.exp(-x / this.sigma);
    }
    return 1 - Math.pow(1 + (this.xi * x) / this.sigma, -1 / this.xi);
  }

  quantile(p) {
    if (p >= 1) return Infinity;
    if (Math.abs(this.xi) < 1e-8) {
      return -this.sigma * Math.log(1 - p);
    }
    return (this.sigma / this.xi) * (Math.pow(1 - p, -this.xi) - 1);
  }

  /**
   * Оценка параметров методом моментов.
   * @param {number[]} exceedances — значения сверх порога
   */
  fit(exceedances) {
    const clean = (exceedances || []).filter(
      (v) => typeof v === 'number' && isFinite(v) && v > 0
    );
    if (clean.length < 5) return this;

    const n = clean.length;
    const mean = clean.reduce((a, b) => a + b, 0) / n;
    const variance = clean.reduce((s, x) => s + (x - mean) ** 2, 0) / n;

    // Method of moments
    const cv2 = variance / (mean * mean);
    this.xi = 0.5 * (cv2 - 1);
    this.sigma = mean * (1 - this.xi);

    // Клиппинг для устойчивости
    this.xi = Math.max(-0.5, Math.min(0.5, this.xi));
    this.sigma = Math.max(0.01, this.sigma);

    return this;
  }

  /**
   * Уровень возврата: значение, превышаемое раз в T периодов.
   */
  returnLevel(T, rate) {
    const prob = 1 / (T * rate);
    return this.quantile(1 - prob);
  }
}

// ============================================================
// Generalized Extreme Value (GEV)
// ============================================================

class GEV {
  constructor({ mu = 0, sigma = 1, xi = 0 } = {}) {
    this.mu = mu;
    this.sigma = sigma;
    this.xi = xi;
  }

  cdf(x) {
    const z = (x - this.mu) / this.sigma;
    if (Math.abs(this.xi) < 1e-8) return Math.exp(-Math.exp(-z));
    return Math.exp(-Math.pow(1 + this.xi * z, -1 / this.xi));
  }

  quantile(p) {
    if (Math.abs(this.xi) < 1e-8) {
      return this.mu - this.sigma * Math.log(-Math.log(p));
    }
    return this.mu + (this.sigma / this.xi) *
      (Math.pow(-Math.log(p), -this.xi) - 1);
  }

  /**
   * Оценка по block maxima (годовым/месячным максимумам).
   */
  fit(blockMaxima) {
    const clean = (blockMaxima || []).filter(
      (v) => typeof v === 'number' && isFinite(v)
    );
    if (clean.length < 3) return this;

    const n = clean.length;
    this.mu = clean.reduce((a, b) => a + b, 0) / n;
    const variance = clean.reduce((s, x) => s + (x - this.mu) ** 2, 0) / n;
    this.sigma = Math.sqrt(variance);

    const skew = clean.reduce(
      (s, x) => s + Math.pow((x - this.mu) / this.sigma, 3),
      0
    ) / n;
    this.xi = Math.max(-0.5, Math.min(0.5, skew / 2));

    return this;
  }

  /**
   * Период возврата для данного значения.
   */
  returnPeriod(x) {
    const p = this.cdf(x);
    return 1 / Math.max(1 - p, 1e-10);
  }
}

// ============================================================
// Peaks-over-threshold анализ
// ============================================================

/**
 * Вероятность экстремального события.
 *
 * @param {number[]} series — временной ряд
 * @param {number} threshold — порог экстремальности (например, VIX > 40)
 * @param {number} horizonDays — горизонт прогноза
 * @returns {Object}
 */
function extremeEventProbability(series, threshold, horizonDays = 30) {
  const clean = (series || []).filter((v) => typeof v === 'number' && isFinite(v));

  if (clean.length < 10) {
    return { probability: 0, method: 'insufficient_data', count: clean.length };
  }

  // Peaks over threshold
  const exceedances = clean.filter((v) => v > threshold).map((v) => v - threshold);
  const rate = exceedances.length / clean.length;

  if (exceedances.length < 3) {
    // Частотная оценка
    const prob = 1 - Math.pow(1 - rate, horizonDays);
    return {
      probability: prob,
      method: 'frequency',
      rate,
      exceedances: exceedances.length,
    };
  }

  // GPD fit
  const gpd = new GPD();
  gpd.fit(exceedances);

  // Вероятность хотя бы одного превышения за horizonDays
  const probPerDay = rate;
  const probAtLeastOne = 1 - Math.pow(1 - probPerDay, horizonDays);

  // Return levels для 95% и 99%
  const rl95 = gpd.returnLevel(0.05, rate || 0.01);
  const rl99 = gpd.returnLevel(0.01, rate || 0.01);

  return {
    probability: probAtLeastOne,
    method: 'GPD',
    rate,
    tailIndex: gpd.xi,
    heavyTail: gpd.xi > 0.1,
    sigma: gpd.sigma,
    returnLevel95: rl95,
    returnLevel99: rl99,
  };
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * EVT-анализ VIX с несколькими порогами.
 *
 * @param {Array} history — sweep-история
 * @param {Object} opts — {horizonDays}
 * @returns {Object}
 */
function crucixEVTAnalysis(history, opts = {}) {
  const { horizonDays = 30 } = opts;

  if (!Array.isArray(history) || history.length < 20) {
    return {
      available: false,
      reason: 'insufficient_history',
      count: history?.length || 0,
    };
  }

  const vixSeries = history
    .map((h) => h.fred && h.fred.vix)
    .filter((v) => typeof v === 'number' && isFinite(v));

  if (vixSeries.length < 20) {
    return {
      available: false,
      reason: 'insufficient_vix',
      count: vixSeries.length,
    };
  }

  const thresholds = [25, 30, 35, 40, 50];
  const results = {};

  for (const t of thresholds) {
    results[`above${t}`] = extremeEventProbability(vixSeries, t, horizonDays);
  }

  return {
    available: true,
    nObservations: vixSeries.length,
    currentVix: vixSeries[vixSeries.length - 1],
    maxHistorical: Math.max(...vixSeries),
    thresholds: results,
    horizonDays,
  };
}

export { GPD, GEV, extremeEventProbability, crucixEVTAnalysis };
