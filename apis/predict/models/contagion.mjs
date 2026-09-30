// apis/predict/models/contagion.mjs
// SIR/SEIR модели распространения — для нарративов, паники, санкций.
//
// Теоретическая основа:
//   Kermack, W. O., & McKendrick, A. G. (1927). "A Contribution to the
//   Mathematical Theory of Epidemics". Proceedings of the Royal Society A,
//   115(772), 700-721.
//   Anderson, R. M., & May, R. M. (1991). "Infectious Diseases of Humans:
//   Dynamics and Control". Oxford University Press.
//
//   SIR:  dS/dt = −β·S·I/N
//         dI/dt = β·S·I/N − γ·I
//         dR/dt = γ·I
//
//   SEIR: добавляет латентную фазу E (заражён, ещё не распространяет).
//
//   R0 = β/γ — базовое репродуктивное число.
//   R0 > 1 — эпидемия растёт, R0 < 1 — затухает.
//
// Применение в Crucix:
//   Финансовая паника, распространение нарративов, каскад санкций
//   моделируются как эпидемия на графе стран/рынков.

// ============================================================
// SIR-модель
// ============================================================

class SIRModel {
  constructor({ S0, I0, R0, beta, gamma } = {}) {
    this.S = S0 || 100;
    this.I = I0 || 1;
    this.R = R0 || 0;
    this.beta = beta || 0.3;
    this.gamma = gamma || 0.1;
    this.N = this.S + this.I + this.R;
    this.history = [];
  }

  /**
   * Базовое репродуктивное число.
   */
  reproductionNumber() {
    return this.beta / this.gamma;
  }

  /**
   * Шаг симуляции (метод Эйлера).
   */
  step(dt = 1) {
    const dS = (-this.beta * this.S * this.I / this.N) * dt;
    const dI = ((this.beta * this.S * this.I / this.N) - this.gamma * this.I) * dt;
    const dR = (this.gamma * this.I) * dt;

    this.S = Math.max(0, this.S + dS);
    this.I = Math.max(0, this.I + dI);
    this.R = Math.max(0, this.R + dR);

    return { S: this.S, I: this.I, R: this.R, t: this.history.length };
  }

  /**
   * Симуляция на N шагов.
   */
  simulate(steps = 100, dt = 1) {
    const traj = [];
    for (let i = 0; i < steps; i++) {
      traj.push(this.step(dt));
    }
    this.history.push(...traj);
    return traj;
  }

  /**
   * Пик эпидемии — максимум I.
   */
  peak() {
    if (this.history.length === 0) return { step: 0, value: this.I, fraction: this.I / this.N };
    let maxI = 0;
    let maxStep = 0;
    this.history.forEach((s, i) => {
      if (s.I > maxI) {
        maxI = s.I;
        maxStep = i;
      }
    });
    return { step: maxStep, value: maxI, fraction: maxI / this.N };
  }

  /**
   * Вероятность крупной вспышки.
   *   P(major outbreak) = 1 − (1/R0)^{I0}
   */
  majorOutbreakProbability() {
    const R0 = this.reproductionNumber();
    if (R0 <= 1) return 0;
    return 1 - Math.pow(1 / R0, Math.max(1, this.I));
  }
}

// ============================================================
// SEIR-модель
// ============================================================

class SEIRModel extends SIRModel {
  constructor({ S0, E0, I0, R0, beta, sigma, gamma } = {}) {
    super({ S0, I0, R0, beta, gamma });
    this.E = E0 || 0;
    this.sigma = sigma || 0.5;
    this.N = this.S + this.E + this.I + this.R;
  }

  step(dt = 1) {
    const dS = (-this.beta * this.S * this.I / this.N) * dt;
    const dE = ((this.beta * this.S * this.I / this.N) - this.sigma * this.E) * dt;
    const dI = (this.sigma * this.E - this.gamma * this.I) * dt;
    const dR = (this.gamma * this.I) * dt;

    this.S = Math.max(0, this.S + dS);
    this.E = Math.max(0, this.E + dE);
    this.I = Math.max(0, this.I + dI);
    this.R = Math.max(0, this.R + dR);

    return { S: this.S, E: this.E, I: this.I, R: this.R, t: this.history.length };
  }
}

// ============================================================
// Сетевая контагия (SIR на графе)
// ============================================================

class NetworkContagion {
  constructor({ nodes, adjacency, beta, gamma, initialInfected }) {
    this.nodes = nodes;
    this.adj = adjacency;
    this.beta = beta;
    this.gamma = gamma;
    this.state = nodes.map((_, i) =>
      (initialInfected || []).includes(i) ? 'I' : 'S'
    );
    this.history = [];
  }

  step(dt = 1) {
    const newState = [...this.state];
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.state[i] === 'S') {
        let risk = 0;
        for (let j = 0; j < this.nodes.length; j++) {
          if (this.state[j] === 'I' && this.adj[i][j] > 0) {
            risk += this.beta * this.adj[i][j] * dt;
          }
        }
        if (Math.random() < 1 - Math.exp(-risk)) {
          newState[i] = 'I';
        }
      } else if (this.state[i] === 'I') {
        if (Math.random() < this.gamma * dt) {
          newState[i] = 'R';
        }
      }
    }
    this.state = newState;
    const counts = { S: 0, I: 0, R: 0 };
    this.state.forEach((s) => counts[s]++);
    this.history.push(counts);
    return counts;
  }

  simulate(steps = 50) {
    const traj = [];
    for (let i = 0; i < steps; i++) traj.push(this.step());
    return traj;
  }

  prevalence() {
    const infected = this.state.filter((s) => s === 'I').length;
    return infected / this.nodes.length;
  }
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * Моделирование распространения паники по 50 «узлам» (страны/рынки).
 *
 * @param {Object} latest — latest.json
 * @param {Object} opts — {nNodes, horizon}
 * @returns {Object}
 */
function crucixContagionAnalysis(latest, opts = {}) {
  const { nNodes = 50, horizon = 30 } = opts;

  const conflictCount =
    (latest.gdelt && latest.gdelt.conflictEvents && latest.gdelt.conflictEvents.length) || 0;
  const alertCount = (latest.delta && latest.delta.newAlerts) || 0;
  const vix = (latest.fred && latest.fred.vix) || 20;

  // Начальное число «заражённых» — по числу конфликтных событий
  const I0 = Math.max(1, Math.min(5, Math.floor(conflictCount / 3)));

  // Скорость заражения растёт с VIX и конфликтами
  const beta = 0.15 + vix / 200 + Math.min(alertCount / 100, 0.1);

  // Скорость выздоровления
  const gamma = 0.05;

  const sir = new SIRModel({
    S0: nNodes - I0,
    I0,
    R0: 0,
    beta,
    gamma,
  });

  const traj = sir.simulate(horizon);
  const peak = sir.peak();
  const R0 = sir.reproductionNumber();
  const outbreakProb = sir.majorOutbreakProbability();

  return {
    available: true,
    nNodes,
    horizon,
    reproductionNumber: parseFloat(R0.toFixed(3)),
    outbreakProbability: parseFloat(outbreakProb.toFixed(3)),
    peak: {
      step: peak.step,
      fraction: parseFloat(peak.fraction.toFixed(3)),
    },
    finalState: {
      susceptible: Math.round(traj[traj.length - 1].S),
      infected: Math.round(traj[traj.length - 1].I),
      recovered: Math.round(traj[traj.length - 1].R),
    },
    trajectory: traj.filter((_, i) => i % 3 === 0),
    interpretation: R0 > 1 ? 'contagion_growing' : 'contagion_fading',
  };
}

export { SIRModel, SEIRModel, NetworkContagion, crucixContagionAnalysis };
