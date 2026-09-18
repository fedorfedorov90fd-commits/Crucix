export default class CyberAttackMonitor {
  constructor() { this.attacks = []; }
  add(a) { this.attacks.push({ ...a, added: Date.now() }); return this; }
  byTarget(code) { return this.attacks.filter(a => a.target === code); }
  byType(type) { return this.attacks.filter(a => a.type === type); }
  severityScore(a) {
    let s = 0.3;
    if (a.type === 'ransomware') s += 0.4;
    if (a.type === 'apt') s += 0.5;
    if (a.impact === 'critical_infrastructure') s += 0.3;
    if (a.attributed_to_state) s += 0.2;
    return Math.min(s, 1);
  }
  topBySeverity(n = 20) { return [...this.attacks].map(a => ({ ...a, severity: this.severityScore(a) })).sort((a, b) => b.severity - a.severity).slice(0, n); }
  summarize() {
    const g = {};
    for (const a of this.attacks) {
      const t = a.type || 'unknown';
      g[t] = (g[t] || 0) + 1;
    }
    return g;
  }
  getAll() { return [...this.attacks]; }
}
