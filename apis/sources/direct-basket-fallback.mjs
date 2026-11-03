/**
 * apis/sources/direct-basket-fallback.mjs — ПРЯМОЙ ЧИТАТЕЛЬ BASKET
 *
 * КОНТРАКТ CRUCIX v2 (Layer).
 *
 * ПРОБЛЕМА: build-registry.mjs исключает 8 API через LAYER_EXCLUDE_SET:
 *   pmi-api, recession-api, crypto-fear-api, hy-spread-api,
 *   ovx-api, sp500-vix-api, vxx-api, yield-curve-api
 *
 * Но dashboard-5in1.html вызывает /api/pmi/, /api/recession/ и т.д.
 * Эти API должны работать на ДАШБОРДАХ, но не на КАРТАХ.
 *
 * РЕШЕНИЕ: этот модуль — прямой читатель basket для исключённых API.
 * Он не идёт в LAYER_EXCLUDE_SET (потому что это новый файл),
 * но отдаёт данные из basket для 8 исключённых.
 *
 * Регистрация: через build-registry.mjs (route = '/api/layers/direct-basket').
 * Использование: router.mjs → LEGACY_ALIASES → direct-basket-fallback.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/direct-basket';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📊',
  color: '#5bc0f8',
  vizType: 'choropleth',
  source: 'basket/*.json (direct)',
  cache: 60,
  description: 'Прямой читатель basket для исключённых API (pmi, recession, crypto-fear, hy-spread, ovx, sp500-vix, vxx, yield-curve)',
  unit: 'value',
};

// 8 исключённых API → файлы basket
const BASKET_MAP = {
  'acled': 'acled.json',
  'air-quality': 'air-quality.json',
  'aviation': 'aviation.json',
  'bdi': 'bdi.json',
  'big-mac': 'big-mac.json',
  'big-mac-alt': 'big-mac-alt.json',
  'big-mac-main': 'big-mac-main.json',
  'bls': 'bls.json',
  'cisa': 'cisa.json',
  'comtrade': 'comtrade.json',
  'consumer-confidence': 'consumer-confidence.json',
  'copper-gold': 'copper-gold.json',
  'covid': 'covid.json',
  'crypto-fear': 'crypto-fear.json',
  'cyber-threats': 'cyber-threats.json',
  'dark-ships': 'dark-ships.json',
  'darkweb': 'darkweb.json',
  'debt-gdp': 'debt-gdp.json',
  'dxy': 'dxy.json',
  'economy': 'economy.json',
  'eia': 'eia.json',
  'epa': 'epa.json',
  'firms': 'firms.json',
  'fred': 'fred.json',
  'gdelt': 'gdelt.json',
  'gold-oil-ratio': 'gold-oil-ratio.json',
  'gold-silver': 'gold-silver.json',
  'google-trends': 'google-trends.json',
  'gps-jamming': 'gps-jamming.json',
  'gscpi': 'gscpi.json',
  'happiness': 'happiness.json',
  'happiness-alt': 'happiness-alt.json',
  'hy-spread': 'hy-spread.json',
  'inflation': 'inflation.json',
  'maritime-monitor': 'maritime-monitor.json',
  'noaa': 'noaa.json',
  'notam': 'notam.json',
  'nuclear-monitor': 'nuclear-monitor.json',
  'ofac': 'ofac.json',
  'oil-gas': 'oil-gas.json',
  'opensanctions': 'opensanctions.json',
  'opensky': 'opensky.json',
  'ovx': 'ovx.json',
  'pmi': 'pmi.json',
  'recession': 'recession.json',
  'safecast': 'safecast.json',
  'satellites': 'satellites.json',
  'ships': 'ships.json',
  'silence': 'silence.json',
  'social-unrest': 'social-unrest.json',
  'sp500-vix': 'sp500-vix.json',
  'space': 'space.json',
  'thinktanks': 'thinktanks.json',
  'tips': 'tips.json',
  'unemployment': 'unemployment.json',
  'uranium': 'uranium.json',
  'usgs': 'usgs.json',
  'viirs': 'viirs.json',
  'vix': 'vix.json',
  'vxx': 'vxx.json',
  'war-preparation': 'war-preparation.json',
  'who': 'who.json',
  'yield-curve': 'yield-curve.json',
};

const _cache = new Map();
const CACHE_TTL = 60 * 1000;

async function loadBasket(name) {
  const now = Date.now();
  const cached = _cache.get(name);
  if (cached && (now - cached.time) < CACHE_TTL) return cached.data;

  const file = BASKET_MAP[name];
  if (!file) return null;

  try {
    const raw = await fs.readFile(join(BASKET_DIR, file), 'utf8');
    const data = JSON.parse(raw);
    _cache.set(name, { data, time: now });
    return data;
  } catch (e) {
    if (e.code === 'ENOENT') return { error: 'not_found', name, file };
    throw e;
  }
}

export async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  
  // Поддерживаем два формата:
  // 1. /api/layers/direct-basket/pmi  (прямой вызов)
  // 2. /api/pmi/                       (через LEGACY_ALIASES)
  let path = url.pathname;
  if (path.startsWith(route)) {
    path = path.slice(route.length);
  } else if (path.startsWith('/api/')) {
    path = path.slice('/api'.length);
  }
  path = path.replace(/\/$/, '');
  
  // path = '/pmi' или '/pmi/stats' или '/pmi/status'
  const parts = path.split('/').filter(Boolean);
  const name = parts[0];
  const sub = parts[1] || '';

  if (!name || !BASKET_MAP[name]) {
    res.statusCode = 404;
    return res.end(JSON.stringify({
      error: 'unknown_basket',
      name,
      available: Object.keys(BASKET_MAP),
    }));
  }

  try {
    const data = await loadBasket(name);

    if (sub === 'status') {
      const series = Array.isArray(data?.series) ? data.series : [];
      return res.end(JSON.stringify({
        status: data?.error ? 'degraded' : 'online',
        count: series.length,
        source: `basket/${BASKET_MAP[name]}`,
        generated_at: new Date().toISOString(),
      }));
    }

    if (sub === 'stats') {
      const series = Array.isArray(data?.series) ? data.series : [];
      return res.end(JSON.stringify({
        stats: {
          count: series.length,
          date_from: data?.meta?.date_from || null,
          date_to: data?.meta?.date_to || null,
        },
        source: `basket/${BASKET_MAP[name]}`,
      }));
    }

    // Корень — отдаём данные как есть
    return res.end(JSON.stringify(data));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: e.message }));
  }
}
