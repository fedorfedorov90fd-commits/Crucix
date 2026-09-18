/**
 * apis/sources/war-preparation-api.mjs — API-МОДУЛЬ: ИНДЕКС ПОДГОТОВКИ К ВОЙНЕ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/war-preparation.json — временной ряд { date, value, lat, lng }.
 * Сборщик: scripts/collectors/collect-war-preparation.mjs.
 *
 * Композитный индекс военной подготовки. Агрегирует: военные расходы,
 * мобилизацию, перемещения войск, дипломатическую напряжённость.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'war-preparation.json');

export const route  = '/api/layers/war-preparation';
export const method = 'GET';

export const meta = {
  category: 'military',
  icon: '⚔️',
  color: '#dc2626',
  vizType: 'marker',
  source: 'basket/war-preparation.json',
  collector: 'collect-war-preparation.mjs',
  cache: 600,
  description: 'Индекс подготовки к войне — композитный военный сигнал',
  unit: 'index',
};

function warLevel(value) {
  if (value >= 80) return { level: 'critical',   color: '#7f1d1d', label: 'Критический' };
  if (value >= 60) return { level: 'high',       color: '#dc2626', label: 'Высокий' };
  if (value >= 40) return { level: 'elevated',   color: '#f97316', label: 'Повышенный' };
  if (value >= 20) return { level: 'moderate',   color: '#eab308', label: 'Средний' };
  return                 { level: 'low',        color: '#22c55e', label: 'Низкий' };
}

async function loadSeries() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-war-preparation.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.series)) arr = parsed.series;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    date: String(r.date || '').slice(0, 10),
    value: Number(r.value ?? r.index ?? 0),
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : (r.lon != null ? Number(r.lon) : null),
    region: r.region || null,
  })).filter(r => r.date && Number.isFinite(r.value));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return clean;
}

function applyFilters(series, query) {
  let r = series.slice();
  if (query.since) r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
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
  const current = warLevel(last);
  const byLevel = {};
  for (const val of v) { const lvl = warLevel(val).level; byLevel[lvl] = (byLevel[lvl] || 0) + 1; }
  return {
    count: series.length,
    date_from: series[0].date, date_to: series[series.length - 1].date,
    min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2),
    first: +first.toFixed(2), last: +last.toFixed(2),
    change: +change.toFixed(2), changePct: +changePct.toFixed(2),
    trend: change > 2 ? 'up' : change < -2 ? 'down' : 'flat',
    current_level: current.level, current_label: current.label, current_color: current.color,
    by_level: byLevel,
  };
}

function toFeatureCollection(series) {
  // Собираем уникальные локации из серии, показываем последние значения
  const byLocation = new Map();
  for (const r of series) {
    if (r.lat == null || r.lng == null) continue;
    const key = `${r.lat.toFixed(2)},${r.lng.toFixed(2)}`;
    const cur = byLocation.get(key) || { lat: r.lat, lng: r.lng, latest: r, history: [] };
    cur.history.push(r);
    if (!cur.latest || r.date > cur.latest.date) cur.latest = r;
    byLocation.set(key, cur);
  }

  const features = [...byLocation.values()].map(loc => {
    const lvl = warLevel(loc.latest.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
      properties: {
        value: loc.latest.value,
        level: lvl.level, levelLabel: lvl.label,
        date: loc.latest.date,
        region: loc.latest.region,
        points: loc.history.length,
        color: lvl.color,
        category: 'military', icon: meta.icon,
      },
    };
  });

  return {
    type: 'FeatureCollection',
    levels: [
      { level: 'critical',  label: 'Критический (80+)', color: '#7f1d1d' },
      { level: 'high',      label: 'Высокий (60+)',     color: '#dc2626' },
      { level: 'elevated',  label: 'Повышенный (40+)',  color: '#f97316' },
      { level: 'moderate',  label: 'Средний (20+)',     color: '#eab308' },
      { level: 'low',       label: 'Низкий (<20)',      color: '#22c55e' },
    ],
    features,
  };
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
  const lines = ['date,value,level,lat,lng,region'];
  for (const r of series) { const lvl = warLevel(r.value); lines.push(`${r.date},${r.value},${lvl.level},${r.lat ?? ''},${r.lng ?? ''},${r.region || ''}`); }
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
    const extra = { 'X-Module': 'war-preparation-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(series), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series, stats, meta: envelopeMeta(fullSeries, series) }, extra);
    if (format === 'stats')  return sendJSON(res, 200, { stats, meta: envelopeMeta(fullSeries, series) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: series, meta: envelopeMeta(fullSeries, series) }, extra);

    const fc = toFeatureCollection(series);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(fullSeries, series),
      levels: fc.levels,
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
