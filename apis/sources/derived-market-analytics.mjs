// Crucix — DerivedMarketAnalytics
// Производные рыночные метрики: gold/oil ratio, copper/gold, VIX/SP500.

export default class DerivedMarketAnalytics {
  constructor() { this.derived = new Map(); }
  compute(input) {
    const out = { timestamp: Date.now() };
    if (input.gold && input.oil) out.goldOilRatio = +(input.gold / input.oil).toFixed(2);
    if (input.copper && input.gold) out.copperGoldRatio = +(input.copper / input.gold * 1000).toFixed(2);
    if (input.vix && input.sp500) out.vixSp500Ratio = +(input.vix / input.sp500 * 100).toFixed(3);
    if (input.gold && input.silver) out.goldSilverRatio = +(input.gold / input.silver).toFixed(2);
    if (input.oil && input.gas) out.oilGasRatio = +(input.oil / input.gas).toFixed(2);
    // Сигналы
    out.signals = [];
    if (out.goldOilRatio && out.goldOilRatio > 40) out.signals.push({ signal: 'risk_off', reason: 'Gold/Oil > 40 — золото дорого относительно нефти' });
    if (out.copperGoldRatio && out.copperGoldRatio < 0.15) out.signals.push({ signal: 'recession_warning', reason: 'Copper/Gold < 0.15 — риск рецессии' });
    if (out.vixSp500Ratio && out.vixSp500Ratio > 1.5) out.signals.push({ signal: 'volatility_high', reason: 'VIX/SP500 > 1.5 — волатильность выше нормы' });
    if (out.goldSilverRatio && out.goldSilverRatio > 90) out.signals.push({ signal: 'risk_off_strong', reason: 'Gold/Silver > 90 — сильный risk-off' });
    this.derived.set(out.timestamp, out);
    return out;
  }
  getAll() { return [...this.derived.values()]; }
  latest() { return this.getAll().slice(-1)[0] || null; }
}
