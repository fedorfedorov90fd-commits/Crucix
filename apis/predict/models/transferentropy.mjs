// apis/predict/models/transferentropy.mjs
// Transfer Entropy — направленный поток информации между временными рядами.
//
// Теоретическая основа:
//   Schreiber, T. (2000). "Measuring Information Transfer". Physical Review
//   Letters, 85(2), 461-464.
//   Barnett, L., Barrett, A. B., & Seth, A. K. (2009). "Granger Causality
//   and Transfer Entropy are Equivalent for Gaussian Variables". Physical
//   Review Letters, 103(23), 238701.
//
//   TE(X → Y) = Σ p(y_{t+1}, y_t, x_t) · log [ p(y_{t+1} | y_t, x_t)
//                                            / p(y_{t+1} | y_t) ]
//
//   TE > 0: X влияет на Y (прошлое X улучшает предсказание Y).
//   TE = 0: направленного влияния нет.
//   TE не симметричен: TE(X→Y) ≠ TE(Y→X).
//
// Применение в Crucix:
//   Определение, какие сигналы «ведут» другие. Например: рост VIX
//   ведёт конфликты или наоборот? Ответ — через TE, не через корреляцию.

// ============================================================
// Дискретизация
// ============================================================

/**
 * Дискретизация непрерывного ряда в N бинов по квантилям.
 */
function discretize(series, nBins = 3) {
  const valid = series.filter((v) => typeof v === 'number' && isFinite(v));
  if (valid.length === 0) return series.map(() => 0);

  const sorted = [...valid].sort((a, b) => a - b);
  const quantiles = [];
  for (let i = 1; i < nBins; i++) {
    quantiles.push(sorted[Math.floor((sorted.length * i) / nBins)]);
  }

  return series.map((v) => {
    if (typeof v !== 'number' || !isFinite(v)) return 0;
    for (let i = 0; i < quantiles.length; i++) {
      if (v <= quantiles[i]) return i;
    }
    return nBins - 1;
  });
}

// ============================================================
// Transfer Entropy
// ============================================================

/**
 * TE(X → Y) с дискретизацией.
 * @param {number[]} xSeries
 * @param {number[]} ySeries
 * @param {number} nBins — число бинов дискретизации
 * @returns {{te: number, normalized: number}}
 */
function transferEntropy(xSeries, ySeries, nBins = 3) {
  const n = Math.min(xSeries.length, ySeries.length);
  if (n < 15) return { te: 0, normalized: 0 };

  const xd = discretize(xSeries.slice(0, n), nBins);
  const yd = discretize(ySeries.slice(0, n), nBins);

  // Считаем совместные частоты
  const counts = {};
  const total = n - 1;

  for (let t = 0; t < total; t++) {
    const yNext = yd[t + 1];
    const yCurr = yd[t];
    const xCurr = xd[t];

    const k3 = `${yNext}|${yCurr}|${xCurr}`;
    const k2Y = `${yNext}|${yCurr}`;
    const k2YX = `${yCurr}|${xCurr}`;
    const k1Y = `${yCurr}`;

    counts[k3] = (counts[k3] || 0) + 1;
    counts[k2Y] = (counts[k2Y] || 0) + 1;
    counts[k2YX] = (counts[k2YX] || 0) + 1;
    counts[k1Y] = (counts[k1Y] || 0) + 1;
  }

  let te = 0;

  for (const key of Object.keys(counts)) {
    if (!key.includes('|') || key.split('|').length !== 3) continue;

    const [yNext, yCurr, xCurr] = key.split('|');
    const p3 = counts[key] / total;
    if (p3 === 0) continue;

    // p(y_{t+1} | y_t, x_t)
    const pYtXt = (counts[`${yCurr}|${xCurr}`] || 0) / total;
    if (pYtXt === 0) continue;
    const pNextGivenYtXt = p3 / pYtXt;

    // p(y_{t+1} | y_t) = Σ_x p(y_{t+1}, y_t, x) / p(y_t)
    const pYt = (counts[`${yCurr}`] || 0) / total;
    if (pYt === 0) continue;

    let pNextGivenYt = 0;
    for (let x = 0; x < nBins; x++) {
      const k = `${yNext}|${yCurr}|${x}`;
      pNextGivenYt += (counts[k] || 0) / total;
    }
    pNextGivenYt /= pYt;

    if (pNextGivenYt <= 0 || pNextGivenYtXt <= 0) continue;

    te += p3 * Math.log2(pNextGivenYtXt / pNextGivenYt);
  }

  return {
    te: Math.max(0, te),
    normalized: Math.max(0, te) / Math.log2(nBins),
  };
}

// ============================================================
// Матрица влияний
// ============================================================

/**
 * Матрица направленных влияний между всеми парами переменных.
 *
 * @param {Object} variables — {vix: [...], conflicts: [...], alerts: [...]}
 * @param {number} nBins
 * @returns {Object} — {matrix, ranked, topInfluence}
 */
function influenceMatrix(variables, nBins = 3) {
  const names = Object.keys(variables);
  const matrix = {};

  for (const x of names) {
    for (const y of names) {
      if (x === y) continue;
      const { te, normalized } = transferEntropy(
        variables[x],
        variables[y],
        nBins
      );
      matrix[`${x}→${y}`] = { te, normalized };
    }
  }

  // Ранжирование по силе TE
  const ranked = Object.entries(matrix)
    .map(([pair, val]) => ({
      pair,
      transferEntropy: val.te,
      normalized: val.normalized,
    }))
    .sort((a, b) => b.transferEntropy - a.transferEntropy);

  return {
    matrix,
    ranked,
    topInfluence: ranked[0] || null,
  };
}

/**
 * Асимметрия влияния между парой.
 *   asymmetry = TE(X→Y) − TE(Y→X)
 *   > 0: X ведёт Y
 *   < 0: Y ведёт X
 */
function influenceAsymmetry(xSeries, ySeries, nBins = 3) {
  const teXY = transferEntropy(xSeries, ySeries, nBins).te;
  const teYX = transferEntropy(ySeries, xSeries, nBins).te;
  return {
    xToY: teXY,
    yToX: teYX,
    asymmetry: teXY - teYX,
    leader: teXY > teYX ? 'x' : teYX > teXY ? 'y' : 'none',
  };
}

// ============================================================
// Сценарий Crucix
// ============================================================

/**
 * Определение направленных влияний между ключевыми индикаторами Crucix.
 *
 * @param {Array} history — sweep-история
 * @param {Object} opts — {nBins, minTE}
 * @returns {Object}
 */
function crucixInfluenceAnalysis(history, opts = {}) {
  const { nBins = 3, minTE = 0.02 } = opts;

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
    sanctions: history.map((h) => (h.sanctions && h.sanctions.count) || 0),
  };

  const { matrix, ranked, topInfluence } = influenceMatrix(vars, nBins);

  // Фильтрация по порогу TE
  const significant = ranked.filter((r) => r.transferEntropy >= minTE);

  return {
    available: true,
    nObservations: history.length,
    nBins,
    topInfluence,
    significantLinks: significant.slice(0, 10),
    allLinks: ranked.slice(0, 20),
    matrix,
  };
}

export {
  discretize,
  transferEntropy,
  influenceMatrix,
  influenceAsymmetry,
  crucixInfluenceAnalysis,
};
