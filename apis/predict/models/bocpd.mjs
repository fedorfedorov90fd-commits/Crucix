// apis/predict/models/bocpd.mjs
// Bayesian Online Changepoint Detection (BOCPD).
//
// Теоретическая основа:
//   Adams, R. P., & MacKay, D. J. C. (2007). "Bayesian Online Changepoint
//   Detection". arXiv:0710.3742.
//   Fearnhead, P., & Liu, Z. (2007). "On-line Inference for Multiple
//   Changepoint Problems". Journal of the Royal Statistical Society B,
//   69(4), 589-605.
//
//   Идея: поддерживаем распределение по «run length» r_t — числу
//   шагов с последней точки смены режима. Когда r_t становится
//   маленьким — детектирована смена режима.
//
//   P(r_t = 0 | data) — вероятность смены режима в момент t
//   P(r_t = k | data) — режим стабилен уже k шагов.
//
// Применение в Crucix:
//   Детектирование момента смены режима VIX в реальном времени, без
//   ручных порогов. Работает на онлайн-потоке sweep-данных.

// ============================================================
// Gaussian conjugate prior (Normal-Inverse-Gamma)
// ============================================================

/**
 * Для онлайн-обновления параметров нормального распределения.
 * Позволяет вычислить predictive probability N(x | μ, σ²) для нового x.
 */
class GaussianConjugate {
  constructor({ mu0 = 0, kappa0 = 1, alpha0 = 1, beta0 = 1 } = {}) {
    this.mu0 = mu0;
    this.kappa0 = kappa0;
    this.alpha0 = alpha0;
    this.beta0 = beta0;
    this.history = [];
  }

  /**
   * Student-t predictive distribution для run length r.
   * Упрощённая нормальная аппроксимация для устойчивости.
   */
  predProb(x, runLength) {
    const n = Math.min(Math.max(runLength, 0), this.history.length);
    if (n === 0) {
      return this._normalPdf(x, this.mu0, Math.sqrt(this.beta0 / this.alpha0 + 1e-6));
    }

    const data = this.history.slice(-n);
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    let variance = 0;
    if (data.length > 1) {
      variance = data.reduce((s, d) => s + (d - mean) ** 2, 0) / data.length;
    } else {
      variance = this.beta0 / this.alpha0;
    }

    const std = Math.sqrt(Math.max(variance + 1e-6, 1e-6));
    return this._normalPdf(x, mean, std);
  }

  _normalPdf(x, mean, std) {
    const z = (x - mean) / std;
    return Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
  }

  update(x) {
    this.history.push(x);
    // Ограничиваем историю (для скорости)
    if (this.history.length > 1000) this.history.shift();
  }
}

// ============================================================
// BOCPD
// ============================================================

class BOCPD {
  constructor({ hazardFn, model, maxRunLength = 1000 } = {}) {
    this.hazardFn = hazardFn || (() => 1 / 100);
    this.model = model || new GaussianConjugate();
    this.maxRunLength = maxRunLength;
    this.R = [{ 0: 1.0 }];       // распределение длин пробегов
    this.t = 0;
    this.changepoints = [];
  }

  /**
   * Обработка нового наблюдения.
   * Возвращает {changepointProbability, mostLikelyRunLength, runLengthDistribution}
   */
  update(x) {
    this.t++;
    const prevR = this.R[this.t - 1];
    const newR = {};
    let totalProb = 0;

    const maxPrev = Math.max(...Object.keys(prevR).map(Number), 0);

    // --- Продолжение пробега ---
    for (let r = 0; r <= Math.min(maxPrev, this.maxRunLength); r++) {
      const predProb = this.model.predProb(x, r);
      const growthProb = (prevR[r] || 0) * (1 - this.hazardFn(r)) * predProb;
      newR[r + 1] = growthProb;
      totalProb += growthProb;
    }

    // --- Новый пробег (changepoint) ---
    const prevSum = Object.values(prevR).reduce((a, b) => a + b, 0);
    const changepointProb =
      this.model.predProb(x, 0) * this.hazardFn(0) * prevSum;
    newR[0] = changepointProb;
    totalProb += changepointProb;

    // --- Нормализация ---
    if (totalProb > 0) {
      for (const key of Object.keys(newR)) {
        newR[key] /= totalProb;
      }
    }

    this.model.update(x);
    this.R.push(newR);

    // --- Ограничение размера R (память) ---
    if (this.R.length > this.maxRunLength * 2) {
      this.R = this.R.slice(-this.maxRunLength);
    }

    const cpProb = newR[0] || 0;

    // Наиболее вероятная длина пробега
    let mostLikelyR = 0;
    let maxProb = 0;
    for (const [r, p] of Object.entries(newR)) {
      if (p > maxProb) {
        maxProb = p;
        mostLikelyR = parseInt(r);
      }
    }

    // Детекция: если P(changepoint) > 0.3 — фиксируем точку
    if (cpProb > 0.3) {
      this.changepoints.push({ time: this.t, probability: cpProb });
    }

    return {
      changepointProbability: cpProb,
      mostLikelyRunLength: mostLikelyR,
      runLengthDistribution: newR,
      time: this.t,
      regimeStability:
        cpProb < 0.1 ? 'stable' : cpProb < 0.3 ? 'unstable' : 'shift_detected',
    };
  }

  /**
   * Обработка всего ряда.
   */
  detect(series) {
    const results = [];
    for (const x of series) {
      results.push(this.update(x));
    }

    const changepoints = results
      .filter((r) => r.changepointProbability > 0.3)
      .map((r) => r.time);

    return { results, changepoints };
  }

  /**
   * Сериализация состояния (только последнее распределение).
   */
  serialize() {
    return JSON.stringify({
      t: this.t,
      R: this.R.slice(-10),  // только последние 10 распределений
      changepoints: this.changepoints.slice(-20),
      modelHistory: this.model.history.slice(-200),
    });
  }

  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const model = new GaussianConjugate();
    model.history = data.modelHistory || [];
    const bocpd = new BOCPD({ model });
    bocpd.t = data.t || 0;
    bocpd.R = data.R || [{ 0: 1.0 }];
    bocpd.changepoints = data.changepoints || [];
    return bocpd;
  }
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * Детекция смены режима VIX в реальном времени.
 *
 * @param {Array} history — sweep-история
 * @param {Object} opts — {hazardRate, horizon}
 * @returns {Object}
 */
function crucixBOCPDAnalysis(history, opts = {}) {
  const { hazardRate = 1 / 50 } = opts;

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

  const model = new GaussianConjugate({
    mu0: 20,
    kappa0: 1,
    alpha0: 1,
    beta0: 10,
  });

  const bocpd = new BOCPD({
    model,
    hazardFn: () => hazardRate,
  });

  const { results, changepoints } = bocpd.detect(vixSeries);
  const lastResult = results[results.length - 1];
  const recentCps = changepoints.filter((cp) => cp > vixSeries.length - 10);

  return {
    available: true,
    nObservations: vixSeries.length,
    currentChangepointProb: parseFloat(lastResult.changepointProbability.toFixed(3)),
    mostLikelyRunLength: lastResult.mostLikelyRunLength,
    regimeStability: lastResult.regimeStability,
    changepointsDetected: changepoints.length,
    recentChangepoints: recentCps,
    hazardRate,
  };
}

export { GaussianConjugate, BOCPD, crucixBOCPDAnalysis };
