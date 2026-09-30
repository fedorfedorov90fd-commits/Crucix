// Crucix — StablecoinMonitor
export default class StablecoinMonitor {
  constructor(opts = {}) {
    this.stablecoins = new Map();
    this.pegThresholdBps = opts.pegThresholdBps ?? 50;
  }
  update(coin) {
    this.stablecoins.set(coin.symbol, { ...coin, updated: Date.now() });
    return this.assess(coin.symbol);
  }
  assess(symbol) {
    const c = this.stablecoins.get(symbol);
    if (!c) return null;
    const pegDeviationBps = Math.abs((c.price - 1.0) * 10000);
    const level = pegDeviationBps >= 200 ? 'critical' : pegDeviationBps >= 100 ? 'high' : pegDeviationBps >= this.pegThresholdBps ? 'moderate' : 'stable';
    return { symbol, price: c.price, pegDeviationBps: Math.round(pegDeviationBps), level, marketCap: c.marketCap || null, volume24h: c.volume24h || null };
  }
  getAll() { return [...this.stablecoins.keys()].map(s => this.assess(s)).filter(Boolean); }
  depegged() { return this.getAll().filter(c => c.level !== 'stable'); }
}
