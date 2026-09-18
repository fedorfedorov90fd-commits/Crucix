/**
 * apis/sources/bdi-api.mjs — API-МОДУЛЬ: BALTIC DRY INDEX
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/bdi.json — временной ряд { date, value }.
 * Сборщик: scripts/collectors/collect-bdi.mjs.
 *
 * BDI — индекс стоимости морских грузоперевозок. Ключевой индикатор глобальной торговли.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?limit=, ?days=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'bdi.json');

export const route  = '/api/layers/bdi';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📊',
  color: '#0066ff',
  vizType: 'marker',
  source: 'basket/bdi.json',
  collector: 'collect-bdi.mjs',
  cache: 300,
  description: 'Baltic Dry Index — индекс стоимости морских грузоперевозок',
  unit: 'index',
};

// Уровни рынка перевозок
function marketLevel(value) {
  if (value < 1000) return { level: 'depression', color: '#1e40af', label: 'Депрессия' };
  if (value < 1500) return { level: 'weak',       color: '#3b82f6', label: 'Слабый' };
  if (value < 2000) return { level: 'normal',     color: '#22c55e', label: 'Норма' };
  if (value < 3000) return { level: 'strong',     color: '#eab308', label: 'Сильный' };
  return                   { level: 'boom',       color: '#dc2626', label: 'Бум' };
}

// Ключевые морские узлы (условные точки)
const SHIPPING_HUBS = [
  { name: 'Baltic Exchange (London)', lat: 51.5074, lng: -0.1278 },
  { name: 'Port of Rotterdam',        lat: 51.9244, lng:  4.4777 },
  { name: 'Port of Shanghai',         lat: 31.2304, lng: 121.4737 },
  { name: 'Port of Singapore',        lat:  1.3521, lng: 103.8198 },
  { name: 'Port of Panama',           lat:  8.9824, lng: -79.5199 },
];

async function loadSeries() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-bdi.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  else if (parsed && Array.isArray(parsed.series)) arr = parsed.series;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const date = r.date || r.timestamp;
    const value = Number(r.value ?? r.close ?? r.bdi);
    return (date && Number.isFinite(value)) ? { date: String(date).slice(0, 10), value } : null;
  }).filter(Boolean);

  if (clean.length === 0) { const err = new Error('empty_series_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return clean;
}

function applyFilters(series, query) {
  let r = series.slice();
  if (query.since) r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.days)  { const n = parseInt(query.days, 10);  if (n > 0) r = r.slice(-n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function computeStats(series) {
  if (series.length === 0) return { count: 0 };
  const v = series.map(r => r.value);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const first = v[0], last = v[v.length - 1];
  const change = last - first;
  const changePct = first !== 0 ? (change / first) * 100 : 0;
  const current = marketLevel(last);
  return {
    count: series.length,
    date_from: series[0].date,
    date_to: series[series.length - 1].date,
    min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2),
    first: +first.toFixed(2), last: +last.toFixed(2),
    change: +change.toFixed(2), changePct: +changePct.toFixed(2),
    trend: change > 20 ? 'up' : change < -20 ? 'down' : 'flat',
    market_level: current.level,
    market_label: current.label,
    market_color: current.color,
  };
}

function toFeatureCollection(series, stats) {
  const latest = series[series.length - 1];
  const prev   = series[series.length - 2] || latest;
  const delta  = latest.value - prev.value;
  const lvl = marketLevel(latest.value);

  const features = SHIPPING_HUBS.map(hub => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [hub.lng, hub.lat] },
    properties: {
      name: hub.name,
      bdi: latest.value,
      bdiPrev: prev.value,
      delta: +delta.toFixed(2),
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      marketLevel: lvl.level,
      marketLabel: lvl.label,
      date: latest.date,
      category: 'finance',
      icon: meta.icon,
      color: lvl.color,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_points: full.length, returned_points: filtered.length,
    date_from: filtered[0]?.date || null,
    date_to: filtered[filtered.length - 1]?.date || null,
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
function toCSVBody(series) {
  const lines = ['date,value,market_level'];
  for (const r of series) { const lv = marketLevel(r.value); lines.push(`${r.date},${r.value},${lv.level}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const fullSeries = await loadSeries();
    const series = applyFilters(fullSeries, query);
    const stats  = computeStats(series);
    const extra = { 'X-Module': 'bdi-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(series), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series, stats, meta: envelopeMeta(fullSeries, series) }, extra);
    if (format === 'stats')  return sendJSON(res, 200, { stats, meta: envelopeMeta(fullSeries, series) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: series, meta: envelopeMeta(fullSeries, series) }, extra);

    const fc = toFeatureCollection(series, stats);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(fullSeries, series),
      features: fc.features,
      series,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
