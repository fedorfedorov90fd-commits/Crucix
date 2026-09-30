// apis/predict/models/kalman.mjs
// Фильтр Калмана — оптимальная линейная оценка состояния по зашумлённым
// измерениям.
//
// Теоретическая основа:
//   Kalman, R. E. (1960). "A New Approach to Linear Filtering and Prediction
//   Problems". Journal of Basic Engineering, 82(1), 35-45.
//   Welch, G., & Bishop, G. (2006). "An Introduction to the Kalman Filter".
//   UNC-Chapel Hill, TR 95-041.
//
//   Модель:
//     x_{t+1} = F · x_t + w,   w ~ N(0, Q)   — процесс
//     z_t     = H · x_t + v,   v ~ N(0, R)   — наблюдение
//
//   Predict:
//     x̂⁻ = F · x̂
//     P⁻ = F · P · Fᵀ + Q
//
//   Update:
//     K = P⁻ · Hᵀ · (H · P⁻ · Hᵀ + R)⁻¹
//     x̂ = x̂⁻ + K · (z - H · x̂⁻)
//     P = (I - K · H) · P⁻
//
// Применение в Crucix:
//   Сглаживание VIX, HY-спреда. Модель «local level + trend»:
//     state = [level, trend]
//     F = [[1, 1], [0, 1]]
//     H = [[1, 0]]  — наблюдаем только level

// ============================================================
// Матричные операции
// ============================================================

function matMul(a, b) {
  const rows = a.length;
  const cols = b[0].length;
  const inner = b.length;
  const result = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (let k = 0; k < inner; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

function matVecMul(m, v) {
  return m.map((row) => row.reduce((s, val, i) => s + val * v[i], 0));
}

function matAdd(a, b) {
  return a.map((row, i) => row.map((val, j) => val + b[i][j]));
}

function matSub(a, b) {
  return a.map((row, i) => row.map((val, j) => val - b[i][j]));
}

function transpose(m) {
  if (!m.length) return [];
  return m[0].map((_, i) => m.map((row) => row[i]));
}

function matInv(m) {
  const n = m.length;
  const aug = m.map((row, i) => [
    ...row,
    ...Array(n).fill(0).map((_, j) => (i === j ? 1 : 0)),
  ]);

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(aug[k][i]) > Math.abs(aug[maxRow][i])) maxRow = k;
    }
    [aug[i], aug[maxRow]] = [aug[maxRow], aug[i]];
    if (Math.abs(aug[i][i]) < 1e-12) aug[i][i] += 1e-8;

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

function identity(n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
}

function vecSub(a, b) {
  return a.map((v, i) => v - b[i]);
}

function vecAdd(a, b) {
  return a.map((v, i) => v + b[i]);
}

// ============================================================
// Линейный фильтр Калмана
// ============================================================

class KalmanFilter {
  constructor({ F, H, Q, R, x0, P0 }) {
    this.F = F;
    this.H = H;
    this.Q = Q;
    this.R = R;
    this.x = [...x0];
    this.P = P0.map((row) => [...row]);
  }

  /**
   * Шаг предсказания.
   */
  predict() {
    this.x = matVecMul(this.F, this.x);
    this.P = matAdd(matMul(matMul(this.F, this.P), transpose(this.F)), this.Q);
    return {
      state: [...this.x],
      covariance: this.P.map((row) => [...row]),
    };
  }

  /**
   * Шаг обновления.
   */
  update(z) {
    const y = vecSub(z, matVecMul(this.H, this.x));
    const S = matAdd(matMul(matMul(this.H, this.P), transpose(this.H)), this.R);
    const SInv = matInv(S);
    const K = matMul(matMul(this.P, transpose(this.H)), SInv);

    this.x = vecAdd(this.x, matVecMul(K, y));

    const I = identity(this.x.length);
    this.P = matMul(matSub(I, matMul(K, this.H)), this.P);

    return {
      state: [...this.x],
      covariance: this.P.map((row) => [...row]),
      innovation: y,
      kalmanGain: K,
    };
  }

  /**
   * Полный цикл predict → update.
   */
  step(z) {
    this.predict();
    return this.update(z);
  }

  filter(observations) {
    return observations.map((z) => this.step(z));
  }

  /**
   * Прогноз на N шагов без обновлений.
   */
  forecast(steps) {
    const predictions = [];
    let x = [...this.x];
    let P = this.P.map((row) => [...row]);

    for (let i = 0; i < steps; i++) {
      x = matVecMul(this.F, x);
      P = matAdd(matMul(matMul(this.F, P), transpose(this.F)), this.Q);
      predictions.push({
        state: [...x],
        covariance: P.map((row) => [...row]),
      });
    }

    return predictions;
  }

  serialize() {
    return JSON.stringify({
      F: this.F,
      H: this.H,
      Q: this.Q,
      R: this.R,
      x: this.x,
      P: this.P,
    });
  }

  static deserialize(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    return new KalmanFilter(d);
  }
}

// ============================================================
// 1D-обёртка: local level + trend
// ============================================================

class Kalman1D {
  constructor({
    processNoise = 0.1,
    measurementNoise = 1.0,
    initialValue = 0,
    initialTrend = 0,
  } = {}) {
    this.kf = new KalmanFilter({
      F: [[1, 1], [0, 1]],
      H: [[1, 0]],
      Q: [
        [processNoise, 0],
        [0, processNoise * 0.1],
      ],
      R: [[measurementNoise]],
      x0: [initialValue, initialTrend],
      P0: [
        [10, 0],
        [0, 10],
      ],
    });
  }

  step(z) {
    const r = this.kf.step([z]);
    return {
      value: r.state[0],
      trend: r.state[1],
      variance: r.covariance[0][0],
    };
  }

  filter(series) {
    return series.map((z) => this.step(z));
  }

  /**
   * Прогноз на N шагов с 95% доверительными интервалами.
   */
  forecast(steps) {
    const preds = this.kf.forecast(steps);
    return preds.map((p) => ({
      value: p.state[0],
      trend: p.state[1],
      lower: p.state[0] - 1.96 * Math.sqrt(p.covariance[0][0]),
      upper: p.state[0] + 1.96 * Math.sqrt(p.covariance[0][0]),
    }));
  }
}

// ============================================================
// Готовый сценарий Crucix: сглаживание VIX
// ============================================================

/**
 * Прогон VIX через фильтр Калмана + прогноз.
 *
 * @param {number[]} vixSeries
 * @param {Object} opts
 * @param {number} opts.processNoise — шум процесса (default 0.5)
 * @param {number} opts.measurementNoise — шум измерения (default 2.0)
 * @param {number} opts.horizon — горизонт прогноза (default 5)
 * @returns {Object}
 */
function crucixVixKalman(vixSeries, opts = {}) {
  const {
    processNoise = 0.5,
    measurementNoise = 2.0,
    horizon = 5,
  } = opts;

  const clean = (vixSeries || []).filter((v) => typeof v === 'number' && isFinite(v));
  if (clean.length < 2) {
    return {
      available: false,
      reason: 'insufficient_data',
      count: clean.length,
    };
  }

  const kf = new Kalman1D({
    processNoise,
    measurementNoise,
    initialValue: clean[0],
    initialTrend: clean[1] - clean[0],
  });

  const filtered = kf.filter(clean);
  const forecast = kf.forecast(horizon);
  const lastFiltered = filtered[filtered.length - 1];

  return {
    available: true,
    currentValue: clean[clean.length - 1],
    smoothedValue: lastFiltered.value,
    trend: lastFiltered.trend,
    variance: lastFiltered.variance,
    forecast,
    regime: lastFiltered.trend > 0.5
      ? 'accelerating_up'
      : lastFiltered.trend < -0.5
      ? 'accelerating_down'
      : 'stable',
  };
}

export { KalmanFilter, Kalman1D, crucixVixKalman };
