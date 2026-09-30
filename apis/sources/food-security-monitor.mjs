export default class FoodSecurityMonitor {
  constructor() { this.countries = new Map(); }
  update(code, data) { this.countries.set(code, { code, ...data, updated: Date.now() }); return this; }
  score(code) {
    const c = this.countries.get(code);
    if (!c) return null;
    const availability = c.calorieAvailability ?? 2500;
    const affordability = c.foodAffordability ?? 0.5;
    const stability = c.supplyStability ?? 0.5;
    const score = (Math.min(availability / 3000, 1) * 0.4 + affordability * 0.3 + stability * 0.3) * 100;
    return { code, score: Math.round(score * 100) / 100, level: score >= 75 ? 'secure' : score >= 50 ? 'moderate' : score >= 30 ? 'at_risk' : 'critical' };
  }
  getAll() { return [...this.countries.keys()].map(c => this.score(c)).filter(Boolean).sort((a, b) => a.score - b.score); }
}
