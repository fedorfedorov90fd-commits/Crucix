// Crucix — ConvergenceEngine (класс-вычислитель)
// Межкатегорийное схождение сигналов из 8 категорий анализаторов.
//
// Версия: 1.0.0
// Используется анализатором scripts/analyzers/convergence-engine.mjs.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Истинный сигнал — когда НЕЗАВИСИМЫЕ измерения показывают одно
//   направление. Одно измерение может ошибаться. Четыре независимых
//   (detector + forecast + semantic + market) — нет. Это базовое
//   свойство ансамбля: вероятность одновременной ошибки независимых
//   источников падает экспоненциально с их числом.
//
// АЛГОРИТМ:
//   1. Группировка сигналов по регионам.
//   2. Подсчёт уникальных категорий в регионе.
//   3. Взвешенное усреднение сигналов с весами категорий.
//   4. Boost за разнообразие (sqrt(categories) × diversityBoost).

const CATEGORY_WEIGHTS = Object.freeze({
  detector:   1.0,
  forecast:   1.0,
  semantic:   0.8,
  market:     0.8,
  flow:       0.7,
  specialist: 0.7,
  index:      0.6,
  space:      0.5,
});

const LEVELS = Object.freeze({
  CRITICAL: 'critical',
  HIGH:     'high',
  MEDIUM:   'medium',
  LOW:      'low',
});

export default class ConvergenceEngine {
  constructor(opts = {}) {
    this.minCategories = opts.minCategories ?? 3;
    this.categoryWeights = opts.categoryWeights ?? CATEGORY_WEIGHTS;
    this.minSignal = opts.minSignal ?? 0.05;
    // Вход: массив { id, category, signal (0..1), regions: string[] }
    this.signals = [];
  }

  // Добавление сигнала от модуля.
  add(signal) {
    if (!signal || !signal.id || !signal.category) return false;
    const s = Number(signal.signal);
    if (!Number.isFinite(s) || s < this.minSignal) return false;
    const regions = Array.isArray(signal.regions) && signal.regions.length > 0
      ? signal.regions
      : ['GLOBAL'];
    this.signals.push({
      id: signal.id,
      category: signal.category,
      signal: Math.min(Math.max(s, 0), 1),
      regions: regions.map(r => String(r).toUpperCase()),
      version: signal.version || null,
      updatedAt: signal.updatedAt || null,
    });
    return true;
  }

  // Группировка по региону.
  _byRegion() {
    const map = new Map();
    for (const s of this.signals) {
      for (const r of s.regions) {
        if (!map.has(r)) map.set(r, []);
        map.get(r).push(s);
      }
    }
    return map;
  }

  // Схождение по каждому региону.
  detectConvergences() {
    const regions = this._byRegion();
    const result = [];

    for (const [region, entries] of regions) {
      // Уникальные категории.
      const catMap = new Map();
      for (const e of entries) {
        if (!catMap.has(e.category)) catMap.set(e.category, []);
        catMap.get(e.category).push(e.signal);
      }
      const categories = catMap.size;
      if (categories < this.minCategories) continue;

      // Взвешенный сигнал по категориям.
      let weightSum = 0, weightedSum = 0;
      const categorySignals = {};
      for (const [cat, values] of catMap) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        categorySignals[cat] = Math.round(avg * 1000) / 1000;
        const w = this.categoryWeights[cat] ?? 0.5;
        weightedSum += avg * w;
        weightSum += w;
      }
      const weightedSignal = weightSum > 0 ? weightedSum / weightSum : 0;

      // Формула оценки.
      const categoryBoost = Math.sqrt(categories);
      const diversityBoost = 1 + (categories - this.minCategories) * 0.15;
      const score = Math.round(categoryBoost * weightedSignal * diversityBoost * 100) / 100;

      const level = score >= 2.5 ? LEVELS.CRITICAL
                  : score >= 1.5 ? LEVELS.HIGH
                  : score >= 0.8 ? LEVELS.MEDIUM
                  : LEVELS.LOW;

      result.push({
        region,
        categories,
        moduleCount: entries.length,
        weightedSignal: Math.round(weightedSignal * 1000) / 1000,
        convergenceScore: score,
        level,
        categorySignals,
        modules: entries.map(e => ({
          id: e.id,
          category: e.category,
          signal: Math.round(e.signal * 1000) / 1000,
        })),
      });
    }

    return result.sort((a, b) => b.convergenceScore - a.convergenceScore);
  }

  // Схождение по категориям (глобально, без региона).
  detectGlobalConvergence() {
    const catMap = new Map();
    for (const s of this.signals) {
      if (!catMap.has(s.category)) catMap.set(s.category, []);
      catMap.get(s.category).push(s.signal);
    }
    const categorySignals = {};
    let weightSum = 0, weightedSum = 0;
    for (const [cat, values] of catMap) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      categorySignals[cat] = Math.round(avg * 1000) / 1000;
      const w = this.categoryWeights[cat] ?? 0.5;
      weightedSum += avg * w;
      weightSum += w;
    }
    const categories = catMap.size;
    const weightedSignal = weightSum > 0 ? weightedSum / weightSum : 0;
    const categoryBoost = Math.sqrt(categories);
    const score = Math.round(categoryBoost * weightedSignal * 100) / 100;
    return {
      region: 'GLOBAL',
      categories,
      weightedSignal: Math.round(weightedSignal * 1000) / 1000,
      convergenceScore: score,
      categorySignals,
    };
  }

  stats() {
    const byCategory = {};
    for (const s of this.signals) byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    return {
      totalSignals: this.signals.length,
      byCategory,
      regionsCount: this._byRegion().size,
      minCategories: this.minCategories,
      minSignal: this.minSignal,
    };
  }

  clear() {
    this.signals = [];
  }
}

export { CATEGORY_WEIGHTS, LEVELS };
