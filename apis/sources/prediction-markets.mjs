// Crucix — PredictionMarkets
export default class PredictionMarkets {
  constructor() { this.markets = new Map(); }
  addMarket(m) {
    this.markets.set(m.id, { ...m, added: Date.now() });
    return this;
  }
  getAll() { return [...this.markets.values()]; }
  topByVolume(n = 10) { return this.getAll().sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, n); }
  topByProbability(n = 10) { return this.getAll().sort((a, b) => (b.probability || 0) - (a.probability || 0)).slice(0, n); }
  highCertainty(min = 0.8) { return this.getAll().filter(m => (m.probability || 0) >= min); }
}
