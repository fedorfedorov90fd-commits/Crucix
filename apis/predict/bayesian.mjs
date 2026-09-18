// apis/predict/bayesian.mjs
// Байесовское ядро прогностического слоя Crucix
// Обновление вероятностей событий по теореме Байеса после каждого sweep.
//
// Теоретическая основа:
//   Bayes, T. (1763). "An Essay towards solving a Problem in the Doctrine
//   of Chances". Philosophical Transactions of the Royal Society.
//
//   P(H|E) = P(E|H) · P(H) / P(E)
//
// где:
//   P(H)   — априорная вероятность события H
//   P(E|H) — правдоподобие наблюдения E при условии, что H произойдёт
//   P(E)   — полная вероятность наблюдения E
//   P(H|E) — апостериорная вероятность события H после наблюдения E
//
// Особенности реализации:
//   * Работа в лог-пространстве для численной устойчивости
//   * Ограничение сдвига (maxShift) — не даём вероятности «прыгать»
//   * Затухание (decay) к базовой частоте при отсутствии новых сигналов

/**
 * Нормализация массива логарифмических вероятностей (softmax в log-space).
 * Избегает underflow при работе с очень маленькими вероятностями.
 *
 * @param {number[]} logProbs — массив log(p_i)
 * @returns {number[]} — нормализованный массив p_i, сумма = 1
 */
function normalizeLogProbs(logProbs) {
  if (!logProbs || logProbs.length === 0) return [];
  const maxLog = Math.max(...logProbs);
  if (!isFinite(maxLog)) return logProbs.map(() => 1 / logProbs.length);
  const expVals = logProbs.map((lp) => Math.exp(lp - maxLog));
  const sum = expVals.reduce((a, b) => a + b, 0);
  if (sum <= 0) return expVals.map(() => 1 / expVals.length);
  return expVals.map((v) => v / sum);
}

/**
 * Классическое байесовское обновление одной гипотезы.
 * В продакшене использовать multiEvidenceUpdate для нескольких сигналов.
 *
 * @param {number} prior — P(H), априорная вероятность (0..1)
 * @param {number} likelihood — P(E|H), правдоподобие наблюдения
 * @param {number} evidenceLikelihood — P(E), полная вероятность наблюдения
 * @returns {number} — P(H|E), апостериорная вероятность
 */
function bayesianUpdate(prior, likelihood, evidenceLikelihood) {
  if (evidenceLikelihood === 0) return prior;
  const posterior = (likelihood * prior) / evidenceLikelihood;
  return Math.max(0.001, Math.min(0.999, posterior));
}

/**
 * Обновление по нескольким независимым наблюдениям одновременно.
 * Использует лог-odds для численной устойчивости:
 *
 *   log-odds(P) = log(P / (1-P))
 *   log-odds_post = log-odds_prior + Σ log(Bayes_factor_i)
 *   Bayes_factor_i = P(E_i|H) / P(E_i|¬H)
 *
 * @param {Object} params
 * @param {number} params.prior — априорная вероятность (0..1)
 * @param {Array<{name: string, pGivenH: number, pGivenNotH: number, value?: any}>} params.evidence
 * @returns {{posterior: number, contributions: Array, shift: number}}
 */
function multiEvidenceUpdate({ prior, evidence }) {
  const priorClamped = Math.max(0.001, Math.min(0.999, prior));

  // Логарифмические шансы априорной вероятности
  let logOdds = Math.log(priorClamped / (1 - priorClamped));
  const contributions = [];

  if (!Array.isArray(evidence) || evidence.length === 0) {
    return { posterior: priorClamped, contributions: [], shift: 0 };
  }

  for (const ev of evidence) {
    if (!ev || typeof ev.pGivenH !== 'number' || typeof ev.pGivenNotH !== 'number') {
      continue;
    }
    // Клиппинг для избежания log(0)
    const pH = Math.max(1e-10, Math.min(1 - 1e-10, ev.pGivenH));
    const pNotH = Math.max(1e-10, Math.min(1 - 1e-10, ev.pGivenNotH));

    // Bayes factor — во сколько раз наблюдение E увеличивает шансы H
    const bayesFactor = pH / pNotH;
    const logBayesFactor = Math.log(bayesFactor);
    logOdds += logBayesFactor;

    contributions.push({
      name: ev.name || 'unnamed',
      value: ev.value !== undefined ? ev.value : null,
      bayesFactor,
      logBayesFactor,
      impact: logBayesFactor,
    });
  }

  // Обратно из log-odds в вероятность
  const posteriorOdds = Math.exp(logOdds);
  const posterior = posteriorOdds / (1 + posteriorOdds);

  return {
    posterior: Math.max(0.001, Math.min(0.999, posterior)),
    contributions,
    shift: posterior - priorClamped,
  };
}

/**
 * Ограничение сдвига вероятности за один цикл.
 * Не даём модели резко менять убеждения из-за одного шумного наблюдения.
 *
 * @param {number} oldProb
 * @param {number} newProb
 * @param {number} maxShift — максимальный сдвиг (по умолчанию 0.15 = 15%)
 * @returns {number}
 */
function clampShift(oldProb, newProb, maxShift = 0.15) {
  const shift = newProb - oldProb;
  if (Math.abs(shift) <= maxShift) return newProb;
  return oldProb + Math.sign(shift) * maxShift;
}

/**
 * Затухание (decay) вероятности к базовой частоте.
 * При отсутствии новых сигналов система не должна «застревать» на высокой
 * вероятности — она постепенно возвращается к климатологии.
 *
 * Формула: p_next = p + (baseRate - p) · decayRate
 *
 * @param {number} current — текущая вероятность
 * @param {number} baseRate — базовая частота события (климатология)
 * @param {number} decayRate — скорость возврата (0.01 — медленно, 0.1 — быстро)
 * @returns {number}
 */
function decay(current, baseRate, decayRate = 0.02) {
  return current + (baseRate - current) * decayRate;
}

/**
 * Полный цикл обновления одного события после sweep.
 *
 * @param {Object} event — { id, name, prior, baseRate, horizon, evidenceRules }
 * @param {Array} evidence — массив наблюдений из sweep
 * @param {Object} config — { maxShift, decayRate }
 * @returns {Object} — обновлённое событие
 */
function updateEvent(event, evidence, config = {}) {
  const { maxShift = 0.15, decayRate = 0.02 } = config;

  const prior = typeof event.prior === 'number' ? event.prior : 0.1;
  const baseRate = typeof event.baseRate === 'number' ? event.baseRate : prior;

  // Если нет новых наблюдений — затухание к базовой частоте
  if (!evidence || evidence.length === 0) {
    const decayed = decay(prior, baseRate, decayRate);
    return {
      ...event,
      prior,
      posterior: decayed,
      shift: decayed - prior,
      contributions: [],
      updatedAt: new Date().toISOString(),
      method: 'decay',
    };
  }

  const result = multiEvidenceUpdate({ prior, evidence });
  const clamped = clampShift(prior, result.posterior, maxShift);

  return {
    ...event,
    prior,
    posterior: clamped,
    rawPosterior: result.posterior,
    shift: clamped - prior,
    contributions: result.contributions,
    updatedAt: new Date().toISOString(),
    method: 'bayesian_update',
  };
}

/**
 * Сбор правдоподобий для типовых категорий событий.
 * Утилита для повторного использования в разных модулях.
 */
function likelihoodFromThresholds(value, thresholds) {
  const { high, critical, low } = thresholds || {};
  if (value === undefined || value === null) {
    return { pGivenH: 0.3, pGivenNotH: 0.5 };
  }
  if (critical !== undefined && value >= critical) {
    return { pGivenH: 0.85, pGivenNotH: 0.05 };
  }
  if (high !== undefined && value >= high) {
    return { pGivenH: 0.65, pGivenNotH: 0.15 };
  }
  if (low !== undefined && value < low) {
    return { pGivenH: 0.1, pGivenNotH: 0.7 };
  }
  return { pGivenH: 0.3, pGivenNotH: 0.5 };
}

export {
  normalizeLogProbs,
  bayesianUpdate,
  multiEvidenceUpdate,
  clampShift,
  decay,
  updateEvent,
  likelihoodFromThresholds,
};
