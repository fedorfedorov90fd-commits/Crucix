export default class FXReservesMonitor {
  constructor() { this.reserves = new Map(); }
  update(country, usd, months, timestamp = Date.now()) {
    if (!this.reserves.has(country)) this.reserves.set(country, []);
    this.reserves.get(country).push({ usd, months, timestamp });
    return this;
  }
  assess(country) {
    const arr = this.reserves.get(country) || [];
    if (arr.length === 0) return null;
    const latest = arr[arr.length - 1];
    const prev = arr.length >= 2 ? arr[arr.length - 2] : latest;
    const changePct = prev.usd > 0 ? ((latest.usd - prev.usd) / prev.usd) * 100 : 0;
    const risk = latest.months < 3 ? 'critical' : latest.months < 6 ? 'high' : latest.months < 12 ? 'moderate' : 'low';
    return { country, usdReserves: latest.usd, monthsImportCover: latest.months, changePct: Math.round(changePct * 100) / 100, risk };
  }
  getAll() { return [...this.reserves.keys()].map(c => this.assess(c)).filter(Boolean); }
  weakest(n = 10) { return this.getAll().sort((a, b) => a.monthsImportCover - b.monthsImportCover).slice(0, n); }
}
