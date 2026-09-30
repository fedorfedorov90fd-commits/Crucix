// apis/predict/models/hmm.mjs
// Hidden Markov Model — скрытые состояния системы по зашумлённым наблюдениям.
//
// Теоретическая основа:
//   Rabiner, L. R. (1989). "A Tutorial on Hidden Markov Models and Selected
//   Applications in Speech Recognition". Proceedings of the IEEE, 77(2), 257-286.
//   Baum, L. E., Petrie, T., Soules, G., & Weiss, N. (1970). "A Maximization
//   Technique Occurring in the Statistical Analysis of Probabilistic Functions
//   of Markov Chains". Annals of Mathematical Statistics, 41(1), 164-171.
//
// Три классических задачи HMM:
//   1. Evaluation: P(O | λ) — forward algorithm
//   2. Decoding:   оптимальная последовательность состояний — Viterbi
//   3. Learning:   оценка параметров λ = (A, B, π) — Baum-Welch (EM)
//
// Применение в Crucix:
//   Скрытые состояния = режим мира (stable/escalation/crisis)
//   Наблюдения = дискретизированный композитный индекс (low/medium/high)

// ============================================================
// HMM
// ============================================================

class HMM {
  constructor({ states, observations, A, B, pi }) {
    this.states = states;
    this.observations = observations;
    this.A = A;
    this.B = B;
    this.pi = pi;
    this.N = states.length;
    this.M = observations.length;
  }

  /**
   * Forward algorithm — P(O_1..O_T | model).
   * alpha_t(i) = P(O_1..O_t, q_t=i)
   * Возвращает нормализованные alpha и logProb.
   */
  forward(obsSeq) {
    const T = obsSeq.length;
    const alpha = Array.from({ length: T }, () => new Array(this.N).fill(0));
    const scale = new Array(T).fill(0);

    // Инициализация
    for (let i = 0; i < this.N; i++) {
      alpha[0][i] = this.pi[i] * this.B[i][obsSeq[0]];
      scale[0] += alpha[0][i];
    }
    if (scale[0] > 0) {
      for (let i = 0; i < this.N; i++) alpha[0][i] /= scale[0];
    } else {
      scale[0] = 1;
    }

    // Рекурсия
    for (let t = 1; t < T; t++) {
      let c = 0;
      for (let j = 0; j < this.N; j++) {
        let sum = 0;
        for (let i = 0; i < this.N; i++) {
          sum += alpha[t - 1][i] * this.A[i][j];
        }
        alpha[t][j] = sum * this.B[j][obsSeq[t]];
        c += alpha[t][j];
      }
      c = c || 1;
      for (let j = 0; j < this.N; j++) alpha[t][j] /= c;
      scale[t] = c;
    }

    let logProb = 0;
    for (let t = 0; t < T; t++) {
      logProb += Math.log(Math.max(scale[t], 1e-300));
    }

    return { alpha, logProb, scale };
  }

  /**
   * Backward algorithm — β_t(i) = P(O_{t+1}..O_T | q_t=i).
   */
  backward(obsSeq) {
    const T = obsSeq.length;
    const beta = Array.from({ length: T }, () => new Array(this.N).fill(0));

    for (let i = 0; i < this.N; i++) beta[T - 1][i] = 1;

    for (let t = T - 2; t >= 0; t--) {
      for (let i = 0; i < this.N; i++) {
        let sum = 0;
        for (let j = 0; j < this.N; j++) {
          sum += this.A[i][j] * this.B[j][obsSeq[t + 1]] * beta[t + 1][j];
        }
        beta[t][i] = sum;
      }
    }

    return beta;
  }

  /**
   * Viterbi — наиболее вероятная последовательность скрытых состояний.
   * Работает в log-space.
   */
  viterbi(obsSeq) {
    const T = obsSeq.length;
    const delta = Array.from({ length: T }, () => new Array(this.N).fill(0));
    const psi = Array.from({ length: T }, () => new Array(this.N).fill(0));

    for (let i = 0; i < this.N; i++) {
      delta[0][i] = Math.log(Math.max(this.pi[i] * this.B[i][obsSeq[0]], 1e-300));
    }

    for (let t = 1; t < T; t++) {
      for (let j = 0; j < this.N; j++) {
        let maxVal = -Infinity;
        let maxIdx = 0;
        for (let i = 0; i < this.N; i++) {
          const val = delta[t - 1][i] + Math.log(Math.max(this.A[i][j], 1e-300));
          if (val > maxVal) {
            maxVal = val;
            maxIdx = i;
          }
        }
        delta[t][j] = maxVal + Math.log(Math.max(this.B[j][obsSeq[t]], 1e-300));
        psi[t][j] = maxIdx;
      }
    }

    const path = new Array(T);
    let maxFinal = 0;
    let maxProb = -Infinity;
    for (let i = 0; i < this.N; i++) {
      if (delta[T - 1][i] > maxProb) {
        maxProb = delta[T - 1][i];
        maxFinal = i;
      }
    }
    path[T - 1] = this.states[maxFinal];

    for (let t = T - 2; t >= 0; t--) {
      maxFinal = psi[t + 1][maxFinal];
      path[t] = this.states[maxFinal];
    }

    return { path, prob: Math.exp(maxProb) };
  }

  /**
   * Baum-Welch — обучение параметров EM-алгоритмом.
   * Обучается на массиве последовательностей наблюдений.
   */
  fit(obsSeqs, maxIter = 100, tolerance = 1e-4) {
    let prevLL = -Infinity;

    for (let iter = 0; iter < maxIter; iter++) {
      const newA = Array.from({ length: this.N }, () => new Array(this.N).fill(0));
      const newB = Array.from({ length: this.N }, () => new Array(this.M).fill(0));
      const newPi = new Array(this.N).fill(0);
      let totalLL = 0;

      for (const obsSeq of obsSeqs) {
        const { alpha, logProb } = this.forward(obsSeq);
        const beta = this.backward(obsSeq);
        totalLL += logProb;

        const T = obsSeq.length;

        // γ_t(i) = P(q_t = i | O)
        const gamma = Array.from({ length: T }, () => new Array(this.N).fill(0));
        for (let t = 0; t < T; t++) {
          let denom = 0;
          for (let j = 0; j < this.N; j++) {
            gamma[t][j] = alpha[t][j] * beta[t][j];
            denom += gamma[t][j];
          }
          if (denom > 0) {
            for (let j = 0; j < this.N; j++) gamma[t][j] /= denom;
          }
        }

        // ξ_t(i, j) = P(q_t=i, q_{t+1}=j | O)
        const xi = Array.from({ length: Math.max(T - 1, 0) }, () =>
          Array.from({ length: this.N }, () => new Array(this.N).fill(0))
        );
        for (let t = 0; t < T - 1; t++) {
          let denom = 0;
          for (let i = 0; i < this.N; i++) {
            for (let j = 0; j < this.N; j++) {
              xi[t][i][j] = alpha[t][i] * this.A[i][j] *
                this.B[j][obsSeq[t + 1]] * beta[t + 1][j];
              denom += xi[t][i][j];
            }
          }
          if (denom > 0) {
            for (let i = 0; i < this.N; i++) {
              for (let j = 0; j < this.N; j++) xi[t][i][j] /= denom;
            }
          }
        }

        // Обновление параметров
        for (let i = 0; i < this.N; i++) newPi[i] += gamma[0][i];

        for (let i = 0; i < this.N; i++) {
          for (let j = 0; j < this.N; j++) {
            let num = 0;
            let den = 0;
            for (let t = 0; t < T - 1; t++) {
              num += xi[t][i][j];
              den += gamma[t][i];
            }
            newA[i][j] += den > 0 ? num / den : 0;
          }
        }

        for (let i = 0; i < this.N; i++) {
          for (let k = 0; k < this.M; k++) {
            let num = 0;
            let den = 0;
            for (let t = 0; t < T; t++) {
              if (obsSeq[t] === k) num += gamma[t][i];
              den += gamma[t][i];
            }
            newB[i][k] += den > 0 ? num / den : 0;
          }
        }
      }

      // Усреднение по последовательностям
      const nSeqs = Math.max(obsSeqs.length, 1);
      for (let i = 0; i < this.N; i++) {
        newPi[i] /= nSeqs;
        let rowSum = newA[i].reduce((a, b) => a + b, 0);
        if (rowSum > 0) {
          for (let j = 0; j < this.N; j++) newA[i][j] /= rowSum;
        }
        let bRowSum = newB[i].reduce((a, b) => a + b, 0);
        if (bRowSum > 0) {
          for (let k = 0; k < this.M; k++) newB[i][k] /= bRowSum;
        }
      }

      this.A = newA;
      this.B = newB;
      this.pi = newPi;

      if (Math.abs(totalLL - prevLL) < tolerance) break;
      prevLL = totalLL;
    }

    return { logLikelihood: prevLL };
  }

  /**
   * Прогноз следующего состояния и наблюдения.
   */
  predictNext(obsSeq) {
    const { alpha } = this.forward(obsSeq);
    const lastAlpha = alpha[obsSeq.length - 1];

    let sum = lastAlpha.reduce((a, b) => a + b, 0);
    const stateDist = lastAlpha.map((a) => (sum > 0 ? a / sum : 1 / this.N));

    const nextStateDist = new Array(this.N).fill(0);
    for (let j = 0; j < this.N; j++) {
      for (let i = 0; i < this.N; i++) {
        nextStateDist[j] += stateDist[i] * this.A[i][j];
      }
    }

    const obsDist = new Array(this.M).fill(0);
    for (let k = 0; k < this.M; k++) {
      for (let j = 0; j < this.N; j++) {
        obsDist[k] += nextStateDist[j] * this.B[j][k];
      }
    }

    const predictedState =
      this.states[nextStateDist.indexOf(Math.max(...nextStateDist))];
    const predictedObs =
      this.observations[obsDist.indexOf(Math.max(...obsDist))];

    return {
      predictedState,
      stateDistribution: Object.fromEntries(
        this.states.map((s, i) => [s, nextStateDist[i]])
      ),
      predictedObservation: predictedObs,
      observationDistribution: Object.fromEntries(
        this.observations.map((o, i) => [o, obsDist[i]])
      ),
    };
  }

  serialize() {
    return JSON.stringify({
      states: this.states,
      observations: this.observations,
      A: this.A,
      B: this.B,
      pi: this.pi,
      N: this.N,
      M: this.M,
    });
  }

  static deserialize(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    return new HMM(d);
  }
}

// ============================================================
// Готовый HMM для Crucix
// ============================================================

/**
 * Экспертно-инициализированный HMM для классификации режима.
 * Параметры подобраны эмпирически.
 */
function createCrucixHMM() {
  return new HMM({
    states: ['stable', 'escalation', 'crisis'],
    observations: ['low', 'medium', 'high'],
    A: [
      [0.85, 0.13, 0.02], // stable → ...
      [0.30, 0.55, 0.15], // escalation → ...
      [0.05, 0.35, 0.60], // crisis → ...
    ],
    B: [
      [0.70, 0.25, 0.05], // stable → low/medium/high
      [0.15, 0.55, 0.30], // escalation
      [0.05, 0.20, 0.75], // crisis
    ],
    pi: [0.6, 0.3, 0.1],
  });
}

/**
 * Конвертация sweep-истории в последовательность дискретных наблюдений.
 * score < 0.33 → 'low' (0), < 0.66 → 'medium' (1), иначе 'high' (2)
 */
function sweepToObservations(history) {
  return history.map((sweep) => {
    const vix = (sweep.fred && sweep.fred.vix) || 20;
    const conflicts =
      (sweep.gdelt && sweep.gdelt.conflictEvents && sweep.gdelt.conflictEvents.length) || 0;
    const alerts = (sweep.delta && sweep.delta.newAlerts) || 0;

    const score =
      (vix / 40) * 0.4 +
      Math.min(conflicts / 20, 1) * 0.35 +
      Math.min(alerts / 15, 1) * 0.25;

    if (score < 0.33) return 0;
    if (score < 0.66) return 1;
    return 2;
  });
}

export { HMM, createCrucixHMM, sweepToObservations };
