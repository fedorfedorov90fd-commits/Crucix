export default class EnergyMarketIntelligence {
  constructor() { this.prices = new Map(); this.signals = []; }
  update(commodity, price, timestamp = Date.now()) {
    if (!this.prices.has(commodity)) this.prices.set(commodity, []);
    this.prices.get(commodity).push({ price, timestamp });
    return this;
  }
  analyze(commodity) {
    const arr = this.prices.get(commodity) || [];
    if (arr.length < 2) return null;
    const latest = arr[arr.length - 1].price;
    const first = arr[0].price;
    const changePct = first > 0 ? ((latest - first) / first) * 100 : 0;
    const trend = changePct > 5 ? 'rising_strong' : changePct > 1 ? 'rising' : changePct < -5 ? 'falling_strong' : changePct < -1 ? 'falling' : 'stable';
    return { commodity, latest, changePct: Math.round(changePct * 100) / 100, trend };
  }
  getAll() { return [...this.prices.keys()].map(c => this.analyze(c)).filter(Boolean); }
}
