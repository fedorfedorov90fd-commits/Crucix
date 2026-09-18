// apis/predict/models/hawkes.mjs
// Процесс Хоукса (Hawkes process) — самовозбуждающийся точечный процесс.
//
// Теоретическая основа:
//   Hawkes, A. G. (1971). "Spectra of some self-exciting and mutually
//   exciting point processes". Biometrika, 58(1), 83-90.
//   Ogata, Y. (1988). "Statistical models for earthquake occurrences and
//   residual analysis for point processes". JASA, 83(401), 9-27.
//
//   λ(t) = μ + Σ θ · exp(-β · (t - t_i))  для t > t_i
//   где:
//     μ — фоновая интенсивность
//     θ — сила возбуждения (продуктивность события)
//     β — скорость затухания возбуждения
//     n = θ/β — branching factor (n ≥ 1 = взрывной режим)
//
// Применение в Crucix:
//   Конфликты GDELT рассматриваются как афтершоки. Эскалация →
//   всплеск новых конфликтов → новые афтершоки. Branching factor
//   показывает, затухает кластер или взрывается.

// ============================================================
// Процесс Хоукса с экспоненциальным ядром
// ============================================================

class HawkesProcess {
  constructor({ mu = 0.5, theta = 0.8, beta = 1.0 } = {}) {
    this.mu = mu;
    this.theta = theta;
    this.beta = beta;
    this.events = [];
  }

  /**
   * Условная интенсивность λ(t) в момент t.
   * O(N) — полный перебор прошлых событий.
   * Для больших N использовать рекурсивную форму (см. intensityRecursive).
   */
  intensity(t) {
    let lambda = this.mu;
    for (let i = this.events.length - 1; i >= 0; i--) {
      const ti = this.events[i];
      if (ti >= t) continue;
      lambda += this.theta * Math.exp(-this.beta * (t - ti));
    }
    return lambda;
  }

  /**
   * Рекурсивная версия интенсивности — O(1) при потоковой обработке.
   * state = {A, tLast}, где A — накопленное возбуждение.
   */
  intensityRecursive(t, state) {
    const decay = Math.exp(-this.beta * (t - state.tLast));
    const A = state.A * decay;
    return { lambda: this.mu + A, A };
  }

  /**
   * Добавление наблюдаемого события с поддержанием сортировки.
   */
  addEvent(t) {
    let i = this.events.length;
    while (i > 0 && this.events[i - 1] > t) i--;
    this.events.splice(i, 0, t);
  }

  /**
   * Лог-правдоподобие:
   *   L = Σ log λ(t_i) − ∫₀ᵀ λ(t) dt
   *   Компенсатор = μT + Σ (θ/β)(1 - exp(-β(T - t_i)))
   */
  logLikelihood() {
    if (this.events.length === 0) return 0;
    const T = this.events[this.events.length - 1];

    let logL = 0;
    for (let i = 0; i < this.events.length; i++) {
      const ti = this.events[i];
      let lambda = this.mu;
      for (let j = 0; j < i; j++) {
        lambda += this.theta * Math.exp(-this.beta * (ti - this.events[j]));
      }
      logL += Math.log(Math.max(lambda, 1e-10));
    }

    let integral = this.mu * T;
    for (const ti of this.events) {
      integral += (this.theta / this.beta) *
        (1 - Math.exp(-this.beta * (T - ti)));
    }
    logL -= integral;

    return logL;
  }

  /**
   * Оценка параметров методом сеточного поиска (grid search).
   * В продакшене заменить на L-BFGS или Adam.
   */
  fit(events, opts = {}) {
    const {
      muRange = [0.01, 0.05, 0.1, 0.3, 0.5, 1.0, 2.0],
      thetaRange = [0.1, 0.3, 0.5, 0.8, 1.0, 1.5],
      betaRange = [0.5, 1.0, 2.0, 3.0, 5.0, 10.0],
    } = opts;

    this.events = [...events].sort((a, b) => a - b);
    let bestParams = { mu: this.mu, theta: this.theta, beta: this.beta };
    let bestLL = -Infinity;

    for (const mu of muRange) {
      for (const theta of thetaRange) {
        for (const beta of betaRange) {
          this.mu = mu;
          this.theta = theta;
          this.beta = beta;
          const ll = this.logLikelihood();
          if (ll > bestLL) {
            bestLL = ll;
            bestParams = { mu, theta, beta };
          }
        }
      }
    }

    this.mu = bestParams.mu;
    this.theta = bestParams.theta;
    this.beta = bestParams.beta;
    return { ...bestParams, logLikelihood: bestLL };
  }

  /**
   * Прогноз ожидаемого числа событий в [T, T+horizon].
   */
  forecastCount(horizon) {
    if (this.events.length === 0) return this.mu * horizon;

    const T = this.events[this.events.length - 1];
    let expected = this.mu * horizon;

    for (const ti of this.events) {
      const dt = T - ti;
      const residual = this.theta * Math.exp(-this.beta * dt) *
        (1 - Math.exp(-this.beta * horizon)) / this.beta;
      expected += residual;
    }

    return expected;
  }

  /**
   * Вероятность хотя бы одного события (Пуассоновское приближение).
   */
  forecastProbability(horizon) {
    const expected = this.forecastCount(horizon);
    return 1 - Math.exp(-expected);
  }

  /**
   * Branching factor n = θ/β.
   *   n < 1 — стационарный режим (события затухают)
   *   n ≥ 1 — взрывной режим (каскад)
   */
  branchingFactor() {
    return this.theta / this.beta;
  }

  serialize() {
    return JSON.stringify({
      mu: this.mu,
      theta: this.theta,
      beta: this.beta,
      events: this.events,
      branchingFactor: this.branchingFactor(),
    });
  }

  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const hp = new HawkesProcess(data);
    hp.events = data.events || [];
    return hp;
  }
}

// ============================================================
// Конвертация sweep в события
// ============================================================

/**
 * Каждое конфликтное событие GDELT превращается в отдельную временную
 * метку (в секундах Unix). Внутри одного sweep небольшой разброс,
 * чтобы избежать коллизий.
 */
function sweepToHawkesEvents(history) {
  const events = [];
  for (const sweep of history) {
    if (!sweep || !sweep.timestamp) continue;
    const timestamp = new Date(sweep.timestamp).getTime() / 1000;
    const count = sweep.gdelt?.conflictEvents?.length || 0;
    for (let i = 0; i < Math.min(count, 20); i++) {
      events.push(timestamp + i * 0.1);
    }
  }
  return events;
}

export { HawkesProcess, sweepToHawkesEvents };
