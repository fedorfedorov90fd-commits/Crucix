// apis/predict/sources/market.mjs
// Источник рыночных данных для прогностического ядра Crucix.
//
// Назначение:
//   35-й источник. Рыночные индикаторы (акции, волатильность, commodities,
//   валюты, кривая доходности, credit spreads) как опережающие сигналы
//   экономических и геополитических сдвигов.
//
// Источники данных:
//   - Yahoo Finance (публичные endpoints)
//   - FRED (Federal Reserve Economic Data)
//   - CBOE (VIX, VVIX, OVX)
//   - LBMA (London Bullion Market — золото, серебро)
//   - ICE (нефть Brent, газ)
//   - US Treasury (yield curve)
//
// Экспортирует:
//   - fetchMarketData() — главная функция
//   - fetchYahooQuote() — котировка
//   - fetchFREDSeries() — серия FRED
//   - computeMarketRegime() — определение режима рынка
//   - INDICATORS — конфигурация индикаторов
//   - FRED_SERIES — конфигурация FRED-серий
//   - SOURCES — конфигурация источников
//
// Версия: 1.0.0

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const RUNS_DIR = join(PROJECT_ROOT, 'runs', 'predictions');

// --- КОНФИГУРАЦИЯ ИСТОЧНИКОВ ----------------------

export const SOURCES = {
  yahoo: {
    name: 'Yahoo Finance',
    apiUrl: 'https://query1.finance.yahoo.com/v8/finance/chart',
    freeAccess: true,
    authRequired: false,
    note: 'Публичный endpoint, может требовать User-Agent',
  },
  fred: {
    name: 'FRED (Federal Reserve Economic Data)',
    apiUrl: 'https://fred.stlouisfed.org/graph/fredgraph.csv',
    freeAccess: true,
    authRequired: false,
    note: 'CSV endpoint, публичный',
  },
  cboe: {
    name: 'CBOE',
    apiUrl: 'https://cdn.cboe.com/api/global/us_indices/daily_prices',
    freeAccess: true,
    authRequired: false,
  },
  lbma: {
    name: 'LBMA (London Bullion Market Association)',
    apiUrl: 'https://prices.lbma.org.uk/json',
    freeAccess: true,
    authRequired: false,
  },
  ice: {
    name: 'ICE (Intercontinental Exchange)',
    freeAccess: false,
    authRequired: true,
    note: 'Требует подписку, используем Yahoo как прокси',
  },
};

// --- КОНФИГУРАЦИЯ ИНДИКАТОРОВ ---------------------

export const INDICATORS = {
  vix: {
    name: 'VIX',
    description: 'Volatility Index (CBOE)',
    category: 'volatility',
    source: 'yahoo',
    ticker: '^VIX',
    thresholds: { low: 15, medium: 25, high: 35, crisis: 50 },
  },
  dxy: {
    name: 'DXY',
    description: 'US Dollar Index',
    category: 'currency',
    source: 'yahoo',
    ticker: 'DX-Y.NYB',
    thresholds: { low: 95, medium: 105, high: 110, crisis: 115 },
  },
  gold: {
    name: 'Gold',
    description: 'Gold Spot USD/oz',
    category: 'commodity',
    source: 'yahoo',
    ticker: 'GC=F',
    thresholds: { low: 1800, medium: 2200, high: 2500, crisis: 3000 },
  },
  oil_brent: {
    name: 'Brent Oil',
    description: 'Brent Crude USD/bbl',
    category: 'commodity',
    source: 'yahoo',
    ticker: 'BZ=F',
    thresholds: { low: 60, medium: 80, high: 100, crisis: 130 },
  },
  sp500: {
    name: 'S&P 500',
    description: 'S&P 500 Index',
    category: 'equity',
    source: 'yahoo',
    ticker: '^GSPC',
    thresholds: { low: 3800, medium: 4500, high: 5500, crisis: 6000 },
  },
  btc: {
    name: 'Bitcoin',
    description: 'Bitcoin USD',
    category: 'crypto',
    source: 'yahoo',
    ticker: 'BTC-USD',
    thresholds: { low: 30000, medium: 60000, high: 90000, crisis: 120000 },
  },
};

// --- FRED SERIES ----------------------------------

export const FRED_SERIES = {
  yield_10y: {
    name: '10-Year Treasury',
    seriesId: 'DGS10',
    category: 'rates',
  },
  yield_2y: {
    name: '2-Year Treasury',
    seriesId: 'DGS2',
    category: 'rates',
  },
  hy_spread: {
    name: 'High Yield Spread',
    seriesId: 'BAMLH0A0HYM2',
    category: 'credit',
  },
  tips_10y: {
    name: '10Y TIPS',
    seriesId: 'DFII10',
    category: 'rates',
  },
  fed_funds: {
    name: 'Fed Funds Rate',
    seriesId: 'FEDFUNDS',
    category: 'rates',
  },
};

// --- FETCH-ФУНКЦИИ --------------------------------

/**
 * Получение котировки Yahoo Finance.
 * @param {string} ticker — тикер (например, '^VIX')
 * @returns {Promise<Object>} котировка с полями price, change, changePct
 */
export async function fetchYahooQuote(ticker) {
  try {
    const url = `${SOURCES.yahoo.apiUrl}/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Crucix-Bot/1.0' },
    });
    if (!response.ok) throw new Error(`Yahoo API: ${response.status}`);

    const data = await response.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error('Yahoo: пустой результат');

    const meta = result.meta;
    const quote = result.indicators?.quote?.[0];
    const closes = (quote?.close || []).filter(c => c !== null);
    const price = meta.regularMarketPrice || closes[closes.length - 1] || 0;
    const prevClose = meta.chartPreviousClose || closes[closes.length - 2] || price;

    return {
      ticker,
      name: meta.longName || meta.shortName || ticker,
      price: parseFloat(price.toFixed(4)),
      prevClose: parseFloat(prevClose.toFixed(4)),
      change: parseFloat((price - prevClose).toFixed(4)),
      changePct: parseFloat(((price - prevClose) / prevClose * 100).toFixed(4)),
      currency: meta.currency || 'USD',
      timestamp: new Date().toISOString(),
      closes: closes.slice(-5),
    };
  } catch (e) {
    console.error(`[market] Yahoo ${ticker} error:`, e.message);
    return { ticker, error: e.message, price: null };
  }
}

/**
 * Получение серии FRED.
 * @param {string} seriesId — ID серии (например, 'DGS10')
 * @returns {Promise<Object>} серия
 */
export async function fetchFREDSeries(seriesId) {
  try {
    // Пробуем локальный источник
    const localFile = join(BASKET_DIR, 'fred.json');
    if (existsSync(localFile)) {
      const data = JSON.parse(readFileSync(localFile, 'utf-8'));
      const series = data[seriesId] || (Array.isArray(data) ? data.find(s => s.id === seriesId) : null);
      if (series) return series;
    }

    // Fallback — публичный endpoint FRED
    const url = `${SOURCES.fred.apiUrl}?id=${seriesId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FRED API: ${response.status}`);

    const csv = await response.text();
    const lines = csv.trim().split('\n').slice(1);
    const values = lines
      .map(l => {
        const [date, value] = l.split(',');
        return { date, value: parseFloat(value) };
      })
      .filter(v => !isNaN(v.value))
      .slice(-30);

    return {
      seriesId,
      values,
      latest: values[values.length - 1] || null,
    };
  } catch (e) {
    console.error(`[market] FRED ${seriesId} error:`, e.message);
    return { seriesId, values: [], latest: null };
  }
}

// --- АНАЛИЗ ---------------------------------------

/**
 * Определение режима рынка по индикаторам.
 * @param {Object} data — агрегированные данные индикаторов
 * @returns {Object} режим рынка
 */
export function computeMarketRegime(data = {}) {
  const scores = {};

  // VIX
  if (data.vix?.price) {
    const vix = data.vix.price;
    scores.volatility =
      vix > 50 ? 1.0 :
      vix > 35 ? 0.8 :
      vix > 25 ? 0.6 :
      vix > 15 ? 0.3 :
      0.1;
  }

  // DXY
  if (data.dxy?.price) {
    const dxy = data.dxy.price;
    scores.dollarStrength = dxy > 110 ? 0.8 : dxy > 105 ? 0.6 : dxy > 95 ? 0.3 : 0.1;
  }

  // Gold vs Oil ratio — risk-off indicator
  if (data.gold?.price && data.oil_brent?.price) {
    const ratio = data.gold.price / data.oil_brent.price;
    scores.riskOff = ratio > 30 ? 0.8 : ratio > 25 ? 0.5 : 0.3;
  }

  // Yield curve
  if (data.yield_10y?.latest?.value && data.yield_2y?.latest?.value) {
    const spread = data.yield_10y.latest.value - data.yield_2y.latest.value;
    scores.yieldCurve = spread < 0 ? 1.0 : spread < 0.5 ? 0.6 : 0.2;
  }

  // Credit spread
  if (data.hy_spread?.latest?.value) {
    const spread = data.hy_spread.latest.value;
    scores.creditStress = spread > 6 ? 1.0 : spread > 4 ? 0.7 : spread > 3 ? 0.4 : 0.2;
  }

  // Общий режим
  const values = Object.values(scores);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  let regime = 'neutral';
  if (avg > 0.7) regime = 'crisis';
  else if (avg > 0.5) regime = 'risk_off';
  else if (avg < 0.3) regime = 'risk_on';

  return {
    regime,
    score: Math.min(1.0, avg),
    components: scores,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Главная функция — получить рыночные данные.
 * @returns {Promise<Object>} агрегированный результат
 */
export async function fetchMarketData() {
  const result = {
    timestamp: new Date().toISOString(),
    source: 'market',
    version: '1.0.0',
    indicators: {},
    regime: null,
    alerts: [],
  };

  try {
    // Параллельно запрашиваем все индикаторы
    const tickers = Object.entries(INDICATORS);
    const quotes = await Promise.all(tickers.map(([, cfg]) => fetchYahooQuote(cfg.ticker)));

    for (let i = 0; i < tickers.length; i++) {
      const [key] = tickers[i];
      result.indicators[key] = quotes[i];
    }

    // FRED-серии
    const fredKeys = Object.keys(FRED_SERIES);
    const fredData = await Promise.all(
      fredKeys.map(k => fetchFREDSeries(FRED_SERIES[k].seriesId))
    );
    for (let i = 0; i < fredKeys.length; i++) {
      result.indicators[fredKeys[i]] = fredData[i];
    }

    // Режим рынка
    result.regime = computeMarketRegime(result.indicators);

    // Алерты
    if (result.regime.regime === 'crisis' || result.regime.regime === 'risk_off') {
      result.alerts.push({
        severity: result.regime.regime === 'crisis' ? 'high' : 'medium',
        message: `Режим рынка: ${result.regime.regime} (score ${result.regime.score.toFixed(2)})`,
      });
    }

    // Сохраняем
    mkdirSync(RUNS_DIR, { recursive: true });
    writeFileSync(
      join(RUNS_DIR, 'market_latest.json'),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    result.error = e.message;
    console.error('[market] fetchMarketData error:', e.message);
  }

  return result;
}

export default fetchMarketData;
