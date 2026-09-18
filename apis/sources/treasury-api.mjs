/**
 * apis/sources/treasury-api.mjs — API-МОДУЛЬ: ГОСДОЛГ США (TREASURY)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/treasury-debt.json — { source, updated, latest: { date, totalDebt }, history: [...] }.
 * Сборщик: scripts/collectors/collect-treasury.mjs.
 *
 * Total Public Debt Outstanding — государственный долг США.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?days=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'treasury-debt.json');

export const route  = '/api/layers/treasury';
export const method = 'GET';

export const meta = {
  category: 'economics',
  icon: '🏛️',
  color: '#a21caf',
  vizType: 'marker',
  source: 'basket/treasury-debt.json',
  collector: 'collect-treasury.mjs',
  cache: 3600,
  description: 'Государственный долг США (US Treasury)',
  unit: 'USD',
};

// Точки — ключевые финансовые столицы (условная геопривязка)
const REFERENCE_POINTS = [
  { name: 'US Treasury (Washington)', lat: 38.8977, lng: -77.0365 },
  { name: 'Federal Reserve (NY)',      lat: 40.7087, lng: -74.0096 },
  { name: 'Fed (Chicago)',             lat: 41.8789, lng: -87.6326 },
  { name: 'Fed (SF)',                  lat: 37.7749, lng: -122.4194 },
  { name: 'Fed (Dallas)',              lat: 32.7801, lng:  -96.8000 },
];

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-treasury.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let history = null;
  if (Array.isArray(parsed)) history = parsed;
  else if (parsed && Array.isArray(parsed.history)) history = parsed.history;
  else if (parsed && Array.isArray(parsed.data))    history = parsed.data;
  if (!history) { const err = new Error('unrecognized_basket_format: ожидалось { history: [...] }'); err.statusCode = 500; throw err; }

  const clean = history.map(r => ({
    date: String(r.date || '').slice(0, 10),
    value: Number(r.totalDebt ?? r.value ?? r.debt),
  })).filter(r => r.date && Number.isFinite(r.value));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return { series: clean, rawMeta: { source: parsed.source || null, updated: parsed.updated || null } };
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
  return {
    count: series.length,
    date_from: series[0].date, date_to: series[series.length - 1].date,
    min, max, avg,
    first, last,
    change, changePct: +changePct.toFixed(4),
    trend: change > 0 ? 'up' : change < 0 ? 'down' : 'flat',
    last_trillions: +(last / 1e12).toFixed(3),
  };
}

function toFeatureCollection(series, stats) {
  const latest = series[series.length - 1];
  const prev = series[series.length - 2] || latest;
  const delta = latest.value - prev.value;
  const features = REFERENCE_POINTS.map(p => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    properties: {
      name: p.name,
      debt: latest.value,
      debtTrillions: +(latest.value / 1e12).toFixed(3),
      debtPrev: prev.value,
      delta: delta,
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      date: latest.date,
      category: 'economics',
      icon: meta.icon,
      color: meta.color,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(fullSeries, filtered, rawMeta) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_source: rawMeta.source,
    basket_updated: rawMeta.updated,
    total_points: fullSeries.length, returned_points: filtered.length,
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
  const lines = ['date,value,trillions'];
  for (const r of series) lines.push(`${r.date},${r.value},${(r.value / 1e12).toFixed(3)}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadData();
    const fullSeries = loaded.series;
    const series = applyFilters(fullSeries, query);
    const stats = computeStats(series);
    const extra = { 'X-Module': 'treasury-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(series), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series, stats, meta: envelopeMeta(fullSeries, series, loaded.rawMeta) }, extra);
    if (format === 'stats')  return sendJSON(res, 200, { stats, meta: envelopeMeta(fullSeries, series, loaded.rawMeta) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: series, meta: envelopeMeta(fullSeries, series, loaded.rawMeta) }, extra);

    const fc = toFeatureCollection(series, stats);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(fullSeries, series, loaded.rawMeta),
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
