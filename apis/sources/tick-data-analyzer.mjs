export default class TickDataAnalyzer {
  constructor(opts = {}) { this.ticks = new Map(); this.windowMs = opts.windowMs ?? 60000; }
  add(symbol, tick) { if (!this.ticks.has(symbol)) this.ticks.set(symbol, []); this.ticks.get(symbol).push({ ...tick, receivedAt: Date.now() }); return this; }
  analyze(symbol) {
    const arr = this.ticks.get(symbol) || [];
    if (arr.length < 2) return null;
    const cutoff = Date.now() - this.windowMs;
    const window = arr.filter(t => t.receivedAt >= cutoff);
    if (window.length < 2) return null;
    const prices = window.map(t => t.price).filter(p => typeof p === 'number');
    const first = prices[0], last = prices[prices.length - 1];
    const change = last - first;
    const changePct = first > 0 ? (change / first) * 100 : 0;
    const maxPrice = Math.max(...prices), minPrice = Math.min(...prices);
    const volatility = (maxPrice - minPrice) / first * 100;
    return { symbol, ticks: window.length, lastPrice: last, changePct: Math.round(changePct * 100) / 100, volatilityPct: Math.round(volatility * 100) / 100 };
  }
  getAll() { return [...this.ticks.keys()].map(s => this.analyze(s)).filter(Boolean); }
}
