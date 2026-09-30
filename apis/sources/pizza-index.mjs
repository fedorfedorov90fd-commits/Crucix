// Crucix — PizzaIndex (внутренний индекс активности у штаб-квартир)
export default class PizzaIndex {
  constructor() { this.observations = new Map(); }
  add(location, orders, timestamp = Date.now()) {
    if (!this.observations.has(location)) this.observations.set(location, []);
    this.observations.get(location).push({ orders, timestamp });
    return this;
  }
  compute(location) {
    const arr = this.observations.get(location) || [];
    if (arr.length < 7) return { location, ready: false, samples: arr.length };
    const recent = arr.slice(-7);
    const baseline = arr.slice(-30, -7);
    const avgRecent = recent.reduce((s, x) => s + x.orders, 0) / recent.length;
    const avgBaseline = baseline.length > 0 ? baseline.reduce((s, x) => s + x.orders, 0) / baseline.length : avgRecent;
    const ratio = avgBaseline > 0 ? avgRecent / avgBaseline : 1;
    return { location, ratio: Math.round(ratio * 100) / 100, avgRecent, avgBaseline, anomaly: ratio >= 2.0 ? 'high' : ratio >= 1.5 ? 'moderate' : 'normal', ready: true };
  }
  getAll() { return [...this.observations.keys()].map(l => this.compute(l)); }
}
