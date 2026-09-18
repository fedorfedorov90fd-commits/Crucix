// apis/predict/models/particle.mjs
// Particle Filter (Sequential Monte Carlo) — фильтрация нелинейных
// негауссовских систем.
//
// Теоретическая основа:
//   Gordon, N. J., Salmond, D. J., & Smith, A. F. M. (1993). "Novel approach
//   to nonlinear/non-Gaussian Bayesian state estimation". IEE Proceedings F,
//   140(2), 107-113.
//   Doucet, A., de Freitas, N., & Gordon, N. (2001). "Sequential Monte Carlo
//   Methods in Practice". Springer.
//   Arulampalam, M. S., et al. (2002). "A Tutorial on Particle Filters for
//   Online Nonlinear/Non-Gaussian Bayesian Tracking". IEEE Transactions on
//   Signal Processing, 50(2), 174-188.
//
//   Идея: распределение состояния представляется набором N взвешенных
//   частиц. Каждая частица эволюционирует по transition-модели, затем
//   веса обновляются по наблюдению. При вырождении — resampling.
//
// Применение в Crucix:
//   Нелинейная фильтрация VIX с учётом mean reversion и джампов.
//   В отличие от Калмана, Particle Filter не требует линейности и
//   гауссовости, что критично для кризисных режимов.

// ============================================================
// Particle Filter
// ============================================================

class ParticleFilter {
  constructor({ nParticles = 500, transitionFn, observationFn, initialParticles } = {}) {
    this.n = nParticles;
    this.transitionFn = transitionFn || ((p) => p);
    this.observationFn = observationFn || ((p) => p);
    this.particles = initialParticles || this._initParticles();
    this.weights = new Array(nParticles).fill(1 / nParticles);
  }

  _initParticles() {
    return Array.from({ length: this.n }, () => ({
      state: Math.random() * 10 - 5,
      params: {},
    }));
  }

  /**
   * Predict: propagate particles through transition.
   */
  predict() {
    for (let i = 0; i < this.n; i++) {
      this.particles[i] = this.transitionFn(this.particles[i]);
    }
  }

  /**
   * Update: reweight by observation likelihood.
   */
  update(observation) {
    let sumW = 0;
    for (let i = 0; i < this.n; i++) {
      const predicted = this.observationFn(this.particles[i]);
      const likelihood = this._gaussianLikelihood(observation, predicted);
      this.weights[i] *= likelihood;
      sumW += this.weights[i];
    }

    if (sumW > 0) {
      for (let i = 0; i < this.n; i++) this.weights[i] /= sumW;
    } else {
      this.weights.fill(1 / this.n);
    }
  }

  _gaussianLikelihood(obs, pred, std = 1.0) {
    const diff = obs - (typeof pred === 'number' ? pred : pred.state);
    return (
      Math.exp(-0.5 * (diff / std) ** 2) /
      (std * Math.sqrt(2 * Math.PI))
    );
  }

  /**
   * Систематический resampling — O(N), сохраняет разнообразие частиц.
   */
  resample() {
    const cumulative = [];
    let sum = 0;
    for (let i = 0; i < this.n; i++) {
      sum += this.weights[i];
      cumulative.push(sum);
    }

    const newParticles = [];
    const positions = Array.from({ length: this.n }, (_, i) =>
      (i + Math.random()) / this.n
    );

    let idx = 0;
    for (const pos of positions) {
      while (idx < this.n - 1 && pos > cumulative[idx]) idx++;
      newParticles.push({ ...this.particles[idx] });
    }

    this.particles = newParticles;
    this.weights.fill(1 / this.n);
  }

  /**
   * Полный шаг: predict → update → (resample если ESS < N/2).
   */
  step(observation) {
    this.predict();
    this.update(observation);

    // Effective Sample Size
    const ess = 1 / this.weights.reduce((s, w) => s + w * w, 0);
    if (ess < this.n / 2) this.resample();

    return { ess, resampled: ess < this.n / 2 };
  }

  /**
   * Оценка состояния: взвешенное среднее и дисперсия.
   */
  estimate() {
    let mean = 0;
    for (let i = 0; i < this.n; i++) {
      const s = typeof this.particles[i] === 'number'
        ? this.particles[i]
        : this.particles[i].state;
      mean += s * this.weights[i];
    }

    let variance = 0;
    for (let i = 0; i < this.n; i++) {
      const s = typeof this.particles[i] === 'number'
        ? this.particles[i]
        : this.particles[i].state;
      variance += this.weights[i] * (s - mean) ** 2;
    }

    return { mean, std: Math.sqrt(variance), variance };
  }

  /**
   * Фильтрация всего ряда.
   */
  filter(observations) {
    return observations.map((z) => {
      this.step(z);
      return this.estimate();
    });
  }

  /**
   * Прогноз на N шагов без наблюдений.
   */
  forecast(steps = 5) {
    let forecastParticles = this.particles.map((p) =>
      typeof p === 'number' ? p : { ...p }
    );
    const path = [];

    for (let s = 1; s <= steps; s++) {
      forecastParticles = forecastParticles.map((p) => this.transitionFn(p));
      const numeric = forecastParticles.map((p) =>
        typeof p === 'number' ? p : p.state
      );
      const mean = numeric.reduce((a, b) => a + b, 0) / numeric.length;
      const sorted = [...numeric].sort((a, b) => a - b);

      path.push({
        step: s,
        mean,
        p5: sorted[Math.floor(numeric.length * 0.05)],
        p25: sorted[Math.floor(numeric.length * 0.25)],
        p50: sorted[Math.floor(numeric.length * 0.50)],
        p75: sorted[Math.floor(numeric.length * 0.75)],
        p95: sorted[Math.floor(numeric.length * 0.95)],
      });
    }

    return path;
  }
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * Particle Filter для VIX с mean reversion + джампами.
 *
 * @param {Array} history — sweep-история
 * @param {Object} opts — {nParticles, horizon}
 * @returns {Object}
 */
function crucixParticleAnalysis(history, opts = {}) {
  const { nParticles = 300, horizon = 5 } = opts;

  if (!Array.isArray(history) || history.length < 10) {
    return {
      available: false,
      reason: 'insufficient_history',
      count: history?.length || 0,
    };
  }

  const vixSeries = history
    .map((h) => h.fred && h.fred.vix)
    .filter((v) => typeof v === 'number' && isFinite(v));

  if (vixSeries.length < 10) {
    return {
      available: false,
      reason: 'insufficient_vix',
      count: vixSeries.length,
    };
  }

  const currentVix = vixSeries[vixSeries.length - 1];
  const meanVix = vixSeries.reduce((a, b) => a + b, 0) / vixSeries.length;

  // Transition: OU + джампы
  const transitionFn = (p) => {
    const value = typeof p === 'number' ? p : p.state;
    const meanReversion = 0.05 * (meanVix - value);
    const diffusion = (Math.random() - 0.5) * 1.5;
    const jumpProb = 0.02;
    const jump = Math.random() < jumpProb
      ? (Math.random() < 0.7 ? -1 : 1) * (5 + Math.random() * 10)
      : 0;
    return {
      state: Math.max(8, Math.min(80, value + meanReversion + diffusion + jump)),
      params: {},
    };
  };

  const pf = new ParticleFilter({
    nParticles,
    transitionFn,
    observationFn: (p) => (typeof p === 'number' ? p : p.state),
  });

  // Инициализация вокруг текущего VIX
  pf.particles = Array.from({ length: nParticles }, () => ({
    state: currentVix + (Math.random() - 0.5) * 5,
    params: {},
  }));

  // Фильтрация
  const filtered = pf.filter(vixSeries.slice(-20));
  const estimate = pf.estimate();

  // Прогноз
  pf.predict();
  const forecastPath = pf.forecast(horizon);

  // Хвостовой риск
  const lastFc = forecastPath[forecastPath.length - 1];

  return {
    available: true,
    nObservations: vixSeries.length,
    nParticles,
    currentVix,
    currentEstimate: parseFloat(estimate.mean.toFixed(2)),
    currentStd: parseFloat(estimate.std.toFixed(2)),
    forecast: forecastPath,
    tailRisk: {
      p95AtHorizon: parseFloat(lastFc.p95.toFixed(2)),
      probabilityAbove35: lastFc.p95 > 35 ? 1 : 0,
    },
  };
}

export { ParticleFilter, crucixParticleAnalysis };
