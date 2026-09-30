/**
 * apis/sources/tick-data-analyzer-api.mjs — API-МОДУЛЬ: АНАЛИЗ ТИКОВЫХ ДАННЫХ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/market/tick-data-analyzer.json.
 * Анализатор: scripts/analyzers/tick-data-analyzer.mjs.
 *
 * Анализ тиковых данных: микроструктура рынка, bid/ask, объёмы, волатильность на секундном уровне.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'market', 'tick-data-analyzer.json');

export const route  = '/api/layers/tick-data-analyzer';
export const method = 'GET';

export const meta = {
  category: 'market',
  icon: '📊',
  icon_alt: '🎯',
  color: '#00aaff',
  vizType: 'marker',
  source: 'analytics/market/tick-data-analyzer.json',
  collector: 'analyzer:tick-data-analyzer',
  cache: 60,
  description: 'Анализ тиковых данных (микроструктура рынка, bid/ask)',
  unit: 'ticks',
};

const MARKET_POINTS = {
  'nyse':   { lat: 40.7069, lng:  -74.0113, name: 'NYSE' },
  'nasdaq': { lat: 40.7580, lng:  -73.9855, name: 'NASDAQ' },
  'cme':    { lat: 41.8781, lng:  -87.6298, name: 'CME Group' },
  'ice':    { lat: 51.5133, lng:   -0.0890, name: 'ICE (London)' },
  'sse':    { lat: 31.2304, lng:  121.4737, name: 'SSE (Shanghai)' },
  'tse':    { lat: 35.6812, lng:  139.7671, name: 'TSE (Tokyo)' },
};

function volatilityBand(v) {
  if (v >= 0.05)  return { level: 'extreme',  color: '#7f1d1d', label: 'Экстремальная' };
  if (v >= 0.03)  return { level: 'critical', color: '#dc2626', label: 'Критическая' };
  if (v >= 0.02)  return { level: 'high',     color: '#f97316', label: 'Высокая' };
  if (v >= 0.01)  return { level: 'medium',   color: '#eab308', label: 'Средняя' };
  if (v >= 0.005) return { level: 'low',      color: '#84cc16', label: 'Низкая' };
  return                 { level: 'calm',    color: '#22c55e', label: 'Спокойствие' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/tick-data-analyzer.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.markets)) return data.data.markets;
  if (data.data && Array.isArray(data.data.ticks)) return data.data.ticks;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.markets)) return data.markets;
  if (Array.isArray(data.ticks)) return data.ticks;
  if (data.data && typeof data.data === 'object') {
    return Object.entries(data.data).map(([key, val]) => {
      if (val && typeof val === 'object') return { name: key, ...val };
      return { name: key, value: val };
    });
  }
  return [];
}

function normalizeItem(r) {
  const name = String(r.name || r.market || r.symbol || 'unknown').toLowerCase();
  const pt = MARKET_POINTS[name] || null;
  return {
    id: r.id || name,
    name: r.name || pt?.name || name,
    market: name,
    value: Number(r.value ?? r.price ?? 0),
    volatility: Number(r.volatility ?? r.vol ?? r.value ?? 0),
    bidAskSpread: r.bidAskSpread != null ? Number(r.bidAskSpread) : (r.spread != null ? Number(r.spread) : null),
    volume: r.volume != null ? Number(r.volume) : null,
    tickCount: r.tickCount != null ? Number(r.tickCount) : null,
    severity: String(r.severity || 'info').toLowerCase(),
    lat: Number(r.lat ?? pt?.lat ?? 0),
    lng: Number(r.lng ?? r.lon ?? pt?.lng ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.market) { const m = String(query.market).toLowerCase(); r = r.filter(x => x.market === m); }
  if (query.min_volatility != null) { const n = parseFloat(query.min_volatility); if (Number.isFinite(n)) r = r.filter(x => x.volatility >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const vols = rows.map(r => r.volatility);
  const byBand = {};
  for (const r of rows) { const b = volatilityBand(r.volatility).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice().sort((a, b) => b.volatility - a.volatility).slice(0, 5).map(r => ({ name: r.name, volatility: r.volatility }));
  return {
    count: rows.length,
    max_volatility: Math.max(...vols),
    avg_volatility: +(vols.reduce((a, b) => a + b, 0) / vols.length).toFixed(5),
    by_band: byBand,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = volatilityBand(r.volatility);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, market: r.market,
        value: r.value, volatility: r.volatility, bidAskSpread: r.bidAskSpread,
        volume: r.volume, tickCount: r.tickCount, severity: r.severity, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'market', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'extreme',  label: 'Экстремальная (5%+)', color: '#7f1d1d' },
      { level: 'critical', label: 'Критическая (3%+)',   color: '#dc2626' },
      { level: 'high',     label: 'Высокая (2%+)',       color: '#f97316' },
      { level: 'medium',   label: 'Средняя (1%+)',       color: '#eab308' },
      { level: 'low',      label: 'Низкая (0.5%+)',      color: '#84cc16' },
      { level: 'calm',     label: 'Спокойствие',         color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_markets: full.length, returned_markets: filtered.length,
    with_coords: filtered.filter(r => r.lat !== 0 || r.lng !== 0).length,
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
  const lines = ['id,name,market,value,volatility,bidAskSpread,band'];
  for (const r of rows) { const b = volatilityBand(r.volatility); lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.market},${r.value},${r.volatility},${r.bidAskSpread ?? ''},${b.level}`); }
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
    const extra = { 'X-Module': 'tick-data-analyzer-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
