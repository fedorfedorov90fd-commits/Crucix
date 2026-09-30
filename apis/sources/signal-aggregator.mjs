// Crucix — SignalAggregator
// Агрегация сигналов из разных модулей в единый поток.

export default class SignalAggregator {
  constructor(opts = {}) {
    this.signals = [];
    this.maxSignals = opts.maxSignals ?? 10000;
    this.weights = opts.weights || {};
  }

  add(signal) {
    const w = this.weights[signal.category] ?? 1.0;
    this.signals.push({
      ...signal,
      weight: (signal.weight ?? 0.5) * w,
      added: Date.now(),
    });
    if (this.signals.length > this.maxSignals) this.signals.shift();
    return this;
  }

  topN(n = 20) {
    return [...this.signals].sort((a, b) => b.weight - a.weight).slice(0, n);
  }

  byCategory() {
    const groups = {};
    for (const s of this.signals) {
      groups[s.category] = (groups[s.category] || 0) + 1;
    }
    return groups;
  }

  aggregatedScore(category) {
    const subset = category ? this.signals.filter(s => s.category === category) : this.signals;
    if (subset.length === 0) return 0;
    return subset.reduce((sum, s) => sum + s.weight, 0) / subset.length * 100;
  }

  clear() { this.signals = []; }
}
