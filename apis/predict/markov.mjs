// apis/predict/markov.mjs
// Цепи Маркова для прогнозирования переходов режима системы.
//
// Теоретическая основа:
//   Markov, A. A. (1906). "Rasprostranenie zakona bol'shih chisel na
//   velichiny, zavisjasie drug ot druga". Известия Физ.-мат. об-ва.
//   Norris, J. R. (1997). "Markov Chains". Cambridge University Press.
//
//   Дискретная цепь Маркова первого порядка задаётся:
//     P(X_{n+1} = j | X_n = i, X_{n-1}, ...) = P(X_{n+1} = j | X_n = i) = P_ij
//
//   Матрица переходов P = [P_ij] стохастическая: Σ_j P_ij = 1.
//
// Применение в Crucix:
//   1. Классификация текущего состояния системы по sweep.
//   2. Прогноз вероятности перехода в кризисное состояние через N шагов.
//   3. Стационарное распределение — долгосрочные вероятности режимов.
//
// Классы состояний (5):
//   stable, deescalation, unstable, escalation, crisis
//
// Особенности реализации:
//   * Обучение на последовательности исторических состояний
//   * Сглаживание Лапласа для избежания нулевых вероятностей
//   * Степень матрицы через повторное умножение (без SVD)

// ============================================================
// Классификатор состояния системы по данным sweep
// ============================================================

/**
 * Классификация состояния системы по одному sweep.
 * Пороги подобраны эмпирически с учётом типичных значений.
 *
 * @param {Object} sweep — запись из runs/memory/ или latest.json
 * @returns {string} — одно из: stable, deescalation, unstable, escalation, crisis
 */
function classifyState(sweep) {
  const vix = sweep && sweep.fred && typeof sweep.fred.vix === 'number'
    ? sweep.fred.vix
    : 20;
  const events = sweep && sweep.gdelt && Array.isArray(sweep.gdelt.conflictEvents)
    ? sweep.gdelt.conflictEvents
    : [];
  const conflictCount = events.length;
  const newAlerts = sweep && sweep.delta ? (sweep.delta.newAlerts || 0) : 0;
  const escalated = sweep && sweep.delta ? (sweep.delta.escalatedAlerts || 0) : 0;

  // --- Кризис ---
  if (vix > 38 || conflictCount > 18 || escalated > 6) return 'crisis';

  // --- Эскалация ---
  if (vix > 30 || conflictCount > 12 || escalated > 4) return 'escalation';

  // --- Деэскалация (после эскалации, спокойствие с трендом вниз) ---
  if (vix < 18 && conflictCount < 4 && newAlerts < 3) return 'deescalation';

  // --- Стабильность ---
  if (vix < 22 && conflictCount < 5 && newAlerts < 5 && escalated < 2) {
    return 'stable';
  }

  // --- Всё промежуточное — нестабильность ---
  return 'unstable';
}

// ============================================================
// Цепь Маркова
// ============================================================

class MarkovChain {
  constructor() {
    this.states = [];                    // список уникальных состояний
    this.transitionMatrix = {};          // {from: {to: probability}}
    this.stateIndex = {};                // {state: index}
    this.trained = false;
    this.laplaceSmoothing = 1;
  }

  /**
   * Обучение цепи Маркова на последовательности состояний.
   *
   * @param {string[]} sequence — последовательность состояний
   * @param {number} smoothing — сглаживание Лапласа (default: 1)
   * @returns {MarkovChain} — this
   */
  fit(sequence, smoothing = 1) {
    if (!Array.isArray(sequence) || sequence.length < 2) {
      this.trained = false;
      return this;
    }

    this.laplaceSmoothing = smoothing;
    this.states = [...new Set(sequence)];
    this.stateIndex = {};
    this.states.forEach((s, i) => {
      this.stateIndex[s] = i;
    });

    // --- Инициализация матрицы с сглаживанием ---
    const counts = {};
    for (const from of this.states) {
      counts[from] = {};
      for (const to of this.states) {
        counts[from][to] = smoothing;
      }
    }

    // --- Подсчёт переходов ---
    for (let i = 0; i < sequence.length - 1; i++) {
      const from = sequence[i];
      const to = sequence[i + 1];
      counts[from][to] = (counts[from][to] || 0) + 1;
    }

    // --- Нормализация: строки должны суммироваться в 1 ---
    this.transitionMatrix = {};
    for (const from of this.states) {
      const rowSum = Object.values(counts[from]).reduce((a, b) => a + b, 0);
      this.transitionMatrix[from] = {};
      for (const to of this.states) {
        this.transitionMatrix[from][to] =
          rowSum > 0 ? counts[from][to] / rowSum : 1 / this.states.length;
      }
    }

    this.trained = true;
    return this;
  }

  /**
   * Прогноз следующего состояния (один шаг).
   *
   * @param {string} currentState
   * @returns {{predicted: string, distribution: Object}}
   */
  predictNext(currentState) {
    if (!this.trained) {
      return { predicted: 'unknown', distribution: {} };
    }

    // --- Если состояние неизвестно — равномерное распределение ---
    if (!this.transitionMatrix[currentState]) {
      const uniform = 1 / Math.max(this.states.length, 1);
      const distribution = {};
      for (const s of this.states) distribution[s] = uniform;
      return {
        predicted: this.states[0] || 'unknown',
        distribution,
      };
    }

    const distribution = { ...this.transitionMatrix[currentState] };

    // --- Наиболее вероятное следующее состояние ---
    let predicted = this.states[0];
    let maxProb = -1;
    for (const s of this.states) {
      if (distribution[s] > maxProb) {
        maxProb = distribution[s];
        predicted = s;
      }
    }

    return { predicted, distribution };
  }

  /**
   * Прогноз на N шагов вперёд.
   * Используется итеративное умножение вектора состояния на матрицу.
   *
   * @param {string} currentState
   * @param {number} steps
   * @returns {{distribution: Object, path: Array<{step: number, distribution: Object}>}}
   */
  predictNSteps(currentState, steps) {
    if (!this.trained || steps < 1) {
      return { distribution: {}, path: [] };
    }

    // Начальное распределение — дельта в currentState
    let dist = {};
    for (const s of this.states) {
      dist[s] = s === currentState ? 1 : 0;
    }

    const path = [{ step: 0, distribution: { ...dist } }];

    for (let step = 1; step <= steps; step++) {
      const newDist = {};
      for (const to of this.states) {
        let prob = 0;
        for (const from of this.states) {
          const transProb =
            (this.transitionMatrix[from] && this.transitionMatrix[from][to]) || 0;
          prob += dist[from] * transProb;
        }
        newDist[to] = prob;
      }
      dist = newDist;
      path.push({ step, distribution: { ...dist } });
    }

    return { distribution: dist, path };
  }

  /**
   * Стационарное распределение π, такое что π = π · P.
   * Итеративный метод: многократно применяем переходы до сходимости.
   *
   * @param {number} maxIter — максимум итераций
   * @param {number} tolerance — порог сходимости
   * @returns {Object} — {state: probability}
   */
  stationaryDistribution(maxIter = 1000, tolerance = 1e-8) {
    if (!this.trained || this.states.length === 0) return {};

    // Начинаем с равномерного распределения
    let dist = {};
    for (const s of this.states) {
      dist[s] = 1 / this.states.length;
    }

    for (let iter = 0; iter < maxIter; iter++) {
      const newDist = {};
      for (const to of this.states) {
        let prob = 0;
        for (const from of this.states) {
          const transProb =
            (this.transitionMatrix[from] && this.transitionMatrix[from][to]) || 0;
          prob += dist[from] * transProb;
        }
        newDist[to] = prob;
      }

      // --- Проверка сходимости ---
      let maxDiff = 0;
      for (const s of this.states) {
        maxDiff = Math.max(maxDiff, Math.abs(newDist[s] - dist[s]));
      }
      dist = newDist;
      if (maxDiff < tolerance) break;
    }

    return dist;
  }

  /**
   * Матрица переходов в виде вложенного объекта для сериализации.
   */
  getMatrix() {
    return {
      states: [...this.states],
      matrix: JSON.parse(JSON.stringify(this.transitionMatrix)),
    };
  }

  /**
   * Сериализация.
   */
  serialize() {
    return JSON.stringify({
      states: this.states,
      transitionMatrix: this.transitionMatrix,
      stateIndex: this.stateIndex,
      trained: this.trained,
      laplaceSmoothing: this.laplaceSmoothing,
    });
  }

  /**
   * Десериализация.
   */
  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const mc = new MarkovChain();
    mc.states = data.states || [];
    mc.transitionMatrix = data.transitionMatrix || {};
    mc.stateIndex = data.stateIndex || {};
    mc.trained = !!data.trained;
    mc.laplaceSmoothing = data.laplaceSmoothing || 1;
    return mc;
  }
}

// ============================================================
// Утилиты
// ============================================================

/**
 * Построение последовательности состояний из истории sweep.
 *
 * @param {Array} history — массив sweep-записей
 * @returns {string[]}
 */
function buildStateSequence(history) {
  if (!Array.isArray(history)) return [];
  return history.map((sweep) => classifyState(sweep));
}

/**
 * Утилита: энтропия распределения состояний.
 * Показывает, насколько система «уверена» в текущем режиме.
 *
 * H = -Σ p_i · log2(p_i)
 */
function distributionEntropy(distribution) {
  let entropy = 0;
  for (const p of Object.values(distribution)) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

export { MarkovChain, classifyState, buildStateSequence, distributionEntropy };
