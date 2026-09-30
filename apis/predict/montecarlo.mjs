// apis/predict/montecarlo.mjs
// Метод Монте-Карло для сценарного моделирования исходов.
//
// Теоретическая основа:
//   Metropolis, N., & Ulam, S. (1949). "The Monte Carlo Method".
//   Journal of the American Statistical Association, 44(247), 335-341.
//   Robert, C. P., & Casella, G. (2004). "Monte Carlo Statistical Methods".
//   Springer, 2nd ed.
//
//   Идея: если переходы системы стохастические, то N симуляций дают
//   эмпирическое распределение исходов. Чем больше N, тем точнее
//   оценка вероятностей (ошибка ~ 1/√N по ЦПТ).
//
// Применение в Crucix:
//   Прогноз рыночных исходов (crisis / escalation / unstable / stable)
//   на горизонте N шагов по текущим параметрам VIX, конфликтов, спредов.
//
// Особенности реализации:
//   * Векторизованная генерация нормальных и треугольных случайных чисел
//   * Функция перехода на каждом шаге — конфигурируемая
//   * Прореживание траекторий для визуализации (без раздутия памяти)
//   * Перцентили p5/p25/p50/p75/p95 для ключевых метрик
//   * Seed-контроль для воспроизводимости результатов

// ============================================================
// Генераторы случайных величин
// ============================================================

/**
 * Box-Muller transform — генерация нормально распределённых значений.
 * Возвращает z ~ N(mean, std²).
 *
 * @param {number} mean
 * @param {number} std
 * @param {function} rng — [0,1) generator
 * @returns {number}
 */
function gaussianRandom(mean = 0, std = 1, rng = Math.random) {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/**
 * Треугольное распределение.
 * Используется, когда известен минимум, мода и максимум,
 * но не известно точное распределение (экспертная оценка).
 *
 * @param {number} min
 * @param {number} mode
 * @param {number} max
 * @param {function} rng
 * @returns {number}
 */
function triangularRandom(min, mode, max, rng = Math.random) {
  const u = rng();
  const range = max - min;
  if (range <= 0) return min;
  const fc = (mode - min) / range;
  if (u < fc) {
    return min + Math.sqrt(u * range * (mode - min));
  }
  return max - Math.sqrt((1 - u) * range * (max - mode));
}

/**
 * Равномерное распределение.
 */
function uniformRandom(min, max, rng = Math.random) {
  return min + rng() * (max - min);
}

/**
 * Детерминированный генератор (для воспроизводимости).
 * Mulberry32 — компактный PRNG с периодом 2^32.
 */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// Ядро Монте-Карло
// ============================================================

/**
 * Запуск симуляции Монте-Карло.
 *
 * @param {Object} config
 * @param {Object} config.initialState — начальные параметры {vix, conflictLevel, hySpread, ...}
 * @param {Array} config.variables — описание стохастических переменных на каждом шаге
 *   [{name, distribution: 'normal'|'triangular'|'uniform'|'bernoulli',
 *     params, dependsOn?: (state, params) => params}]
 * @param {Function} config.transition — (state, draws, step) => newState
 * @param {number} config.iterations — количество симуляций
 * @param {number} config.horizon — шагов вперёд
 * @param {Function} config.outcome — (finalState) => string (класс исхода)
 * @param {number} [config.seed] — seed для воспроизводимости
 * @param {number} [config.trajectorySampleSize] — сколько траекторий сохранить (default 10)
 * @returns {Object}
 */
function runMonteCarlo({
  initialState,
  variables,
  transition,
  iterations = 10000,
  horizon = 5,
  outcome,
  seed = null,
  trajectorySampleSize = 10,
}) {
  const rng = seed !== null ? mulberry32(seed) : Math.random;

  const outcomes = {};                     // {outcomeClass: count}
  const sampleTrajectories = [];           // сохраняем N примеров
  const finalStatesBuffer = [];            // для перцентилей
  const numericKeys = Object.keys(initialState).filter(
    (k) => typeof initialState[k] === 'number'
  );

  for (let iter = 0; iter < iterations; iter++) {
    let state = { ...initialState };
    const trajectory = [{ step: 0, ...state }];

    for (let step = 1; step <= horizon; step++) {
      // --- Генерация всех случайных значений для этого шага ---
      const draws = {};
      for (const v of variables) {
        let params = v.params || {};

        // Если переменная зависит от текущего состояния — пересчитываем
        if (typeof v.dependsOn === 'function') {
          try {
            params = v.dependsOn(state, params) || params;
          } catch (e) {
            // Игнорируем ошибки в dependsOn, используем базовые параметры
          }
        }

        switch (v.distribution) {
          case 'normal':
            draws[v.name] = gaussianRandom(
              params.mean || 0,
              params.std || 1,
              rng
            );
            break;
          case 'triangular':
            draws[v.name] = triangularRandom(
              params.min || 0,
              params.mode !== undefined ? params.mode : (params.min + params.max) / 2,
              params.max || 1,
              rng
            );
            break;
          case 'uniform':
            draws[v.name] = uniformRandom(params.min || 0, params.max || 1, rng);
            break;
          case 'bernoulli':
            draws[v.name] = rng() < (params.p || 0.5) ? 1 : 0;
            break;
          case 'logNormal':
            draws[v.name] = Math.exp(
              gaussianRandom(Math.log(params.median || 1), params.sigma || 0.5, rng)
            );
            break;
          default:
            draws[v.name] = 0;
        }
      }

      // --- Переход состояния ---
      try {
        state = transition(state, draws, step);
      } catch (e) {
        state = { ...state }; // в случае ошибки остаёмся в прежнем состоянии
      }
      trajectory.push({ step, ...state });
    }

    // --- Определение исхода ---
    let outcomeClass = 'unknown';
    try {
      outcomeClass = outcome(state) || 'unknown';
    } catch (e) {
      outcomeClass = 'error';
    }
    outcomes[outcomeClass] = (outcomes[outcomeClass] || 0) + 1;

    // --- Прореживание траекторий для визуализации ---
    if (sampleTrajectories.length < trajectorySampleSize) {
      sampleTrajectories.push(trajectory);
    }

    // --- Сохранение финального состояния для перцентилей ---
    if (finalStatesBuffer.length < 2000) {
      finalStatesBuffer.push(state);
    }
  }

  // --- Вероятности исходов ---
  const probabilities = {};
  for (const [cls, count] of Object.entries(outcomes)) {
    probabilities[cls] = count / iterations;
  }

  // --- Перцентили по числовым метрикам ---
  const metrics = {};
  for (const key of numericKeys) {
    const values = finalStatesBuffer
      .map((s) => s[key])
      .filter((v) => typeof v === 'number' && isFinite(v))
      .sort((a, b) => a - b);

    if (values.length === 0) continue;

    metrics[key] = {
      min: values[0],
      max: values[values.length - 1],
      p5: values[Math.floor(values.length * 0.05)],
      p25: values[Math.floor(values.length * 0.25)],
      p50: values[Math.floor(values.length * 0.50)],
      p75: values[Math.floor(values.length * 0.75)],
      p95: values[Math.floor(values.length * 0.95)],
      mean: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }

  return {
    probabilities,
    metrics,
    iterations,
    horizon,
    sampleTrajectories,
    seed,
  };
}

// ============================================================
// Сценарий Crucix: прогноз рыночного режима
// ============================================================

/**
 * Готовый сценарий для Crucix.
 * Симулирует эволюцию VIX, конфликтов и HY-спреда на 5 шагов вперёд.
 *
 * Исходы:
 *   crisis — VIX > 35 или HY > 6
 *   escalation — VIX > 25 или conflicts > 12
 *   unstable — промежуточное
 *   stable — VIX < 20, HY < 3.5
 *
 * @param {Object} latest — latest.json
 * @param {Object} options — {iterations, horizon, seed}
 * @returns {Object}
 */
function crucixMarketScenario(latest, options = {}) {
  const {
    iterations = 5000,
    horizon = 5,
    seed = null,
  } = options;

  const initialState = {
    vix: (latest && latest.fred && latest.fred.vix) || 20,
    hySpread: (latest && latest.fred && latest.fred.hySpread) || 3.0,
    conflictLevel:
      (latest && latest.gdelt && Array.isArray(latest.gdelt.conflictEvents)
        ? latest.gdelt.conflictEvents.length
        : 0),
  };

  const variables = [
    {
      name: 'vixShock',
      distribution: 'normal',
      params: { mean: 0, std: 2 },
      // В кризисе волатильность выше
      dependsOn: (state) => ({
        mean: 0,
        std: state.vix > 30 ? 5 : state.vix > 25 ? 3.5 : 2,
      }),
    },
    {
      name: 'conflictShock',
      distribution: 'triangular',
      params: { min: -2, mode: 0, max: 5 },
    },
    {
      name: 'spreadShock',
      distribution: 'normal',
      params: { mean: 0, std: 0.25 },
      dependsOn: (state) => ({
        mean: 0,
        std: state.hySpread > 5 ? 0.6 : 0.25,
      }),
    },
  ];

  const transition = (state, draws) => ({
    vix: Math.max(8, Math.min(80, state.vix + draws.vixShock)),
    hySpread: Math.max(0.5, Math.min(15, state.hySpread + draws.spreadShock)),
    conflictLevel: Math.max(0, state.conflictLevel + draws.conflictShock),
  });

  const outcome = (state) => {
    if (state.vix > 35 || state.hySpread > 6) return 'crisis';
    if (state.vix > 25 || state.conflictLevel > 12) return 'escalation';
    if (state.vix < 20 && state.hySpread < 3.5 && state.conflictLevel < 5) {
      return 'stable';
    }
    return 'unstable';
  };

  return runMonteCarlo({
    initialState,
    variables,
    transition,
    iterations,
    horizon,
    outcome,
    seed,
  });
}

// ============================================================
// Утилиты
// ============================================================

/**
 * Основной вероятный исход.
 */
function topOutcome(result) {
  if (!result || !result.probabilities) return { outcome: 'unknown', probability: 0 };
  let best = 'unknown';
  let bestProb = -1;
  for (const [cls, prob] of Object.entries(result.probabilities)) {
    if (prob > bestProb) {
      bestProb = prob;
      best = cls;
    }
  }
  return { outcome: best, probability: bestProb };
}

/**
 * Энтропия распределения исходов (мера неопределённости).
 */
function outcomeEntropy(result) {
  if (!result || !result.probabilities) return 0;
  let entropy = 0;
  for (const p of Object.values(result.probabilities)) {
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Хвостовой риск: сумма вероятностей экстремальных классов.
 */
function tailRisk(result, tailClasses = ['crisis', 'escalation']) {
  if (!result || !result.probabilities) return 0;
  return tailClasses.reduce((sum, cls) => sum + (result.probabilities[cls] || 0), 0);
}

export {
  runMonteCarlo,
  crucixMarketScenario,
  gaussianRandom,
  triangularRandom,
  uniformRandom,
  mulberry32,
  topOutcome,
  outcomeEntropy,
  tailRisk,
};
