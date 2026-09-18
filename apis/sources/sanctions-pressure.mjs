// Crucix — SanctionsPressure
export default class SanctionsPressure {
  constructor() { this.entities = new Map(); }
  addSanction(s) {
    const key = s.country || s.entity;
    if (!this.entities.has(key)) this.entities.set(key, { key, sanctions: [], totalScore: 0 });
    const e = this.entities.get(key);
    e.sanctions.push({ type: s.type, source: s.source, date: s.date, weight: s.weight || 1 });
    e.totalScore += s.weight || 1;
    return e;
  }
  score(key) {
    const e = this.entities.get(key);
    if (!e) return 0;
    // Нормализация 0-100
    return Math.min(e.totalScore * 5, 100);
  }
  getAll() { return [...this.entities.values()].map(e => ({ key: e.key, sanctionsCount: e.sanctions.length, score: this.score(e.key) })); }
  topN(n = 10) { return this.getAll().sort((a, b) => b.score - a.score).slice(0, n); }
}
