/**
 * apis/sources/stablecoin-monitor-api.mjs — API-МОДУЛЬ: МОНИТОР СТЕЙБЛКОИНОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/market/stablecoin-monitor.json.
 * Анализатор: scripts/analyzers/stablecoin-monitor.mjs.
 *
 * Мониторинг стейблкоинов (USDT, USDC, DAI и др.). Отслеживает депег, объёмы, потоки.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'market', 'stablecoin-monitor.json');

export const route  = '/api/layers/stablecoin-monitor';
export const method = 'GET';

export const meta = {
  category: 'market',
  icon: '💰',
  color: '#22cc88',
  vizType: 'marker',
  source: 'analytics/market/stablecoin-monitor.json',
  collector: 'analyzer:stablecoin-monitor',
  cache: 300,
  description: 'Монитор стейблкоинов (USDT, USDC, DAI) — депег, объёмы, потоки',
  unit: 'USD',
};

// Стейблкоины — глобальные, привязка к главным финансовым центрам
const STABLECOIN_POINTS = [
  { name: 'Tether (USDT) — New York', lat: 40.7069, lng: -74.0113, coin: 'USDT' },
  { name: 'USD Coin (USDC) — Boston', lat: 42.3601, lng: -71.0589, coin: 'USDC' },
  { name: 'DAI (Maker) — Global',     lat: 51.5074, lng:  -0.1278, coin: 'DAI' },
  { name: 'BUSD — Singapore',         lat:  1.3521, lng: 103.8198, coin: 'BUSD' },
  { name: 'TUSD — Hong Kong',         lat: 22.3193, lng: 114.1694, coin: 'TUSD' },
];

function depegLevel(deviation) {
  const abs = Math.abs(deviation);
  if (abs >= 0.05) return { level: 'critical', color: '#7f1d1d', label: 'Критический депег' };
  if (abs >= 0.02) return { level: 'high',     color: '#dc2626', label: 'Сильный депег' };
  if (abs >= 0.01) return { level: 'medium',   color: '#f97316', label: 'Средний депег' };
  if (abs >= 0.005) return { level: 'low',    color: '#eab308', label: 'Малый депег' };
  return                  { level: 'stable', color: '#22c55e', label: 'Стабильно' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/stablecoin-monitor.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.coins)) return data.data.coins;
  if (data.data && Array.isArray(data.data.stablecoins)) return data.data.stablecoins;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.coins)) return data.coins;
  if (Array.isArray(data.stablecoins)) return data.stablecoins;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  const coin = String(r.coin || r.symbol || r.name || 'unknown').toUpperCase();
  const price = Number(r.price ?? r.value ?? 1);
  const deviation = Number(r.deviation ?? (price - 1));
  return {
    id: r.id || coin,
    name: r.name || coin,
    coin,
    price,
    deviation,
    marketCap: r.marketCap != null ? Number(r.marketCap) : (r.market_cap != null ? Number(r.market_cap) : null),
    volume: r.volume != null ? Number(r.volume) : null,
    network: r.network || r.chain || null,
    severity: String(r.severity || 'info').toLowerCase(),
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? r.lon ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.coin) r = r.filter(x => x.coin === String(query.coin).toUpperCase());
  if (query.min_deviation != null) { const n = parseFloat(query.min_deviation); if (Number.isFinite(n)) r = r.filter(x => Math.abs(x.deviation) >= n); }
  if (query.network) { const nn = String(query.network).toLowerCase(); r = r.filter(x => (x.network || '').toLowerCase().includes(nn)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const devs = rows.map(r => Math.abs(r.deviation));
  const byBand = {};
  let totalCap = 0;
  for (const r of rows) {
    const b = depegLevel(r.deviation).level;
    byBand[b] = (byBand[b] || 0) + 1;
    if (r.marketCap) totalCap += r.marketCap;
  }
  return {
    count: rows.length,
    max_deviation: Math.max(...devs),
    avg_deviation: +(devs.reduce((a, b) => a + b, 0) / devs.length).toFixed(4),
    total_market_cap: totalCap,
    by_band: byBand,
  };
}

function toFeatureCollection(rows) {
  // Для каждой монеты используем точки главных финансовых центров
  const features = [];
  const byCoin = new Map();
  for (const r of rows) {
    if (!byCoin.has(r.coin)) byCoin.set(r.coin, []);
    byCoin.get(r.coin).push(r);
  }
  for (const [coin, arr] of byCoin.entries()) {
    for (const point of STABLECOIN_POINTS) {
      if (point.coin !== coin) continue;
      const r = arr[0];
      const b = depegLevel(r.deviation);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
        properties: {
          id: r.id, name: point.name, coin: r.coin,
          price: r.price, deviation: r.deviation,
          marketCap: r.marketCap, volume: r.volume, network: r.network,
          severity: r.severity, date: r.date,
          band: b.level, bandLabel: b.label, color: b.color,
          category: 'market', icon: meta.icon,
        },
      });
    }
  }
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'critical', label: 'Критический депег (5%+)',   color: '#7f1d1d' },
      { level: 'high',     label: 'Сильный депег (2%+)',       color: '#dc2626' },
      { level: 'medium',   label: 'Средний депег (1%+)',       color: '#f97316' },
      { level: 'low',      label: 'Малый депег (0.5%+)',       color: '#eab308' },
      { level: 'stable',   label: 'Стабильно',                 color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_coins: full.length, returned_coins: filtered.length,
  };
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}
function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}
function toCSVBody(rows) {
  const lines = ['id,name,coin,price,deviation,band,marketCap'];
  for (const r of rows) { const b = depegLevel(r.deviation); lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.coin},${r.price},${r.deviation},${b.level},${r.marketCap ?? ''}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const data = await loadData();
    const rawItems = extractItems(data);
    const full = rawItems.map(normalizeItem);
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'stablecoin-monitor-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      bands: fc.bands,
      features: fc.features,
      items: rows,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
