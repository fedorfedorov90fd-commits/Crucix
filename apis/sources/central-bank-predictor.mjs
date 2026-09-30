export default class CentralBankPredictor {
  constructor() { this.banks = new Map(); }
  update(code, data) { if (!this.banks.has(code)) this.banks.set(code, []); this.banks.get(code).push({ ...data, timestamp: Date.now() }); return this; }
  predict(code) {
    const arr = this.banks.get(code) || [];
    if (arr.length < 2) return { code, ready: false, samples: arr.length };
    const latest = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    const trend = latest.rate - prev.rate;
    const direction = trend > 0.05 ? 'hike' : trend < -0.05 ? 'cut' : 'hold';
    const nextMeetingProbability = {
      hike: Math.min(Math.abs(trend) * 10, 0.9),
      cut: Math.min(Math.abs(trend) * 10, 0.9),
      hold: 0.7,
    };
    return { code, currentRate: latest.rate, lastChange: Math.round(trend * 100) / 100, direction, nextMeetingProbability: Math.round(nextMeetingProbability[direction] * 100) / 100 };
  }
  getAll() { return [...this.banks.keys()].map(c => this.predict(c)); }
}
