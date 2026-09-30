// apis/predict/models/ising.mjs
// Модель Изинга — фазовые переходы в социальных/политических системах.
//
// Теоретическая основа:
//   Ising, E. (1925). "Beitrag zur Theorie des Ferromagnetismus".
//   Zeitschrift für Physik, 31(1), 253-258.
//   Onsager, L. (1944). "Crystal Statistics. I. A Two-Dimensional Model with
//   an Order-Disorder Transition". Physical Review, 65(3-4), 117-149.
//   Castellano, C., Fortunato, S., & Loreto, V. (2009). "Statistical physics
//   of social dynamics". Reviews of Modern Physics, 81(2), 591-646.
//
//   Гамильтониан: H = −J · Σ s_i · s_j − h · Σ s_i
//   где s_i ∈ {−1, +1} — «спин» (настроение актора),
//       J — константа связи, h — внешнее поле.
//
//   При температуре T < Tc — порядок (консенсус).
//   При T > Tc — беспорядок (фрагментация).
//   Критическая температура T_c ≈ J · ⟨k⟩ (mean-field).
//
// Применение в Crucix:
//   N акторов (стран/рынков), спин = настроение (+1 оптимизм, −1 пессимизм).
//   Температура T растёт с VIX и конфликтами. Близость к T_c — сигнал
//   приближающегося коллективного разворота.

// ============================================================
// Модель Изинга
// ============================================================

class IsingModel {
  constructor({ nNodes, adjacency, temperature = 1.0, coupling = 0.5 } = {}) {
    this.n = nNodes;
    this.adjacency = adjacency || this._randomGraph(nNodes, 0.3);
    this.T = temperature;
    this.J = coupling;
    this.spins = new Array(nNodes).fill(0).map(() => (Math.random() > 0.5 ? 1 : -1));
    this.history = [];
  }

  /**
   * Случайный граф Эрдёша-Реньи.
   */
  _randomGraph(n, p) {
    const adj = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.random() < p) {
          adj[i][j] = 1;
          adj[j][i] = 1;
        }
      }
    }
    return adj;
  }

  /**
   * Энергия системы: H = −J · Σ_{i<j} A_ij · s_i · s_j
   */
  energy() {
    let E = 0;
    for (let i = 0; i < this.n; i++) {
      for (let j = i + 1; j < this.n; j++) {
        E -= this.J * this.adjacency[i][j] * this.spins[i] * this.spins[j];
      }
    }
    return E;
  }

  /**
   * Намагниченность — мера консенсуса:
   *   M ≈ +1: все «бычьи»
   *   M ≈ −1: все «медвежьи»
   *   M ≈ 0: фрагментация
   */
  magnetization() {
    return this.spins.reduce((a, b) => a + b, 0) / this.n;
  }

  /**
   * Шаг Метрополиса-Гастингса.
   */
  metropolisStep() {
    const i = Math.floor(Math.random() * this.n);

    let neighborSum = 0;
    for (let j = 0; j < this.n; j++) {
      if (this.adjacency[i][j]) neighborSum += this.spins[j];
    }

    const dE = 2 * this.J * this.spins[i] * neighborSum;

    if (dE < 0 || Math.random() < Math.exp(-dE / Math.max(this.T, 1e-10))) {
      this.spins[i] *= -1;
    }
  }

  /**
   * Симуляция MCMC.
   */
  simulate(steps = 1000) {
    const magHistory = [];
    for (let step = 0; step < steps; step++) {
      this.metropolisStep();
      if (step % 10 === 0) {
        magHistory.push({
          step,
          M: this.magnetization(),
          E: this.energy(),
        });
      }
    }
    this.history.push(...magHistory);
    return {
      finalMagnetization: this.magnetization(),
      finalEnergy: this.energy(),
      magHistory,
    };
  }

  /**
   * Критическая температура (mean-field приближение).
   *   T_c = J · ⟨k⟩, где ⟨k⟩ — средняя степень узла.
   */
  criticalTemperature() {
    let avgDeg = 0;
    for (let i = 0; i < this.n; i++) {
      avgDeg += this.adjacency[i].reduce((a, b) => a + b, 0);
    }
    avgDeg /= this.n;
    return this.J * avgDeg;
  }

  /**
   * Восприимчивость (susceptibility):
   *   χ = (⟨M²⟩ − ⟨M⟩²) · N / T
   * Стремится к бесконечности при T → T_c.
   */
  susceptibility() {
    const M = this.magnetization();
    const M2 = this.spins.reduce((s, si) => s + si * si, 0) / this.n;
    return ((M2 - M * M) * this.n) / Math.max(this.T, 1e-10);
  }

  /**
   * Прогноз вероятности коллективного разворота.
   */
  predictFlipProbability() {
    const Tc = this.criticalTemperature();
    const ratio = this.T / Tc;
    const M = this.magnetization();
    const chi = this.susceptibility();

    // Близость к критической точке
    const proximityToCritical = Math.exp(-Math.abs(ratio - 1) * 5);
    const lowMagnetization = 1 - Math.abs(M);

    return {
      flipProbability: Math.max(
        0,
        Math.min(1, proximityToCritical * (0.5 + 0.5 * lowMagnetization))
      ),
      temperature: this.T,
      criticalTemperature: Tc,
      ratio: parseFloat(ratio.toFixed(3)),
      magnetization: M,
      susceptibility: chi,
      nearPhaseTransition: ratio > 0.7 && ratio < 1.3,
    };
  }

  /**
   * Установка температуры по данным sweep.
   *   VIX 10-50 → T 0.5-3.0 + конфликты повышают.
   */
  setTemperatureFromSweep(latest) {
    const vix = (latest.fred && latest.fred.vix) || 20;
    const conflicts =
      (latest.gdelt && latest.gdelt.conflictEvents && latest.gdelt.conflictEvents.length) || 0;
    this.T = 0.5 + (vix / 50) * 2.5 + Math.min(conflicts / 20, 1) * 0.5;
  }
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * Оценка «температуры» системы по sweep + прогноз фазового перехода.
 *
 * @param {Object} latest — latest.json
 * @param {Object} opts — {nNodes, coupling, steps}
 * @returns {Object}
 */
function crucixIsingAnalysis(latest, opts = {}) {
  const { nNodes = 12, coupling = 0.5, steps = 500 } = opts;

  const ising = new IsingModel({ nNodes, coupling, temperature: 1.0 });
  ising.setTemperatureFromSweep(latest);
  ising.simulate(steps);

  const flip = ising.predictFlipProbability();

  return {
    available: true,
    nNodes,
    temperature: flip.temperature,
    criticalTemperature: flip.criticalTemperature,
    ratio: flip.ratio,
    magnetization: parseFloat(flip.magnetization.toFixed(3)),
    susceptibility: parseFloat(flip.susceptibility.toFixed(3)),
    nearPhaseTransition: flip.nearPhaseTransition,
    flipProbability: parseFloat(flip.flipProbability.toFixed(3)),
    regime: flip.nearPhaseTransition ? 'critical' : flip.ratio > 1.3 ? 'disordered' : 'ordered',
  };
}

export { IsingModel, crucixIsingAnalysis };
