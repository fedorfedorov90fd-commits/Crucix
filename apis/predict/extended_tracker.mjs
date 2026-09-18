// apis/predict/extended_tracker.mjs
// Расширенный трекер точности прогнозов.
//
// Назначение:
//   Декомпозиция Brier Score, multi-horizon tracking, rolling windows,
//   regime-conditional performance, calibration drift, degradation early
//   warning, bootstrap CI, ensemble weights.
//
// Теоретическая основа:
//   Brier, G. W. (1950). "Verification of forecasts expressed in terms of
//   probability". Monthly Weather Review, 78(1), 1-3.
//   Murphy, A. H. (1973). "A New Vector Partition of the Probability Score".
//   Journal of Applied Meteorology, 12(4), 595-600.
//     BS = Reliability - Resolution + Uncertainty
//   Gneiting, T., & Raftery, A. E. (2007). "Strictly Proper Scoring Rules,
//   Prediction, and Estimation". JASA, 102(477), 359-378.
//   Efron, B., & Tibshirani, R. J. (1993). "An Introduction to the Bootstrap".
//
// Версия: 3.0.0

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RUNS_DIR = join(__dirname, '..', '..', 'runs');
const PRED_DIR = join(RUNS_DIR, 'predictions');
const TRACKER_FILE = join(PRED_DIR, 'extended_tracker.json');

const HORIZONS = [1, 6, 24, 72, 168];       // часов
const ROLLING_WINDOWS = [30, 90, 365];      // последних прогнозов
const MIN_RESOLVED_FOR_DECOMP = 20;

// ============================================================
// УТИЛИТЫ
// ============================================================

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(fp, data) {
  try {
    ensureDir(dirname(fp));
    writeFileSync(fp, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn('[extended_tracker] saveJSON failed:', e.message);
  }
}

function clamp01(v) {
  if (typeof v !== 'number' || isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

// ============================================================
// BRIER SCORE ДЕКОМПОЗИЦИЯ
// ============================================================

/**
 * Разложение Мёрфи: BS = Reliability - Resolution + Uncertainty.
 *
 * Reliability: насколько предсказанные вероятности совпадают с фактической
 *   частотой (чем ближе к 0 — тем лучше калибровка).
 * Resolution: насколько прогнозы различают исходы (чем выше — тем лучше
 *   различающая способность).
 * Uncertainty: базовая неопределённость (зависит от base rate, от модели
 *   не зависит).
 *
 * @param {Array<{forecast: number, outcome: number}>} predictions
 * @param {number} nBins — число бинов для группировки (по умолчанию 10)
 * @returns {Object} — { brier, reliability, resolution, uncertainty, nBins, binCounts }
 */
function decomposeBrier(predictions, nBins = 10) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return { brier: null, reliability: null, resolution: null, uncertainty: null, nBins: 0, binCounts: [] };
  }

  const valid = predictions.filter(
    (p) => p && typeof p.forecast === 'number' && typeof p.outcome === 'number'
  );
  if (valid.length === 0) {
    return { brier: null, reliability: null, resolution: null, uncertainty: null, nBins: 0, binCounts: [] };
  }

  const N = valid.length;

  // Base rate (средняя фактическая частота)
  const baseRate = valid.reduce((s, p) => s + p.outcome, 0) / N;

  // Brier Score напрямую
  const brier = valid.reduce((s, p) => s + (p.forecast - p.outcome) ** 2, 0) / N;

  // Uncertainty = baseRate * (1 - baseRate)
  const uncertainty = baseRate * (1 - baseRate);

  // Бины
  const bins = Array.from({ length: nBins }, () => ({ forecasts: [], outcomes: [] }));
  for (const p of valid) {
    let binIdx = Math.floor(p.forecast * nBins);
    if (binIdx >= nBins) binIdx = nBins - 1;
    if (binIdx < 0) binIdx = 0;
    bins[binIdx].forecasts.push(p.forecast);
    bins[binIdx].outcomes.push(p.outcome);
  }

  const binCounts = bins.map((b) => b.forecasts.length);

  // Reliability = Σ (n_k / N) * (mean_forecast_k - mean_outcome_k)^2
  let reliability = 0;
  // Resolution = Σ (n_k / N) * (mean_outcome_k - baseRate)^2
  let resolution = 0;

  for (const bin of bins) {
    const nk = bin.forecasts.length;
    if (nk === 0) continue;
    const meanForecast = bin.forecasts.reduce((a, b) => a + b, 0) / nk;
    const meanOutcome = bin.outcomes.reduce((a, b) => a + b, 0) / nk;
    const weight = nk / N;
    reliability += weight * (meanForecast - meanOutcome) ** 2;
    resolution += weight * (meanOutcome - baseRate) ** 2;
  }

  return {
    brier: Math.round(brier * 100000) / 100000,
    reliability: Math.round(reliability * 100000) / 100000,
    resolution: Math.round(resolution * 100000) / 100000,
    uncertainty: Math.round(uncertainty * 100000) / 100000,
    baseRate: Math.round(baseRate * 10000) / 10000,
    nBins,
    binCounts,
    nResolved: N,
  };
}

// ============================================================
// ROLLING WINDOWS
// ============================================================

/**
 * Brier Score по скользящим окнам (последние N прогнозов).
 */
function rollingBrier(predictions, windows = ROLLING_WINDOWS) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return {};
  }

  const valid = predictions.filter(
    (p) => p && typeof p.forecast === 'number' && typeof p.outcome === 'number'
  );
  const sorted = [...valid].sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );

  const result = {};
  for (const w of windows) {
    const slice = sorted.slice(-w);
    if (slice.length === 0) {
      result[`w${w}`] = null;
      continue;
    }
    const bs = slice.reduce((s, p) => s + (p.forecast - p.outcome) ** 2, 0) / slice.length;
    result[`w${w}`] = {
      brier: Math.round(bs * 100000) / 100000,
      n: slice.length,
    };
  }
  return result;
}

// ============================================================
// MULTI-HORIZON TRACKING
// ============================================================

/**
 * Brier Score по горизонтам.
 */
function multiHorizonBrier(predictions) {
  if (!Array.isArray(predictions) || predictions.length === 0) {
    return {};
  }

  const result = {};
  for (const h of HORIZONS) {
    const slice = predictions.filter(
      (p) => p && p.horizonHours !== undefined && Math.abs(p.horizonHours - h) <= 1
    );
    const valid = slice.filter(
      (p) => typeof p.forecast === 'number' && typeof p.outcome === 'number'
    );
    if (valid.length === 0) {
      result[`h${h}`] = null;
      continue;
    }
    const bs = valid.reduce((s, p) => s + (p.forecast - p.outcome) ** 2, 0) / valid.length;
    result[`h${h}`] = {
      brier: Math.round(bs * 100000) / 100000,
      n: valid.length,
    };
  }
  return result;
}

// ============================================================
// REGIME-CONDITIONAL PERFORMANCE
// ============================================================

/**
 * Производительность по режимам (state_classification).
 */
function regimeConditionalBrier(predictions, states) {
  if (!Array.isArray(predictions) || !Array.isArray(states)) return {};

  const byRegime = {};
  for (let i = 0; i < Math.min(predictions.length, states.length); i++) {
    const p = predictions[i];
    const s = states[i] || 'unknown';
    if (!p || typeof p.forecast !== 'number' || typeof p.outcome !== 'number') continue;
    if (!byRegime[s]) byRegime[s] = [];
    byRegime[s].push(p);
  }

  const result = {};
  for (const [regime, slice] of Object.entries(byRegime)) {
    if (slice.length === 0) continue;
    const bs = slice.reduce((s, p) => s + (p.forecast - p.outcome) ** 2, 0) / slice.length;
    result[regime] = {
      brier: Math.round(bs * 100000) / 100000,
      n: slice.length,
    };
  }
  return result;
}

// ============================================================
// CALIBRATION DRIFT
// ============================================================

/**
 * Обнаружение дрейфа калибровки.
 * Сравниваем Brier за последние 50 прогнозов vs предыдущие 50.
 */
function detectCalibrationDrift(predictions, windowSize = 50) {
  if (!Array.isArray(predictions) || predictions.length < windowSize * 2) {
    return { detected: false, reason: 'insufficient_data' };
  }

  const valid = predictions
    .filter((p) => p && typeof p.forecast === 'number' && typeof p.outcome === 'number')
    .sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  if (valid.length < windowSize * 2) {
    return { detected: false, reason: 'insufficient_valid' };
  }

  const recent = valid.slice(-windowSize);
  const previous = valid.slice(-windowSize * 2, -windowSize);

  const brierRecent = recent.reduce((s, p) => s + (p.forecast - p.outcome) ** 2, 0) / recent.length;
  const brierPrevious = previous.reduce((s, p) => s + (p.forecast - p.outcome) ** 2, 0) / previous.length;

  const delta = brierRecent - brierPrevious;
  const driftPct = brierPrevious > 0 ? (delta / brierPrevious) * 100 : 0;

  return {
    detected: Math.abs(driftPct) > 20,
    brierRecent: Math.round(brierRecent * 100000) / 100000,
    brierPrevious: Math.round(brierPrevious * 100000) / 100000,
    delta: Math.round(delta * 100000) / 100000,
    driftPct: Math.round(driftPct * 100) / 100,
    direction: delta > 0 ? 'degrading' : 'improving',
    windowSize,
  };
}

// ============================================================
// DEGRADATION EARLY WARNING
// ============================================================

/**
 * Раннее предупреждение о деградации качества.
 * Триггеры: рост Brier, падение resolution, падение coverage.
 */
function degradationEarlyWarning(predictions) {
  const triggers = [];

  const drift = detectCalibrationDrift(predictions);
  if (drift.detected && drift.direction === 'degrading') {
    triggers.push({
      type: 'calibration_drift',
      severity: Math.abs(drift.driftPct) > 40 ? 'high' : 'medium',
      detail: `Brier вырос на ${drift.driftPct}% за последние ${drift.windowSize} прогнозов`,
    });
  }

  const decomp = decomposeBrier(predictions);
  if (decomp.reliability !== null && decomp.reliability > 0.05) {
    triggers.push({
      type: 'high_reliability_error',
      severity: decomp.reliability > 0.1 ? 'high' : 'medium',
      detail: `Reliability = ${decomp.reliability} (плохая калибровка)`,
    });
  }

  if (decomp.resolution !== null && decomp.resolution < 0.01 && decomp.nResolved >= MIN_RESOLVED_FOR_DECOMP) {
    triggers.push({
      type: 'low_resolution',
      severity: 'medium',
      detail: `Resolution = ${decomp.resolution} (модель плохо различает исходы)`,
    });
  }

  return {
    hasWarnings: triggers.length > 0,
    triggerCount: triggers.length,
    triggers,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
// BOOTSTRAP CONFIDENCE INTERVALS
// ============================================================

/**
 * Bootstrap CI для Brier Score.
 */
function bootstrapCI(predictions, nBootstrap = 1000, confidence = 0.95) {
  if (!Array.isArray(predictions) || predictions.length < 10) {
    return { available: false, reason: 'insufficient_data' };
  }

  const valid = predictions.filter(
    (p) => p && typeof p.forecast === 'number' && typeof p.outcome === 'number'
  );
  if (valid.length < 10) return { available: false, reason: 'insufficient_valid' };

  const samples = [];
  const N = valid.length;

  for (let b = 0; b < nBootstrap; b++) {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      const idx = Math.floor(Math.random() * N);
      const p = valid[idx];
      sum += (p.forecast - p.outcome) ** 2;
    }
    samples.push(sum / N);
  }

  samples.sort((a, b) => a - b);
  const alpha = 1 - confidence;
  const lowIdx = Math.floor(samples.length * (alpha / 2));
  const highIdx = Math.floor(samples.length * (1 - alpha / 2));

  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const std = Math.sqrt(samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length);

  return {
    available: true,
    mean: Math.round(mean * 100000) / 100000,
    std: Math.round(std * 100000) / 100000,
    ci_low: Math.round(samples[lowIdx] * 100000) / 100000,
    ci_high: Math.round(samples[highIdx] * 100000) / 100000,
    confidence,
    nBootstrap,
    nSamples: N,
  };
}

// ============================================================
// ENSEMBLE WEIGHTS
// ============================================================

/**
 * Расчёт весов ансамбля из Brier Score каждой модели.
 * Модель с меньшим Brier получает больший вес.
 * weight_i = (1/BS_i) / Σ(1/BS_j)
 */
function computeEnsembleWeights(perModelBrier) {
  if (!perModelBrier || typeof perModelBrier !== 'object') return {};

  const eps = 1e-4;
  const inv = {};
  let total = 0;

  for (const [name, bs] of Object.entries(perModelBrier)) {
    if (typeof bs !== 'number' || bs <= 0 || isNaN(bs)) continue;
    const w = 1 / Math.max(eps, bs);
    inv[name] = w;
    total += w;
  }

  if (total === 0) return {};

  const normalized = {};
  for (const [name, w] of Object.entries(inv)) {
    normalized[name] = Math.round((w / total) * 10000) / 10000;
  }
  return normalized;
}

// ============================================================
// КЛАСС EXTENDEDTRACKER
// ============================================================

export class ExtendedTracker {
  constructor({ filePath } = {}) {
    this.filePath = filePath || TRACKER_FILE;
    this.predictions = [];
    this.byModel = {};
    this.load();
  }

  load() {
    const data = loadJSON(this.filePath, null);
    if (!data) return this;
    this.predictions = Array.isArray(data.predictions) ? data.predictions : [];
    this.byModel = data.byModel && typeof data.byModel === 'object' ? data.byModel : {};
    return this;
  }

  save() {
    saveJSON(this.filePath, {
      predictions: this.predictions.slice(-2000),
      byModel: this.byModel,
      lastUpdated: new Date().toISOString(),
    });
  }

  /**
   * Регистрация прогноза.
   * @param {Object} pred — { id, source, forecast, horizonHours, timestamp }
   */
  addPrediction(pred) {
    if (!pred || typeof pred.forecast !== 'number') return null;
    const entry = {
      id: pred.id || `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      source: pred.source || 'unknown',
      forecast: clamp01(pred.forecast),
      horizonHours: pred.horizonHours || 24,
      timestamp: pred.timestamp || new Date().toISOString(),
      outcome: null,
      resolved: false,
    };
    this.predictions.push(entry);
    return entry.id;
  }

  /**
   * Разрешение прогноза (установка outcome).
   */
  resolve(id, outcome) {
    const pred = this.predictions.find((p) => p.id === id);
    if (!pred) return false;
    pred.outcome = outcome ? 1 : 0;
    pred.resolved = true;
    pred.resolvedAt = new Date().toISOString();
    return true;
  }

  /**
   * Авторазрешение прогнозов из истории sweep'ов.
   * @param {Function} resolverFn — (pred, history) => 0|1|null
   */
  autoResolve(history, resolverFn) {
    for (const pred of this.predictions) {
      if (pred.resolved) continue;
      try {
        const outcome = resolverFn(pred, history);
        if (outcome === 0 || outcome === 1) {
          pred.outcome = outcome;
          pred.resolved = true;
          pred.resolvedAt = new Date().toISOString();
        }
      } catch (e) {
        // skip
      }
    }
  }

  /**
   * Полная статистика.
   */
  getStats() {
    const resolved = this.predictions.filter((p) => p.resolved);
    const decomp = decomposeBrier(resolved);
    const rolling = rollingBrier(resolved);
    const horizons = multiHorizonBrier(this.predictions);
    const drift = detectCalibrationDrift(resolved);
    const warning = degradationEarlyWarning(resolved);
    const ci = bootstrapCI(resolved);

    // Per-model Brier
    const perModel = {};
    const modelGroups = {};
    for (const p of resolved) {
      if (!modelGroups[p.source]) modelGroups[p.source] = [];
      modelGroups[p.source].push(p);
    }
    for (const [source, slice] of Object.entries(modelGroups)) {
      const bs = slice.reduce((s, p) => s + (p.forecast - p.outcome) ** 2, 0) / slice.length;
      perModel[source] = Math.round(bs * 100000) / 100000;
    }

    const weights = computeEnsembleWeights(perModel);

    return {
      total: this.predictions.length,
      resolved: resolved.length,
      pending: this.predictions.length - resolved.length,
      brier: decomp.brier,
      decomposition: decomp,
      rolling,
      horizons,
      drift,
      warning,
      bootstrapCI: ci,
      perModelBrier: perModel,
      ensembleWeights: weights,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Сериализация для сохранения.
   */
  serialize() {
    return JSON.stringify({
      predictions: this.predictions,
      byModel: this.byModel,
    });
  }

  /**
   * Десериализация.
   */
  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const t = new ExtendedTracker({ filePath: TRACKER_FILE });
    t.predictions = Array.isArray(data.predictions) ? data.predictions : [];
    t.byModel = data.byModel || {};
    return t;
  }
}

// ============================================================
// SINGLETON
// ============================================================

let _instance = null;

export function getExtendedTracker() {
  if (!_instance) _instance = new ExtendedTracker();
  return _instance;
}

export function _resetExtendedTracker() {
  _instance = null;
}

export {
  decomposeBrier,
  rollingBrier,
  multiHorizonBrier,
  regimeConditionalBrier,
  detectCalibrationDrift,
  degradationEarlyWarning,
  bootstrapCI,
  computeEnsembleWeights,
  HORIZONS,
  ROLLING_WINDOWS,
};
