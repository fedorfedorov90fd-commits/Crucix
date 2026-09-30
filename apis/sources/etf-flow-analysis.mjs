// Crucix — ETFFlowAnalysis
export default class ETFFlowAnalysis {
  constructor() { this.flows = new Map(); }
  addFlow(asset, flowUSD, timestamp = Date.now()) {
    if (!this.flows.has(asset)) this.flows.set(asset, []);
    this.flows.get(asset).push({ flow: flowUSD, timestamp });
    return this;
  }
  analyze(asset) {
    const arr = this.flows.get(asset) || [];
    if (arr.length === 0) return null;
    const recent = arr.slice(-7);
    const netFlow = recent.reduce((s, x) => s + x.flow, 0);
    const avg = netFlow / recent.length;
    const trend = avg > 0 ? 'inflow' : avg < 0 ? 'outflow' : 'flat';
    return { asset, netFlow7d: netFlow, avgDaily: avg, trend, samples: recent.length };
  }
  getAll() { return [...this.flows.keys()].map(a => this.analyze(a)).filter(Boolean); }
  topInflows(n = 5) { return this.getAll().sort((a, b) => b.netFlow7d - a.netFlow7d).slice(0, n); }
  topOutflows(n = 5) { return this.getAll().sort((a, b) => a.netFlow7d - b.netFlow7d).slice(0, n); }
}
