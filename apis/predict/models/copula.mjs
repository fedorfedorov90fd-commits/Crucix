// apis/predict/models/copula.mjs
// Копулы — моделирование зависимости в хвостах распределений.
//
// Теоретическая основа:
//   Sklar, A. (1959). "Fonctions de répartition à n dimensions et leurs
//   marges". Publications de l'Institut de Statistique de l'Université de
//   Paris, 8, 229-231.
//   Nelsen, R. B. (2006). "An Introduction to Copulas" (2nd ed.). Springer.
//   Joe, H. (1997). "Multivariate Models and Dependence Concepts". Chapman & Hall.
//
//   Sklar's theorem: любое многомерное распределение F(x, y) можно
//   представить как C(F_X(x), F_Y(y)), где C — копула.
//
//   Tail dependence (λ_lower, λ_upper) — критически важная метрика:
//   корреляция Пирсона может быть 0.3, но в нижнем 5% хвосте активы
//   падают вместе. Копулы это ловят.
//
// Применение в Crucix:
//   VIX и HY-спред могут не коррелировать в спокойные дни, но
//   одновременно обваливаться в кризис. Copula показывает
//   joint tail dependence между всеми парами сигналов.

// ============================================================
// Ранжирование
// ============================================================

/**
 * Ранги элементов (1-based).
 */
function rank(arr) {
  const indexed = arr.map((v, i) => [v, i]);
  indexed.sort((a, b) => a[0] - b[0]);
  const ranks = new Array(arr.length);
  indexed.forEach(([, idx], rank) => {
    ranks[idx] = rank + 1;
  });
  return ranks;
}

/**
 * Псевдо-наблюдения через нормализованные ранги.
 */
function empiricalCopula(x, y) {
  const n = Math.min(x.length, y.length);
  const rankX = rank(x.slice(0, n));
  const rankY = rank(y.slice(0, n));

  return {
    rankX: rankX.map((r) => (r - 0.5) / n),
    rankY: rankY.map((r) => (r - 0.5) / n),
    n,
  };
}

// ============================================================
// Tail dependence
// ============================================================

/**
 * Коэффициенты tail dependence:
 *   λ_lower = P(Y < F_Y⁻¹(q) | X < F_X⁻¹(q))  для q → 0
 *   λ_upper = P(Y > F_Y⁻¹(q) | X > F_X⁻¹(q))  для q → 1
 */
function tailDependence(x, y, q = 0.1) {
  const n = Math.min(x.length, y.length);
  const { rankX, rankY } = empiricalCopula(x, y);

  // Lower tail
  let lowerBoth = 0;
  let lowerX = 0;
  for (let i = 0; i < n; i++) {
    if (rankX[i] < q) {
      lowerX++;
      if (rankY[i] < q) lowerBoth++;
    }
  }
  const lambdaLower = lowerX > 0 ? lowerBoth / lowerX : 0;

  // Upper tail
  const upperThreshold = 1 - q;
  let upperBoth = 0;
  let upperX = 0;
  for (let i = 0; i < n; i++) {
    if (rankX[i] > upperThreshold) {
      upperX++;
      if (rankY[i] > upperThreshold) upperBoth++;
    }
  }
  const lambdaUpper = upperX > 0 ? upperBoth / upperX : 0;

  return { lambdaLower, lambdaUpper, q };
}

// ============================================================
// Копулы
// ============================================================

/**
 * Gaussian copula: C(u, v) = Φ_ρ(Φ⁻¹(u), Φ⁻¹(v)).
 * Упрощённая аппроксимация.
 */
function gaussianCopula(u, v, rho) {
  const c = rho * u * v * (1 - u) * (1 - v);
  return u * v + c * 4;
}

/**
 * Clayton copula — асимметричная, ловит нижний хвост.
 *   C(u, v) = max((u^{−θ} + v^{−θ} − 1)^{−1/θ}, 0)
 */
function claytonCopula(u, v, theta) {
  const val = Math.pow(u, -theta) + Math.pow(v, -theta) - 1;
  return Math.max(0, Math.pow(val, -1 / theta));
}

/**
 * Gumbel copula — асимметричная, ловит верхний хвост.
 *   C(u, v) = exp(−((−ln u)^θ + (−ln v)^θ)^{1/θ})
 */
function gumbelCopula(u, v, theta) {
  const a = Math.pow(-Math.log(u + 1e-15), theta);
  const b = Math.pow(-Math.log(v + 1e-15), theta);
  return Math.exp(-Math.pow(a + b, 1 / theta));
}

// ============================================================
// Оценка параметров
// ============================================================

/**
 * Kendall's tau — ранговая корреляция.
 */
function kendallTau(x, y) {
  const n = Math.min(x.length, y.length);
  let concordant = 0;
  let discordant = 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[i] - x[j];
      const dy = y[i] - y[j];
      if (dx * dy > 0) concordant++;
      else if (dx * dy < 0) discordant++;
    }
  }

  const total = (n * (n - 1)) / 2;
  return total > 0 ? (concordant - discordant) / total : 0;
}

/**
 * Оценка параметра Clayton через Kendall's tau:
 *   θ = 2τ / (1 − τ)
 */
function estimateClayton(x, y) {
  const tau = kendallTau(x, y);
  if (tau >= 1) return { theta: 100, tau, method: 'clayton' };
  if (tau <= 0) return { theta: 0.01, tau, method: 'clayton' };
  return { theta: (2 * tau) / (1 - tau), tau, method: 'clayton' };
}

/**
 * Оценка параметра Gumbel: θ = 1/(1 − τ).
 */
function estimateGumbel(x, y) {
  const tau = kendallTau(x, y);
  if (tau <= 0) return { theta: 1.01, tau, method: 'gumbel' };
  return { theta: Math.max(1.01, 1 / (1 - tau)), tau, method: 'gumbel' };
}

// ============================================================
// Анализ зависимостей
// ============================================================

/**
 * Анализ зависимостей между всеми парами переменных.
 *
 * @param {Object} vars — {vix: [...], conflicts: [...], hySpread: [...]}
 * @returns {Object}
 */
function dependenceAnalysis(vars) {
  const names = Object.keys(vars);
  const results = {};

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const x = vars[names[i]];
      const y = vars[names[j]];
      const td = tailDependence(x, y, 0.1);
      const tau = kendallTau(x, y);
      const clayton = estimateClayton(x, y);
      const gumbel = estimateGumbel(x, y);

      results[`${names[i]}_${names[j]}`] = {
        kendallTau: tau,
        tailDependence: td,
        claytonTheta: clayton.theta,
        gumbelTheta: gumbel.theta,
        lowerTail: td.lambdaLower,
        upperTail: td.lambdaUpper,
        asymmetric: Math.abs(td.lambdaLower - td.lambdaUpper) > 0.1,
      };
    }
  }

  return results;
}

// ============================================================
// Готовый сценарий Crucix
// ============================================================

/**
 * Анализ хвостовых зависимостей в Crucix-истории.
 *
 * @param {Array} history — sweep-история
 * @param {Object} opts
 * @returns {Object}
 */
function crucixCopulaAnalysis(history, opts = {}) {
  if (!Array.isArray(history) || history.length < 15) {
    return {
      available: false,
      reason: 'insufficient_history',
      count: history?.length || 0,
    };
  }

  const vars = {
    vix: history.map((h) => (h.fred && h.fred.vix) || 20),
    hySpread: history.map((h) => (h.fred && h.fred.hySpread) || 3),
    conflicts: history.map(
      (h) => (h.gdelt && h.gdelt.conflictEvents && h.gdelt.conflictEvents.length) || 0
    ),
    alerts: history.map((h) => (h.delta && h.delta.newAlerts) || 0),
  };

  const analysis = dependenceAnalysis(vars);
  const entries = Object.entries(analysis);

  // Самая сильная хвостовая зависимость
  const strongest = entries.reduce((best, [pair, val]) => {
    const strength = Math.max(val.lowerTail, val.upperTail);
    const bestStrength = best ? Math.max(best[1].lowerTail, best[1].upperTail) : -1;
    return strength > bestStrength ? [pair, val] : best;
  }, null);

  return {
    available: true,
    nObservations: history.length,
    pairs: entries.map(([pair, data]) => ({
      pair,
      kendallTau: parseFloat(data.kendallTau.toFixed(3)),
      lowerTail: parseFloat(data.lowerTail.toFixed(3)),
      upperTail: parseFloat(data.upperTail.toFixed(3)),
      asymmetric: data.asymmetric,
    })),
    strongestTailDependence: strongest
      ? {
          pair: strongest[0],
          lowerTail: parseFloat(strongest[1].lowerTail.toFixed(3)),
          upperTail: parseFloat(strongest[1].upperTail.toFixed(3)),
        }
      : null,
  };
}

export {
  rank,
  empiricalCopula,
  tailDependence,
  gaussianCopula,
  claytonCopula,
  gumbelCopula,
  kendallTau,
  estimateClayton,
  estimateGumbel,
  dependenceAnalysis,
  crucixCopulaAnalysis,
};
