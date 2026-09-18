/**
 * apis/sources/vix-api.mjs — API-МОДУЛЬ: ИНДЕКС ВОЛАТИЛЬНОСТИ VIX
 *
 * КОНТРАКТ CRUCIX v2:
 *   export const route  = '/api/layers/vix';
 *   export const method = 'GET';
 *   export const meta   = { ... };
 *   export async function handler(req, res) { ... }
 *
 * ИСТОЧНИК: data/basket/vix.json — временной ряд { date, value }.
 * Сборщик: scripts/collectors/collect-vix.mjs.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?limit=, ?days=, ?threshold=N.
 * СТАТУСЫ: 200 OK, 503 no_data, 500 error.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'vix.json');

export const route  = '/api/layers/vix';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📈',
  color: '#ff0000',
  vizType: 'marker',
  source: 'basket/vix.json',
  collector: 'collect-vix.mjs',
  cache: 60,
  description: 'Индекс волатильности CBOE VIX (Индекс страха)',
  unit: 'index',
};

// Уровни страха (классическая интерпретация VIX)
const FEAR_LEVELS = [
  { max: 12,  level: 'complacency', color: '#22c55e', label: 'Комплейсентность' },
  { max: 20,  level: 'normal',      color: '#84cc16', label: 'Норма' },
  { max: 30,  level: 'fear',        color: '#eab308', label: 'Страх' },
  { max: 40,  level: 'panic',       color: '#f97316', label: 'Паника' },
  { max: 999, level: 'crisis',      color: '#dc2626', label: 'Кризис' },
];

const REFERENCE_LOCATIONS = [
  { name: 'CBOE Chicago',    lat: 41.8781, lng:  -87.6298, exchange: 'CBOE' },
  { name: 'NY Fed',          lat: 40.7089, lng:  -74.0094, exchange: 'NYSE' },
  { name: 'CME Group',       lat: 41.8819, lng:  -87.6278, exchange: 'CME' },
  { name: 'Nasdaq',          lat: 40.7580, lng:  -73.9855, exchange: 'NASDAQ' },
];

async function loadSeries() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-vix.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  else if (parsed && Array.isArray(parsed.values)) arr = parsed.values;
  else if (parsed && Array.isArray(parsed.series)) arr = parsed.series;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const date = r.date || r.timestamp || r.time;
    const value = Number(r.value ?? r.close ?? r.price ?? r.vix);
    return (date && Number.isFinite(value)) ? { date: String(date).slice(0, 10), value } : null;
  }).filter(Boolean);

  if (clean.length === 0) { const err = new Error('empty_series_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return clean;
}

function applyFilters(series, query) {
  let r = series.slice();
  if (query.since)  r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until)  r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.days)   { const n = parseInt(query.days, 10);  if (n > 0) r = r.slice(-n); }
  if (query.limit)  { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function fearLevel(value) {
  for (const l of FEAR_LEVELS) if (value <= l.max) return l;
  return FEAR_LEVELS[FEAR_LEVELS.length - 1];
}

function computeStats(series) {
  if (series.length === 0) return { count: 0 };
  const v = series.map(r => r.value);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const first = v[0], last = v[v.length - 1];
  const change = last - first;
  const changePct = first !== 0 ? (change / first) * 100 : 0;
  const currentLevel = fearLevel(last);

  // Счётчик дней на каждом уровне
  const distribution = {};
  for (const val of v) {
    const lvl = fearLevel(val).level;
    distribution[lvl] = (distribution[lvl] || 0) + 1;
  }

  return {
    count: series.length,
    date_from: series[0].date,
    date_to: series[series.length - 1].date,
    min: +min.toFixed(2),
    max: +max.toFixed(2),
    avg: +avg.toFixed(2),
    first: +first.toFixed(2),
    last: +last.toFixed(2),
    change: +change.toFixed(2),
    changePct: +changePct.toFixed(2),
    trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat',
    fear_level: currentLevel.level,
    fear_label: currentLevel.label,
    fear_color: currentLevel.color,
    distribution,
  };
}

function toFeatureCollection(series, stats) {
  const latest = series[series.length - 1];
  const prev   = series[series.length - 2] || latest;
  const delta  = latest.value - prev.value;
  const currentLevel = fearLevel(latest.value);

  const features = REFERENCE_LOCATIONS.map(loc => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
    properties: {
      name: loc.name,
      exchange: loc.exchange,
      vix: latest.value,
      vixPrev: prev.value,
      delta: +delta.toFixed(2),
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      level: currentLevel.level,
      levelLabel: currentLevel.label,
      date: latest.date,
      category: 'finance',
      icon: meta.icon,
      color: currentLevel.color,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(fullSeries, filteredSeries) {
  return {
    source: meta.source,
    collector: meta.collector,
    category: meta.category,
    unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_points: fullSeries.length,
    returned_points: filteredSeries.length,
    date_from: filteredSeries[0]?.date || null,
    date_to: filteredSeries[filteredSeries.length - 1]?.date || null,
    fear_levels: FEAR_LEVELS.map(l => ({ level: l.level, max: l.max, color: l.color, label: l.label })),
  };
}

function sendJSON(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extraHeaders });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

function toCSVBody(series) {
  const lines = ['date,value,level,label'];
  for (const r of series) { const lv = fearLevel(r.value); lines.push(`${r.date},${r.value},${lv.level},${lv.label}`); }
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
    const extraHeaders = { 'X-Module': 'vix-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(series), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series, stats, meta: envelopeMeta(fullSeries, series) }, extraHeaders);
    if (format === 'stats')  return sendJSON(res, 200, { stats, meta: envelopeMeta(fullSeries, series) }, extraHeaders);
    if (format === 'raw')    return sendJSON(res, 200, { data: series, meta: envelopeMeta(fullSeries, series) }, extraHeaders);

    const fc = toFeatureCollection(series, stats);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(fullSeries, series),
      features: fc.features,
      series,
      stats,
    }, extraHeaders);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
