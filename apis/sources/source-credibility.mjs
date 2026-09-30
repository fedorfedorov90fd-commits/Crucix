// Crucix — SourceCredibility
// Оценка достоверности источников на основе истории.

export default class SourceCredibility {
  constructor(opts = {}) {
    this.sources = new Map();
    this.defaultScore = opts.defaultScore ?? 0.5;
    this.decayDays = opts.decayDays ?? 30;
  }
  register(source, score) {
    this.sources.set(source, { source, score, history: [], samples: 0, lastUpdate: Date.now() });
    return this.sources.get(source);
  }
  observe(source, claim, wasTrue) {
    const s = this.sources.get(source) || this.register(source, this.defaultScore);
    s.history.push({ claim, wasTrue, timestamp: Date.now() });
    s.samples++;
    // Экспоненциальное сглаживание
    const alpha = 0.15;
    s.score = s.score * (1 - alpha) + (wasTrue ? 1 : 0) * alpha;
    s.lastUpdate = Date.now();
    return s.score;
  }
  get(source) { return this.sources.get(source) || null; }
  getAll() { return [...this.sources.values()]; }
  topN(n = 10) { return this.getAll().sort((a, b) => b.score - a.score).slice(0, n); }
  bottomN(n = 10) { return this.getAll().sort((a, b) => a.score - b.score).slice(0, n); }
}
