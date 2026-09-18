/**
 * apis/sources/economy-api.mjs — API-МОДУЛЬ: ЭКОНОМИКА СТРАН
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/economy.json — [{ country, gdp, inflation, lat, lng, region, timestamp }].
 * Сборщик: scripts/collectors/collect-economy.mjs.
 *
 * Экономические показатели стран: ВВП (трлн $), инфляция (%), регион.
 * Геокоординаты — из самого файла (lat/lng). FeatureCollection с точками по странам.
 *
 * ДОПОЛНИТЕЛЬНО: встроенный справочник рыночных индикаторов (vix, sp500, gold, wti и т.д.)
 * доступен через /market-indicators (для dashboard-виджетов).
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?region=, ?min_gdp=, ?max_gdp=, ?min_inflation=, ?max_inflation=, ?q=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats              — агрегированная статистика
 *   GET /status             — health-check
 *   GET /regions            — группировка по регионам
 *   GET /top-gdp            — топ-10 стран по ВВП
 *   GET /top-inflation      — топ-10 стран по инфляции
 *   GET /market-indicators  — рыночные индикаторы (встроенный справочник)
 *   GET /featurecollection  — GeoJSON
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'economy.json');

export const route  = '/api/layers/economy';
export const method = 'GET';

export const meta = {
  category: 'economics',
  icon: '💱',
  color: '#0891b2',
  vizType: 'choropleth',
  source: 'basket/economy.json',
  collector: 'collect-economy.mjs',
  cache: 300,
  description: 'Экономика стран: ВВП, инфляция, регион',
  unit: 'countries',
};

// ============================================================
//  ВСТРОЕННЫЙ СПРАВОЧНИК РЫНОЧНЫХ ИНДИКАТОРОВ
// ============================================================

const MARKET_INDICATORS = {
  vix:         { name: 'VIX',          value: 24.54,    change: '+2.3%',  status: 'warning', description: 'Индекс волатильности' },
  hySpread:    { name: 'HY Spread',    value: 3.16,     change: '-0.12%', status: 'normal',  description: 'Спред высокодоходных облигаций' },
  gscpi:       { name: 'GSCPI',        value: 0.49,     change: '+0.08%', status: 'normal',  description: 'Индекс давления в цепях поставок' },
  usdIndex:    { name: 'USD Index',    value: 120.9,    change: '+0.4%',  status: 'normal',  description: 'Индекс доллара США' },
  wti:         { name: 'WTI Crude',    value: 112.06,   change: '+1.8%',  status: 'warning', description: 'Нефть WTI ($/баррель)' },
  brent:       { name: 'Brent Crude',  value: 109.05,   change: '+1.5%',  status: 'warning', description: 'Нефть Brent ($/баррель)' },
  gold:        { name: 'Gold',         value: 2034.50,  change: '+0.6%',  status: 'normal',  description: 'Золото ($/унция)' },
  bitcoin:     { name: 'Bitcoin',      value: 66895.18, change: '+0.31%', status: 'normal',  description: 'Bitcoin ($)' },
  sp500:       { name: 'S&P 500',      value: 6582.69,  change: '+1.63%', status: 'normal',  description: 'Индекс S&P 500' },
  nasdaq:      { name: 'Nasdaq',       value: 21879.18, change: '+2.2%',  status: 'normal',  description: 'Индекс Nasdaq' },
  dow:         { name: 'Dow Jones',    value: 46504.67, change: '+1.18%', status: 'normal',  description: 'Индекс Dow Jones' },
  unemployment:{ name: 'Unemployment', value: 4.3,      change: '-0.1%',  status: 'warning', description: 'Уровень безработицы (%)' },
  cpi:         { name: 'CPI MoM',      value: 0.47,     change: '+0.02%', status: 'normal',  description: 'Индекс потребительских цен (месяц)' },
  fedFunds:    { name: 'Fed Funds',    value: 3.64,     change: '-0.25%', status: 'normal',  description: 'Ставка ФРС (%)' },
};

const MARKET_CATEGORIES = {
  markets:     ['sp500', 'nasdaq', 'dow'],
  crypto:      ['bitcoin'],
  commodities: ['wti', 'brent', 'gold'],
  macro:       ['vix', 'hySpread', 'gscpi', 'usdIndex', 'unemployment', 'cpi', 'fedFunds'],
};

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-economy.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  if (!Array.isArray(parsed)) {
    const err = new Error('unrecognized_basket_format: ожидался массив [{country,gdp,inflation,...}]'); err.statusCode = 500; throw err;
  }
  return parsed;
}

function normalizeCountry(c, i) {
  const lat = Number(c.lat ?? c.latitude);
  const lng = Number(c.lng ?? c.lon ?? c.longitude);
  const gdp = Number(c.gdp);
  const inflation = Number(c.inflation);
  return {
    id: c.id || String(c.country || `country-${i}`).toLowerCase().replace(/\s+/g, '-'),
    country: c.country || 'Unknown',
    region: c.region || 'GLOBAL',
    gdp: Number.isFinite(gdp) ? gdp : null,
    inflation: Number.isFinite(inflation) ? inflation : null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    timestamp: c.timestamp || null,
    category: 'economics',
    icon: meta.icon,
    color: meta.color,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) r = r.filter(x => String(x.country).toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.region)  r = r.filter(x => String(x.region).toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.q)       r = r.filter(x => String(x.country).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min_gdp != null) { const n = Number(query.min_gdp); if (Number.isFinite(n)) r = r.filter(x => x.gdp != null && x.gdp >= n); }
  if (query.max_gdp != null) { const n = Number(query.max_gdp); if (Number.isFinite(n)) r = r.filter(x => x.gdp != null && x.gdp <= n); }
  if (query.min_inflation != null) { const n = Number(query.min_inflation); if (Number.isFinite(n)) r = r.filter(x => x.inflation != null && x.inflation >= n); }
  if (query.max_inflation != null) { const n = Number(query.max_inflation); if (Number.isFinite(n)) r = r.filter(x => x.inflation != null && x.inflation <= n); }
  const sortKey = query.sort;
  if (sortKey === 'gdp')             r.sort((a, b) => (b.gdp || 0) - (a.gdp || 0));
  else if (sortKey === 'inflation')  r.sort((a, b) => (b.inflation || 0) - (a.inflation || 0));
  else if (sortKey === 'country')    r.sort((a, b) => a.country.localeCompare(b.country));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const gdps = rows.map(r => r.gdp).filter(Number.isFinite);
  const inflations = rows.map(r => r.inflation).filter(Number.isFinite);
  const byRegion = {};
  for (const r of rows) byRegion[r.region] = (byRegion[r.region] || 0) + 1;

  const totalGdp = gdps.reduce((a, b) => a + b, 0);
  const meanGdp = gdps.length ? totalGdp / gdps.length : 0;
  const meanInflation = inflations.length ? inflations.reduce((a, b) => a + b, 0) / inflations.length : 0;
  const maxGdp = rows.filter(r => r.gdp != null).sort((a, b) => b.gdp - a.gdp)[0] || null;
  const maxInflation = rows.filter(r => r.inflation != null).sort((a, b) => b.inflation - a.inflation)[0] || null;
  const minInflation = rows.filter(r => r.inflation != null).sort((a, b) => a.inflation - b.inflation)[0] || null;

  return {
    count: rows.length,
    by_region: byRegion,
    total_gdp_trillion: Number(totalGdp.toFixed(2)),
    mean_gdp: Number(meanGdp.toFixed(2)),
    mean_inflation: Number(meanInflation.toFixed(2)),
    max_gdp: maxGdp ? { country: maxGdp.country, gdp: maxGdp.gdp } : null,
    max_inflation: maxInflation ? { country: maxInflation.country, inflation: maxInflation.inflation } : null,
    min_inflation: minInflation ? { country: minInflation.country, inflation: minInflation.inflation } : null,
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, country: r.country, region: r.region,
        gdp: r.gdp, inflation: r.inflation,
        timestamp: r.timestamp,
        category: r.category, icon: r.icon, color: r.color,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({ country: r.country, region: r.region, gdp: r.gdp, inflation: r.inflation }));
}

function toCSV(rows) {
  const lines = ['country,region,gdp,inflation,lat,lng,timestamp'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) {
    lines.push([r.country, r.region, r.gdp, r.inflation, r.lat, r.lng, r.timestamp].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/economy/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const rawArr = await loadData();
    const all = rawArr.map(normalizeCountry);
    const extra = {
      'X-Module': 'economy-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    // Рыночные индикаторы (встроенный справочник) — не требуют basket
    if (sub === '/market-indicators') {
      return sendJSON(res, 200, {
        service: 'economy',
        endpoint: '/market-indicators',
        indicators: Object.entries(MARKET_INDICATORS).map(([id, v]) => ({ id, ...v })),
        categories: MARKET_CATEGORIES,
        total: Object.keys(MARKET_INDICATORS).length,
      }, extra);
    }

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/regions') {
      const byRegion = {};
      for (const c of all) {
        if (!byRegion[c.region]) byRegion[c.region] = [];
        byRegion[c.region].push({ country: c.country, gdp: c.gdp, inflation: c.inflation });
      }
      return sendJSON(res, 200, { regions: byRegion, total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/top-gdp') {
      const top = all.filter(c => c.gdp != null).sort((a, b) => b.gdp - a.gdp).slice(0, 10);
      return sendJSON(res, 200, { top_gdp: top, count: top.length }, extra);
    }
    if (sub === '/top-inflation') {
      const top = all.filter(c => c.inflation != null).sort((a, b) => b.inflation - a.inflation).slice(0, 10);
      return sendJSON(res, 200, { top_inflation: top, count: top.length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { total: all.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_countries: all.length, returned_countries: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      series: toSeries(rows),
      stats: computeStats(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
