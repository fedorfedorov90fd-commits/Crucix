// Crucix — RiskSignalAggregator
export default class RiskSignalAggregator {
  constructor(opts = {}) { this.signals = []; this.maxSignals = opts.maxSignals ?? 5000; }
  add(s) { this.signals.push({ ...s, added: Date.now() }); if (this.signals.length > this.maxSignals) this.signals.shift(); return this; }
  byRegion() {
    const g = {};
    for (const s of this.signals) {
      const r = s.region || 'GLOBAL';
      if (!g[r]) g[r] = { region: r, count: 0, sum: 0 };
      g[r].count++;
      g[r].sum += s.severity || 0.5;
    }
    return Object.values(g).map(x => ({ ...x, avgSeverity: x.sum / x.count, riskScore: Math.min(x.count * x.sum / x.count * 10, 100) })).sort((a, b) => b.riskScore - a.riskScore);
  }
  topRegions(n = 10) { return this.byRegion().slice(0, n); }
  total() { return this.signals.length; }
}
