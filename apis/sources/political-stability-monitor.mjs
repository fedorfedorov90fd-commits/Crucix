export default class PoliticalStabilityMonitor {
  constructor() { this.countries = new Map(); }
  update(code, metrics) { this.countries.set(code, { code, ...metrics, updated: Date.now() }); return this; }
  score(code) {
    const c = this.countries.get(code);
    if (!c) return null;
    const govt = c.governmentStability ?? 0.5;
    const protest = c.protestIntensity ?? 0.3;
    const corruption = c.corruptionPerception ?? 0.5;
    const legitimacy = c.legitimacyScore ?? 0.5;
    const score = (govt * 0.3 + (1 - protest) * 0.25 + (1 - corruption) * 0.2 + legitimacy * 0.25) * 100;
    return { code, score: Math.round(score * 100) / 100, level: score >= 75 ? 'stable' : score >= 50 ? 'moderate' : score >= 30 ? 'unstable' : 'critical' };
  }
  getAll() { return [...this.countries.keys()].map(c => this.score(c)).filter(Boolean).sort((a, b) => a.score - b.score); }
}
