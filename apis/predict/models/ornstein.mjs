// apis/predict/models/ornstein.mjs
// Ornstein-Uhlenbeck процесс — mean-reverting диффузия.
//
// Теоретическая основа:
//   Uhlenbeck, G. E., & Ornstein, L. S. (1930). "On the Theory of the
//   Brownian Motion". Physical Review, 36(5), 823-841.
//   Vasicek, O. (1977). "An Equilibrium Characterization of the Term
//   Structure". Journal of Financial Economics, 5(2), 177-188.
//
//   dX_t = θ·(μ − X_t)·dt + σ·dW_t
//   где θ — скорость возврата, μ — долгосрочное среднее,
//       σ — волатильность, W — винеровский процесс.
//
//   Half-life = ln(2)/θ — время возврата к середине.
//   Стационарное распределение: N(μ, σ²/(2θ)).
//
// Применение в Crucix:
//   VIX, HY-спред, курсы валют возвращаются к среднему. OU даёт
//   вероятностный прогноз с 95% интервалом и оценку half-life.

// ============================================================
// Ornstein-Uhlenbeck
// ============================================================

class OrnsteinUhlenbeck {
  constructor({ theta = 0.1, mu = 20, sigma = 2 } = {}) {
    this.theta = theta;
    this.mu = mu;
    this.sigma = sigma;
  }

  /**
   * Оценка параметров через OLS на дискретизованной версии:
   *   Δx_t = a + b·x_{t-1} + ε
   *   θ = −b/Δt
   *   μ = −a/b
   *   σ = std(ε)/√Δt
   */
  fit(series, dt = 1) {
    const clean = (series || []).filter(
      (v) => typeof v === 'number' && isFinite(v)
    );
    if (clean.length < 5) return this;

    const dX = [];
    const xPrev = [];
    for (let i = 1; i < clean.length; i++) {
      dX.push(clean[i] - clean[i - 1]);
      xPrev.push(clean[i - 1]);
    }

    const n = xPrev.length;
    const meanX = xPrev.reduce((a, b) => a + b, 0) / n;
    const meanDX = dX.reduce((a, b) => a + b, 0) / n;

    let cov = 0;
    let varX = 0;
    for (let i = 0; i < n; i++) {
      cov += (xPrev[i] - meanX) * (dX[i] - meanDX);
      varX += (xPrev[i] - meanX) ** 2;
    }
    cov /= n;
    varX /= n;

    const b = cov / Math.max(varX, 1e-10);
    const a = meanDX - b * meanX;

    this.theta = Math.max(0.001, -b / dt);
    this.mu = Math.abs(b) > 1e-8 ? -a / b : meanX;

    const residuals = dX.map((dx, i) => dx - (a + b * xPrev[i]));
    const varRes = residuals.reduce((s, r) => s + r * r, 0) / n;
    this.sigma = Math.sqrt(varRes / dt);

    return {
      theta: this.theta,
      mu: this.mu,
      sigma: this.sigma,
      a,
      b,
    };
  }

  /**
   * Прогноз: E[X_{t+h}] = μ + (X_t − μ)·exp(−θ·h)
   * Var[X_{t+h}] = σ²/(2θ)·(1 − exp(−2θ·h))
   */
  forecast(currentValue, horizon) {
    const forecasts = [];
    for (let h = 1; h <= horizon; h++) {
      const mean = this.mu + (currentValue - this.mu) * Math.exp(-this.theta * h);
      const variance =
        (this.sigma ** 2) / (2 * this.theta) *
        (1 - Math.exp(-2 * this.theta * h));
      const std = Math.sqrt(variance);

      forecasts.push({
        h,
        mean,
        lower: mean - 1.96 * std,
        upper: mean + 1.96 * std,
        std,
      });
    }
    return forecasts;
  }

  /**
   * Half-life: ln(2)/θ.
   */
  halfLife() {
    return Math.log(2) / this.theta;
  }

  /**
   * Вероятность пересечения порога за горизонт.
   */
  probabilityOfThreshold(currentValue, threshold, horizon) {
    const forecasts = this.forecast(currentValue, horizon);
    let maxProb = 0;
    for (const f of forecasts) {
      const z = (threshold - f.mean) / Math.max(f.std, 1e-6);
      const prob = 1 - normalCDF(z);
      maxProb = Math.max(maxProb, prob);
    }
    return maxProb;
  }
}

// ============================================================
// Вспомогательные
// ============================================================

function normalCDF(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * OU-анализ VIX.
 *
 * @param {Array} history — sweep-история
 * @param {Object} opts — {horizon, threshold}
 * @returns {Object}
 */
function crucixOUAnalysis(history, opts = {}) {
  const { horizon = 5, threshold = 35 } = opts;

  if (!Array.isArray(history) || history.length < 15) {
    return {
      available: false,
      reason: 'insufficient_history',
      count: history?.length || 0,
    };
  }

  const vixSeries = history
    .map((h) => h.fred && h.fred.vix)
    .filter((v) => typeof v === 'number' && isFinite(v));

  if (vixSeries.length < 15) {
    return {
      available: false,
      reason: 'insufficient_vix',
      count: vixSeries.length,
    };
  }

  const ou = new OrnsteinUhlenbeck();
  ou.fit(vixSeries);

  const currentVix = vixSeries[vixSeries.length - 1];
  const forecasts = ou.forecast(currentVix, horizon);
  const halfLife = ou.halfLife();
  const probThreshold = ou.probabilityOfThreshold(currentVix, threshold, horizon);

  return {
    available: true,
    nObservations: vixSeries.length,
    currentVix,
    longRunMean: parseFloat(ou.mu.toFixed(2)),
    meanReversionSpeed: parseFloat(ou.theta.toFixed(4)),
    volatility: parseFloat(ou.sigma.toFixed(2)),
    halfLife: parseFloat(halfLife.toFixed(1)),
    forecast: forecasts.map((f) => ({
      step: f.h,
      mean: parseFloat(f.mean.toFixed(2)),
      lower: parseFloat(f.lower.toFixed(2)),
      upper: parseFloat(f.upper.toFixed(2)),
    })),
    probabilityAboveThreshold: parseFloat(probThreshold.toFixed(3)),
    threshold,
  };
}

export { OrnsteinUhlenbeck, crucixOUAnalysis, normalCDF, erf };
