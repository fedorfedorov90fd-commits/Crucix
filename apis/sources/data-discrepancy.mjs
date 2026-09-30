// Crucix — DataDiscrepancy (класс-вычислитель)
// Обнаружение расхождений между источниками данных по одной стране/показателю.
//
// Версия: 1.0.0
// Используется анализатором scripts/analyzers/data-discrepancy.mjs.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Когда две независимые базы (международная и национальная) показывают
//   разные значения одного показателя — это либо методологическая разница,
//   либо сокрытие. Отличить одно от другого можно по исторической
//   стабильности расхождения. Резкое увеличение расхождения — сигнал.
//   Метод: сравнение пар источников для каждой (страна, показатель), расчёт
//   относительного разброса (spreadPct) и робастного Z-score.

export default class DataDiscrepancy {
  constructor(opts = {}) {
    this.minSources = opts.minSources ?? 2;
    this.zThreshold = opts.zThreshold ?? 1.5;
    this.highSpreadPct = opts.highSpreadPct ?? 20;
    this.criticalSpreadPct = opts.criticalSpreadPct ?? 50;
    this.values = [];
  }

  addValue(v) {
    if (!v || v.country == null || v.indicator == null) return false;
    const num = Number(v.value);
    if (!Number.isFinite(num)) return false;
    this.values.push({
      source: v.source || 'unknown',
      country: String(v.country).toUpperCase(),
      indicator: String(v.indicator).toLowerCase(),
      value: num,
    });
    return true;
  }

  _median(arr) {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
  }

  _mad(arr, med) {
    if (arr.length === 0) return 0;
    const devs = arr.map(v => Math.abs(v - med));
    return this._median(devs);
  }

  detectDiscrepancies() {
    // Группируем по (country, indicator).
    const groups = new Map();
    for (const v of this.values) {
      const key = `${v.country}|${v.indicator}`;
      if (!groups.has(key)) groups.set(key, { country: v.country, indicator: v.indicator, bySource: new Map() });
      const g = groups.get(key);
      if (!g.bySource.has(v.source)) g.bySource.set(v.source, []);
      g.bySource.get(v.source).push(v.value);
    }

    const results = [];
    for (const [key, g] of groups) {
      if (g.bySource.size < this.minSources) continue;

      // Среднее по каждому источнику.
      const perSource = [];
      for (const [source, vals] of g.bySource) {
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        perSource.push({ source, mean, count: vals.length });
      }

      // Медиана и MAD по всем средним.
      const means = perSource.map(p => p.mean);
      const med = this._median(means);
      const deviation = this._mad(means, med);

      // Сравнение пар: относительный разброс.
      let maxPairPct = 0;
      let minMean = Infinity;
      let maxMean = -Infinity;
      for (const p of perSource) {
        if (p.mean < minMean) minMean = p.mean;
        if (p.mean > maxMean) maxMean = p.mean;
      }
      const range = maxMean - minMean;
      const base = Math.abs(med) > 0 ? Math.abs(med) : 1;
      maxPairPct = (range / base) * 100;

      // Z-score самого отклоняющегося источника.
      let maxZ = 0;
      let outlierSource = null;
      for (const p of perSource) {
        const z = deviation > 0 ? Math.abs(p.mean - med) / (1.4826 * deviation) : 0;
        if (z > maxZ) { maxZ = z; outlierSource = p.source; }
      }

      // Итоговая оценка расхождения.
      const spreadScore = maxPairPct / 20;
      const zScore = maxZ;
      const discrepancyScore = Math.round((spreadScore + zScore) * 100) / 100;

      if (discrepancyScore < this.zThreshold) continue;

      const level = maxPairPct >= this.criticalSpreadPct ? 'critical'
                  : maxPairPct >= this.highSpreadPct ? 'high'
                  : 'medium';

      results.push({
        key,
        country: g.country,
        indicator: g.indicator,
        sourceCount: g.bySource.size,
        sources: perSource.map(p => ({ source: p.source, mean: Math.round(p.mean * 100) / 100, count: p.count })),
        median: Math.round(med * 100) / 100,
        spreadPct: Math.round(maxPairPct * 100) / 100,
        maxZ: Math.round(maxZ * 100) / 100,
        outlierSource,
        discrepancyScore,
        level,
      });
    }

    return results.sort((a, b) => b.discrepancyScore - a.discrepancyScore);
  }

  byCountry() {
    const disc = this.detectDiscrepancies();
    const out = {};
    for (const d of disc) {
      if (!out[d.country]) out[d.country] = { indicators: 0, maxScore: 0, maxSpreadPct: 0, levels: {} };
      out[d.country].indicators++;
      if (d.discrepancyScore > out[d.country].maxScore) out[d.country].maxScore = d.discrepancyScore;
      if (d.spreadPct > out[d.country].maxSpreadPct) out[d.country].maxSpreadPct = d.spreadPct;
      out[d.country].levels[d.level] = (out[d.country].levels[d.level] || 0) + 1;
    }
    return out;
  }

  stats() {
    const countries = new Set(this.values.map(v => v.country));
    const indicators = new Set(this.values.map(v => v.indicator));
    const sources = new Set(this.values.map(v => v.source));
    return {
      totalValues: this.values.length,
      uniqueCountries: countries.size,
      uniqueIndicators: indicators.size,
      uniqueSources: sources.size,
      minSources: this.minSources,
      zThreshold: this.zThreshold,
    };
  }

  clear() {
    this.values = [];
  }
}
