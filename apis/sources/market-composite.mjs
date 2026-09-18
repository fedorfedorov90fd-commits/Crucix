// Crucix — MarketComposite (класс-вычислитель)
// Композитный рыночный риск: волатильность, commodities, валюты, bond yields.
// Читает данные из data/basket/.
//
// Используется анализатором scripts/analyzers/market-composite.mjs.

const MARKET_WEIGHTS = {
  volatility:  0.30,   // VIX и другие индексы волатильности
  commodities: 0.25,   // нефть, золото, газ
  currencies:  0.20,   // DXY и кросс-курсы
  bonds:       0.25,   // yields, спреды
};

// Пороговые значения для нормализации
const THRESHOLDS = {
  vix: { low: 15, mid: 25, high: 40, extreme: 60 },
  oil: { low: 60, mid: 85, high: 110, extreme: 140 },
  gold: { low: 1800, mid: 2100, high: 2500, extreme: 3000 },
  dxy: { low: 95, mid: 102, high: 108, extreme: 115 },
  yield10y: { low: 2, mid: 4, high: 5.5, extreme: 7 },
};

function normalize(value, thresholds) {
  if (value == null || !isFinite(value)) return 50;
  const { low, mid, high, extreme } = thresholds;
  if (value <= low) return 10;
  if (value <= mid) return 10 + (value - low) / (mid - low) * 20;      // 10-30
  if (value <= high) return 30 + (value - mid) / (high - mid) * 30;   // 30-60
  if (value <= extreme) return 60 + (value - high) / (extreme - high) * 30; // 60-90
  return Math.min(90 + (value - extreme) / extreme * 10, 100);
}

export default class MarketComposite {
  constructor() {
    this.store = new Map();
  }

  /**
   * Расчёт композитного рыночного риска.
   * @param {Object} input
   * @param {number} input.vix        — индекс волатильности
   * @param {number} input.oil        — цена нефти Brent
   * @param {number} input.gold       — цена золота
   * @param {number} input.dxy        — индекс доллара
   * @param {number} input.yield10y   — 10-летние трежерис
   * @param {number} input.hySpread   — спред высокодоходных облигаций
   * @param {string} [input.region]   — региональный разрез (опционально)
   */
  compute(input = {}) {
    const volatility  = normalize(input.vix, THRESHOLDS.vix);
    const commodities = this._commoditiesScore(input);
    const currencies  = normalize(input.dxy, THRESHOLDS.dxy);
    const bonds       = this._bondsScore(input);

    const score = (
      MARKET_WEIGHTS.volatility  * volatility +
      MARKET_WEIGHTS.commodities * commodities +
      MARKET_WEIGHTS.currencies  * currencies +
      MARKET_WEIGHTS.bonds       * bonds
    );

    const record = {
      region: input.region || 'GLOBAL',
      score: Math.round(score * 100) / 100,
      level: this._level(score),
      components: {
        volatility: Math.round(volatility * 100) / 100,
        commodities: Math.round(commodities * 100) / 100,
        currencies: Math.round(currencies * 100) / 100,
        bonds: Math.round(bonds * 100) / 100,
      },
      raw: {
        vix: input.vix ?? null,
        oil: input.oil ?? null,
        gold: input.gold ?? null,
        dxy: input.dxy ?? null,
        yield10y: input.yield10y ?? null,
        hySpread: input.hySpread ?? null,
      },
      weights: MARKET_WEIGHTS,
    };

    this.store.set(record.region, record);
    return record;
  }

  _commoditiesScore(input) {
    const oilScore = normalize(input.oil, THRESHOLDS.oil);
    const goldScore = normalize(input.gold, THRESHOLDS.gold);
    return (oilScore + goldScore) / 2;
  }

  _bondsScore(input) {
    const y10 = normalize(input.yield10y, THRESHOLDS.yield10y);
    // HY spread: чем выше — тем больше риск. Нормализация 200-800 bps
    let hyScore = 50;
    if (typeof input.hySpread === 'number') {
      hyScore = Math.min(Math.max((input.hySpread - 200) / 600 * 100, 0), 100);
    }
    return (y10 + hyScore) / 2;
  }

  _level(score) {
    if (score >= 75) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'moderate';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  get(region = 'GLOBAL') {
    return this.store.get(region) || null;
  }

  getAll() {
    return [...this.store.values()];
  }
}
