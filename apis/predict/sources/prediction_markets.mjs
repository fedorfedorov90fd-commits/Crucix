// apis/sources/prediction_markets.mjs
// Интеграция рынков предсказаний: Polymarket, Metaculus, Kalshi, Manifold
// Cross-platform арбитраж-анализ + взвешивание с Crucix-прогнозами
//
// Применение в Crucix:
//   31-й источник. Прогнозные рынки как внешний калибратор для
//   Crucix-прогнозов. Расхождение между консенсусом рынков и
//   моделью Crucix — сигнал неопределённости или ошибки входных данных.
//
// Платформы:
//   Polymarket  — блокчейн, крупнейший объём по геополитике
//   Metaculus   — краудсорсинг экспертов, длинные горизонты
//   Kalshi      — регулируемый CFTC, финансовые и политические события
//   Manifold    — play money, быстрая реакция на новости

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- КОНФИГУРАЦИЯ ПЛАТФОРМ -------------------------

const PLATFORMS = {
  polymarket: {
    name: 'Polymarket',
    apiUrl: 'https://gamma-api.polymarket.com',
    clobUrl: 'https://clob.polymarket.com',
    wsUrl: 'wss://ws-subscriptions-clob.polymarket.com/ws',
    freeAccess: true,
    authRequired: false,
    type: 'blockchain',
  },
  metaculus: {
    name: 'Metaculus',
    apiUrl: 'https://www.metaculus.com/api',
    freeAccess: true,
    authRequired: false,
    type: 'crowdsourced',
  },
  kalshi: {
    name: 'Kalshi',
    apiUrl: 'https://trading-api.kalshi.com/v1',
    freeAccess: true,
    authRequired: true,
    type: 'regulated_cftc',
  },
  manifold: {
    name: 'Manifold Markets',
    apiUrl: 'https://api.manifold.markets/v0',
    freeAccess: true,
    authRequired: false,
    type: 'play_money',
  },
};

// --- FETCHERS --------------------------------------

/**
 * Получение рынков с Polymarket (Gamma API)
 */
export async function fetchPolymarket(query = null) {
  try {
    const url = query
      ? `${PLATFORMS.polymarket.apiUrl}/markets?_q=${encodeURIComponent(query)}&limit=50&closed=false`
      : `${PLATFORMS.polymarket.apiUrl}/markets?limit=50&closed=false&order=volume&ascending=false`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Polymarket API: ${response.status}`);

    const markets = await response.json();
    if (!Array.isArray(markets)) return [];

    return markets.map(m => ({
      platform: 'polymarket',
      id: m.id || m.conditionId,
      question: m.question || m.title,
      category: m.category || 'general',
      probability: parseFloat(m.outcomeProbabilities?.[0] || m.lastTradePrice || 0),
      volume: parseFloat(m.volume || 0),
      liquidity: parseFloat(m.liquidity || 0),
      endDate: m.endDate,
      active: m.active !== false,
      url: m.slug ? `https://polymarket.com/event/${m.slug}` : null,
    }));
  } catch (e) {
    console.error('[prediction_markets] Polymarket error:', e.message);
    return [];
  }
}

/**
 * Получение прогнозов с Metaculus
 */
export async function fetchMetaculus(query = null) {
  try {
    const params = new URLSearchParams({
      limit: '50',
      status: 'open',
      order_by: '-activity',
    });
    if (query) params.set('search', query);

    const response = await fetch(`${PLATFORMS.metaculus.apiUrl}/predictions/?${params}`);
    if (!response.ok) throw new Error(`Metaculus API: ${response.status}`);

    const data = await response.json();
    const predictions = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);

    return predictions.map(p => ({
      platform: 'metaculus',
      id: p.id,
      question: p.title || p.question,
      category: p.tag || 'general',
      probability: p.community_prediction?.full?.q2 || p.forecast_values?.[0] || 0.5,
      forecastCount: p.forecasts_count || 0,
      endDate: p.resolve_time,
      active: p.is_active !== false,
      url: `https://www.metaculus.com/questions/${p.id}/`,
    }));
  } catch (e) {
    console.error('[prediction_markets] Metaculus error:', e.message);
    return [];
  }
}

/**
 * Получение рынков с Kalshi
 */
export async function fetchKalshi(query = null) {
  try {
    const params = new URLSearchParams({ limit: '50', status: 'open' });
    if (query) params.set('event_ticker', query);

    const response = await fetch(`${PLATFORMS.kalshi.apiUrl}/markets?${params}`);
    if (!response.ok) throw new Error(`Kalshi API: ${response.status}`);

    const data = await response.json();
    const markets = Array.isArray(data.markets) ? data.markets : [];

    return markets.map(m => ({
      platform: 'kalshi',
      id: m.ticker,
      question: m.title || m.subtitle,
      category: m.event_ticker || 'general',
      probability: m.last_price ? m.last_price / 100 : 0.5,
      volume: m.volume || 0,
      endDate: m.expiration_time,
      active: m.status === 'open',
      url: `https://kalshi.com/markets/${m.event_ticker}`,
    }));
  } catch (e) {
    console.error('[prediction_markets] Kalshi error:', e.message);
    return [];
  }
}

/**
 * Получение рынков с Manifold
 */
export async function fetchManifold(query = null) {
  try {
    const url = query
      ? `${PLATFORMS.manifold.apiUrl}/search-markets?term=${encodeURIComponent(query)}&limit=50&filter=open&sort=liquidity`
      : `${PLATFORMS.manifold.apiUrl}/markets?limit=50&filter=open&sort=liquidity`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Manifold API: ${response.status}`);

    const markets = await response.json();
    if (!Array.isArray(markets)) return [];

    return markets.map(m => ({
      platform: 'manifold',
      id: m.id,
      question: m.question,
      category: m.groupSlugs?.[0] || 'general',
      probability: m.probability,
      volume: m.volume || 0,
      liquidity: m.liquidity || 0,
      endDate: m.closeTime,
      active: m.isResolved === false,
      url: m.url,
    }));
  } catch (e) {
    console.error('[prediction_markets] Manifold error:', e.message);
    return [];
  }
}

// --- CROSS-PLATFORM АНАЛИЗ -------------------------

/**
 * Cross-platform арбитраж-анализ
 * Расхождения между платформами как сигнал неопределённости
 */
export function crossPlatformAnalysis(allMarkets) {
  // Защита от не-массива
  if (!Array.isArray(allMarkets) || allMarkets.length === 0) {
    return {
      groups: [],
      totalMarkets: 0,
      crossPlatformGroups: 0,
      highUncertaintyCount: 0,
    };
  }

  // Группировка по похожим вопросам
  const groups = groupSimilarQuestions(allMarkets);

  const analysis = groups.map(group => {
    const probs = group.markets.map(m => m.probability);
    const platforms = group.markets.map(m => m.platform);

    const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
    const variance = probs.reduce((s, p) => s + (p - mean) ** 2, 0) / probs.length;
    const std = Math.sqrt(variance);
    const maxDisagreement = Math.max(...probs) - Math.min(...probs);

    // Взвешенная вероятность по объёму/ликвидности
    const totalWeight = group.markets.reduce((s, m) => s + (m.volume || m.liquidity || 1), 0);
    const weightedProb = group.markets.reduce((s, m) =>
      s + m.probability * (m.volume || m.liquidity || 1), 0) / totalWeight;

    return {
      question: group.canonicalQuestion,
      platforms,
      probabilities: probs,
      mean,
      std,
      maxDisagreement,
      weightedProb,
      consensus: maxDisagreement < 0.1 ? 'strong' : maxDisagreement < 0.2 ? 'moderate' : 'weak',
      signal: maxDisagreement > 0.25 ? 'high_uncertainty' : 'low_uncertainty',
    };
  });

  return {
    groups: analysis,
    totalMarkets: allMarkets.length,
    crossPlatformGroups: analysis.length,
    highUncertaintyCount: analysis.filter(a => a.signal === 'high_uncertainty').length,
  };
}

function groupSimilarQuestions(markets) {
  const groups = [];
  const used = new Set();

  for (let i = 0; i < markets.length; i++) {
    if (used.has(i)) continue;
    const group = { canonicalQuestion: markets[i].question, markets: [markets[i]] };
    used.add(i);

    for (let j = i + 1; j < markets.length; j++) {
      if (used.has(j)) continue;
      const sim = textSimilarity(markets[i].question, markets[j].question);
      if (sim > 0.6) {
        group.markets.push(markets[j]);
        used.add(j);
      }
    }
    if (group.markets.length >= 2) groups.push(group);
  }
  return groups;
}

function textSimilarity(a, b) {
  const tokensA = new Set((a || '').toLowerCase().split(/\s+/));
  const tokensB = new Set((b || '').toLowerCase().split(/\s+/));
  const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
  const union = new Set([...tokensA, ...tokensB]).size;
  return union > 0 ? intersection / union : 0;
}

// --- АНСЕМБЛИРОВАНИЕ С CRUCIX ----------------------

/**
 * Взвешивание рыночных вероятностей с прогнозами Crucix
 */
export function ensembleWithCrucix(marketData, crucixForecast) {
  // Вес рынков предсказаний зависит от:
  // 1. Объёма (больше объём — больше вес)
  // 2. Платформы (регулируемые = больше вес)
  // 3. Количества трейдеров
  const platformWeights = {
    kalshi: 1.2,      // CFTC-регулируемый
    polymarket: 1.0,  // блокчейн, большой объём
    metaculus: 0.8,   // краудсорсинг экспертов
    manifold: 0.5,    // play money
  };

  const markets = Array.isArray(marketData) ? marketData : [];
  const forecast = crucixForecast || { probability: 0.5 };

  let totalWeight = 0;
  let weightedSum = 0;

  for (const m of markets) {
    const volWeight = Math.log10((m.volume || 1) + 1);
    const platformWeight = platformWeights[m.platform] || 0.5;
    const weight = volWeight * platformWeight;
    weightedSum += m.probability * weight;
    totalWeight += weight;
  }

  const marketConsensus = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  // Ансамбль: 60% Crucix + 40% рынки (настраиваемо)
  const crucixWeight = 0.6;
  const marketWeight = 0.4;

  const ensemble = forecast.probability * crucixWeight + marketConsensus * marketWeight;

  // Расхождение как сигнал
  const divergence = Math.abs(forecast.probability - marketConsensus);

  return {
    crucixProb: forecast.probability,
    marketConsensus,
    ensembleProb: ensemble,
    divergence,
    divergenceSignal: divergence > 0.2 ? 'significant' : divergence > 0.1 ? 'moderate' : 'minimal',
    recommendation: divergence > 0.2
      ? 'Существенное расхождение между Crucix и рынками — проверьте входные данные'
      : 'Прогнозы согласуются',
  };
}

// --- ИНТЕГРАЦИЯ С CRUCIX ---------------------------

export async function fetchPredictionMarkets(query = null) {
  const [polymarket, metaculus, kalshi, manifold] = await Promise.all([
    fetchPolymarket(query),
    fetchMetaculus(query),
    fetchKalshi(query),
    fetchManifold(query),
  ]);

  const allMarkets = [...polymarket, ...metaculus, ...kalshi, ...manifold];
  const crossAnalysis = crossPlatformAnalysis(allMarkets);

  const result = {
    timestamp: new Date().toISOString(),
    source: 'prediction_markets',
    totalMarkets: allMarkets.length,
    byPlatform: {
      polymarket: polymarket.length,
      metaculus: metaculus.length,
      kalshi: kalshi.length,
      manifold: manifold.length,
    },
    markets: allMarkets,
    crossAnalysis,
  };

  try {
    const dir = join(__dirname, '..', '..', 'runs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'prediction_markets_latest.json'),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    console.error('[prediction_markets] write error:', e.message);
  }

  return result;
}

export { PLATFORMS };
