// apis/predict/calibration.mjs
// Калибровка вероятностных прогнозов и трекинг точности моделей.
//
// Теоретическая основа:
//   Brier, G. W. (1950). "Verification of forecasts expressed in terms
//   of probability". Monthly Weather Review, 78(1), 1-3.
//   Platt, J. C. (1999). "Probabilistic Outputs for Support Vector Machines
//   and Comparisons to Regularized Likelihood Methods". Advances in Large
//   Margin Classifiers, 61-74.
//   Niculescu-Mizil, A., & Caruana, R. (2005). "Predicting Good Probabilities
//   with Supervised Learning". ICML.
//
// Ключевые метрики:
//   Brier Score = (1/N) · Σ (f_i - o_i)²
//     где f_i — предсказанная вероятность, o_i — фактический исход (0/1).
//     0 = идеальная точность, 0.25 = случайное угадывание, 1 = всегда неверно.
//
//   Log Loss = -(1/N) · Σ [o·log(f) + (1-o)·log(1-f)]
//     Более строгая метрика, штрафует за уверенные ошибки.
//
// Калибровка Платта: подгонка изотонической (монотонной) функции,
// которая преобразует «сырые» вероятности модели в калиброванные.

// ============================================================
// Метрики точности
// ============================================================

/**
 * Brier Score с разложением на надёжность / разрешение / неопределённость.
 * Использует Murphy decomposition (Murphy, 1973).
 *
 * @param {Array<{forecast: number, outcome: number}>} predictions
 * @returns {{score, resolution, reliability, uncertainty}}
 */
function brierScore(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return { score: 0, resolution: 0, reliability: 0, uncertainty: 0 };
  }

  const n = predictions.length;
  let score = 0;
  for (const p of predictions) {
    const f = typeof p.forecast === 'number' ? p.forecast : 0.5;
    const o = p.outcome ? 1 : 0;
    score += (f - o) ** 2;
  }
  score /= n;

  // --- Разложение Brier Score (Murphy) ---
  // Надёжность (reliability): насколько калиброваны прогнозы
  // Разрешение (resolution): насколько прогнозы лучше климатологии
  // Неопределённость (uncertainty): дисперсия климатологии
  const bins = 10;
  const binData = Array(bins).fill(null).map(() => ({
    count: 0, sumF: 0, sumO: 0,
  }));

  for (const p of predictions) {
    const f = typeof p.forecast === 'number' ? p.forecast : 0.5;
    const o = p.outcome ? 1 : 0;
    const idx = Math.min(Math.floor(f * bins), bins - 1);
    binData[idx].count++;
    binData[idx].sumF += f;
    binData[idx].sumO += o;
  }

  const climatology = predictions.reduce((s, p) => s + (p.outcome ? 1 : 0), 0) / n;

  let reliability = 0;
  let resolution = 0;
  for (const bin of binData) {
    if (bin.count === 0) continue;
    const avgF = bin.sumF / bin.count;
    const avgO = bin.sumO / bin.count;
    reliability += (bin.count / n) * (avgF - avgO) ** 2;
    resolution += (bin.count / n) * (avgO - climatology) ** 2;
  }

  const uncertainty = climatology * (1 - climatology);

  return { score, resolution, reliability, uncertainty, n };
}

/**
 * Log Loss (кросс-энтропия).
 *
 * @param {Array<{forecast: number, outcome: number}>} predictions
 * @returns {number}
 */
function logLoss(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) return 0;
  const epsilon = 1e-15;
  let sum = 0;
  for (const p of predictions) {
    const f = Math.max(epsilon, Math.min(1 - epsilon, p.forecast || 0.5));
    const o = p.outcome ? 1 : 0;
    sum += o * Math.log(f) + (1 - o) * Math.log(1 - f);
  }
  return -sum / predictions.length;
}

// ============================================================
// Калибровка Платта (изотоническая регрессия через PAVA)
// ============================================================

/**
 * Калибровка Платта-Бёрда на основе изотонической регрессии.
 *
 * Алгоритм PAVA (Pool Adjacent Violators Algorithm):
 *   1. Сортируем прогнозы по значению f
 *   2. Строим кусочно-постоянную монотонную функцию
 *   3. Если соседние блоки нарушают монотонность — объединяем их
 *
 * @param {Array<{forecast: number, outcome: number}>} history
 * @returns {Function} — calibrate(f) => f_calibrated
 */
function plattCalibration(history) {
  if (!Array.isArray(history) || history.length < 10) {
    // Недостаточно данных — возвращаем identity
    return (p) => p;
  }

  const sorted = [...history].sort((a, b) => a.forecast - b.forecast);

  // PAVA — начальные блоки по одному значению
  const blocks = sorted.map((p) => ({
    sum: p.outcome ? 1 : 0,
    count: 1,
    startX: p.forecast,
    endX: p.forecast,
  }));

  // Объединение нарушителей монотонности
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < blocks.length - 1; i++) {
      const avgI = blocks[i].sum / blocks[i].count;
      const avgNext = blocks[i + 1].sum / blocks[i + 1].count;
      if (avgI > avgNext) {
        blocks[i].sum += blocks[i + 1].sum;
        blocks[i].count += blocks[i + 1].count;
        blocks[i].endX = blocks[i + 1].endX;
        blocks.splice(i + 1, 1);
        changed = true;
      }
    }
  }

  // Функция калибровки — линейная интерполяция между блоками
  return function calibrate(rawProb) {
    if (typeof rawProb !== 'number' || isNaN(rawProb)) return 0.5;
    const p = Math.max(0, Math.min(1, rawProb));

    if (p <= blocks[0].startX) {
      return blocks[0].sum / blocks[0].count;
    }
    const last = blocks[blocks.length - 1];
    if (p >= last.endX) {
      return last.sum / last.count;
    }

    for (let i = 0; i < blocks.length - 1; i++) {
      const a = blocks[i];
      const b = blocks[i + 1];
      if (p >= a.startX && p <= b.startX) {
        const denom = b.startX - a.startX;
        const t = denom > 0 ? (p - a.startX) / denom : 0;
        const va = a.sum / a.count;
        const vb = b.sum / b.count;
        return va + t * (vb - va);
      }
    }

    return p;
  };
}

// ============================================================
// ForecastTracker — отслеживание точности прогнозов
// ============================================================

/**
 * Трекер прогнозов: сохраняет все прогнозы, разрешает их по истечении
 * горизонта, пересчитывает Brier Score по каждому источнику и модели,
 * возвращает веса для ансамбля.
 */
class ForecastTracker {
  constructor() {
    this.predictions = [];       // [{id, source, forecast, timestamp, horizonHours, outcome, resolved}]
    this.brierBySource = {};     // {source: {score, reliability, resolution, uncertainty, n}}
    this.brierByHorizon = {};    // {horizonBin: {score, ...}}
  }

  /**
   * Регистрация нового прогноза.
   *
   * @param {Object} params
   * @param {string} params.id — уникальный ID прогноза
   * @param {string} params.source — источник/модель (например, 'bayesian', 'hmm')
   * @param {number} params.forecast — предсказанная вероятность 0..1
   * @param {string} [params.timestamp] — ISO-строка, по умолчанию now
   * @param {number} [params.horizonHours] — горизонт в часах
   * @param {string} [params.eventId] — ID события
   */
  addPrediction({ id, source, forecast, timestamp, horizonHours, eventId }) {
    if (!id || !source) return null;
    const entry = {
      id,
      source,
      forecast: Math.max(0.001, Math.min(0.999, forecast)),
      timestamp: timestamp || new Date().toISOString(),
      horizonHours: horizonHours || 24,
      eventId: eventId || null,
      outcome: null,
      resolved: false,
      resolvedAt: null,
    };
    this.predictions.push(entry);
    return entry;
  }

  /**
   * Разрешение одного прогноза (установка фактического исхода).
   *
   * @param {string} id
   * @param {number} outcome — 0 или 1
   */
  resolvePrediction(id, outcome) {
    const pred = this.predictions.find((p) => p.id === id);
    if (!pred) return false;
    pred.outcome = outcome ? 1 : 0;
    pred.resolved = true;
    pred.resolvedAt = new Date().toISOString();
    this._recalculate();
    return true;
  }

  /**
   * Автоматическое разрешение прогнозов, у которых истёк горизонт.
   *
   * @param {Function} checkOutcome — (prediction) => 0 | 1 | null
   */
  autoResolve(checkOutcome) {
    if (typeof checkOutcome !== 'function') return 0;
    const now = Date.now();
    let resolvedCount = 0;

    for (const pred of this.predictions) {
      if (pred.resolved) continue;
      const predTime = new Date(pred.timestamp).getTime();
      const elapsedHours = (now - predTime) / (1000 * 60 * 60);
      if (elapsedHours < pred.horizonHours) continue;

      try {
        const outcome = checkOutcome(pred);
        if (outcome === null || outcome === undefined) continue;
        pred.outcome = outcome ? 1 : 0;
        pred.resolved = true;
        pred.resolvedAt = new Date().toISOString();
        resolvedCount++;
      } catch (e) {
        // Игнорируем ошибки одного разрешения
      }
    }

    if (resolvedCount > 0) this._recalculate();
    return resolvedCount;
  }

  /**
   * Пересчёт Brier Score по каждому источнику и горизонту.
   */
  _recalculate() {
    const bySource = {};
    const byHorizon = {};

    for (const pred of this.predictions) {
      if (!pred.resolved) continue;
      const item = { forecast: pred.forecast, outcome: pred.outcome };

      if (!bySource[pred.source]) bySource[pred.source] = [];
      bySource[pred.source].push(item);

      const hBin = Math.floor(pred.horizonHours / 24);
      if (!byHorizon[hBin]) byHorizon[hBin] = [];
      byHorizon[hBin].push(item);
    }

    this.brierBySource = {};
    for (const [src, preds] of Object.entries(bySource)) {
      this.brierBySource[src] = brierScore(preds);
    }

    this.brierByHorizon = {};
    for (const [h, preds] of Object.entries(byHorizon)) {
      this.brierByHorizon[h] = brierScore(preds);
    }
  }

  /**
   * Веса для ансамбля на основе Brier Score.
   * Модель с меньшим Brier Score получает больший вес.
   *
   * Формула: w_i = (1/Brier_i) / Σ_j (1/Brier_j)
   *
   * @returns {Object} — {source: weight}, сумма = 1
   */
  getEnsembleWeights() {
    const sources = Object.keys(this.brierBySource);
    if (sources.length === 0) return {};

    const rawWeights = {};
    let sum = 0;
    for (const src of sources) {
      const score = this.brierBySource[src].score;
      // +0.01 для избежания деления на ноль
      const w = 1 / (score + 0.01);
      rawWeights[src] = w;
      sum += w;
    }

    const normalized = {};
    for (const src of sources) {
      normalized[src] = rawWeights[src] / sum;
    }
    return normalized;
  }

  /**
   * Общая точность (Brier по всем разрешённым прогнозам).
   */
  overallBrier() {
    const resolved = this.predictions.filter((p) => p.resolved);
    if (resolved.length === 0) return null;
    return brierScore(resolved.map((p) => ({ forecast: p.forecast, outcome: p.outcome })));
  }

  /**
   * Статистика для дашборда.
   */
  getStats() {
    const total = this.predictions.length;
    const resolved = this.predictions.filter((p) => p.resolved).length;
    const brierList = Object.entries(this.brierBySource)
      .map(([source, b]) => ({
        source,
        score: b.score,
        n: b.n,
        reliability: b.reliability,
        resolution: b.resolution,
      }))
      .sort((a, b) => a.score - b.score);

    return {
      total,
      resolved,
      pending: total - resolved,
      overall: this.overallBrier(),
      bySource: brierList,
      ensembleWeights: this.getEnsembleWeights(),
    };
  }

  /**
   * Удаление старых неразрешённых прогнозов (старше maxAgeHours).
   */
  pruneStale(maxAgeHours = 24 * 30) {
    const now = Date.now();
    const before = this.predictions.length;
    this.predictions = this.predictions.filter((p) => {
      if (p.resolved) return true;
      const ageHours = (now - new Date(p.timestamp).getTime()) / (1000 * 60 * 60);
      return ageHours < maxAgeHours;
    });
    return before - this.predictions.length;
  }

  serialize() {
    return JSON.stringify({
      predictions: this.predictions,
      brierBySource: this.brierBySource,
      brierByHorizon: this.brierByHorizon,
    });
  }

  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const tracker = new ForecastTracker();
    tracker.predictions = data.predictions || [];
    tracker.brierBySource = data.brierBySource || {};
    tracker.brierByHorizon = data.brierByHorizon || {};
    return tracker;
  }
}

// ============================================================
// Готовые обёртки для Crucix
// ============================================================

/**
 * Разложение Brier Score на компоненты в процентах — для UI.
 */
function brierBreakdown(predictions) {
  const bs = brierScore(predictions);
  const total = bs.reliability + bs.resolution + bs.uncertainty || 1;
  return {
    score: bs.score,
    reliabilityPct: (bs.reliability / total) * 100,
    resolutionPct: (bs.resolution / total) * 100,
    uncertaintyPct: (bs.uncertainty / total) * 100,
  };
}

export {
  brierScore,
  logLoss,
  plattCalibration,
  ForecastTracker,
  brierBreakdown,
};
