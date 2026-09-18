/**
 * apis/sources/firms-api.mjs — API-МОДУЛЬ: ПОЖАРЫ (NASA FIRMS)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/firms.json — массив { date, value, fires, region, frp, confidence }.
 * Сборщик: scripts/collectors/collect-firms.mjs.
 *
 * Данные NASA FIRMS: количество активных пожаров, радиационная мощность (FRP), уверенность.
 * По регионам. Временной ряд.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?region=, ?since=, ?until=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'firms.json');

export const route  = '/api/layers/firms';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🔥',
  color: '#ff4400',
  vizType: 'marker',
  source: 'basket/firms.json',
  collector: 'collect-firms.mjs',
  cache: 600,
  description: 'Пожары по данным NASA FIRMS (по регионам)',
  unit: 'fires',
};

// Координаты регионов FIRMS
const REGION_COORDS = {
  'Amazon':      { lat:  -3.4653, lng: -62.2159 },
  'Australia':   { lat: -25.2744, lng: 133.7751 },
  'California':  { lat:  36.7783, lng: -119.4179 },
  'Greece':      { lat:  39.0742, lng:  21.8243 },
  'Siberia':     { lat:  60.0000, lng: 100.0000 },
  'Congo':       { lat:  -4.0383, lng:  21.7587 },
  'Indonesia':   { lat:  -0.7893, lng: 113.9213 },
  'Canada':      { lat:  56.1304, lng: -106.3468 },
  'Portugal':    { lat:  39.3999, lng:  -8.2245 },
  'Spain':       { lat:  40.4637, lng:  -3.7492 },
  'Turkey':      { lat:  38.9637, lng:  35.2433 },
  'Chile':       { lat: -35.6751, lng: -71.5430 },
  'Argentina':   { lat: -38.4161, lng: -63.6167 },
  'Mexico':      { lat:  23.6345, lng: -102.5528 },
  'Unknown':     { lat:   0.0,    lng:    0.0    },
};

function severityFromFires(fires) {
  if (fires >= 500) return { level: 'extreme',  color: '#7f1d1d', label: 'Чрезвычайный' };
  if (fires >= 200) return { level: 'critical', color: '#dc2626', label: 'Критический' };
  if (fires >= 100) return { level: 'high',     color: '#f97316', label: 'Высокий' };
  if (fires >= 30)  return { level: 'medium',   color: '#eab308', label: 'Средний' };
  if (fires >= 5)   return { level: 'low',      color: '#84cc16', label: 'Низкий' };
  return                  { level: 'minor',    color: '#22c55e', label: 'Незначительный' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-firms.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    date: String(r.date || '').slice(0, 10),
    fires: Number(r.fires ?? r.value ?? 0),
    region: r.region || 'Unknown',
    frp: r.frp != null ? Number(r.frp) : null,
    confidence: r.confidence != null ? Number(r.confidence) : null,
  })).filter(r => r.date && Number.isFinite(r.fires));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => x.region.toLowerCase().includes(g)); }
  if (query.since) r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const f = rows.map(r => r.fires);
  const min = Math.min(...f), max = Math.max(...f);
  const avg = f.reduce((a, b) => a + b, 0) / f.length;
  const total = f.reduce((a, b) => a + b, 0);
  const byRegion = {};
  for (const r of rows) {
    if (!byRegion[r.region]) byRegion[r.region] = { total: 0, count: 0, max: 0 };
    byRegion[r.region].total += r.fires;
    byRegion[r.region].count++;
    if (r.fires > byRegion[r.region].max) byRegion[r.region].max = r.fires;
  }
  const top_regions = Object.entries(byRegion).sort((a, b) => b[1].total - a[1].total).slice(0, 5)
    .map(([region, v]) => ({ region, total: v.total, max: v.max }));
  const dates = rows.map(r => r.date).sort();
  return {
    count: rows.length,
    date_from: dates[0], date_to: dates[dates.length - 1],
    min_fires: min, max_fires: max, avg_fires: +avg.toFixed(1), total_fires: total,
    by_region: byRegion,
    top_regions,
  };
}

function toFeatureCollection(rows) {
  // Агрегация по региону для карты
  const aggregate = new Map();
  for (const r of rows) {
    const c = REGION_COORDS[r.region] || REGION_COORDS['Unknown'];
    const cur = aggregate.get(r.region) || { region: r.region, lat: c.lat, lng: c.lng, total: 0, max: 0, last_date: null };
    cur.total += r.fires;
    if (r.fires > cur.max) cur.max = r.fires;
    if (!cur.last_date || r.date > cur.last_date) cur.last_date = r.date;
    aggregate.set(r.region, cur);
  }
  const features = [...aggregate.values()].map(p => {
    const s = severityFromFires(p.max);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        region: p.region,
        totalFires: p.total,
        maxFires: p.max,
        lastDate: p.last_date,
        severity: s.level,
        severityLabel: s.label,
        color: s.color,
        category: 'ecological',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'extreme',  label: 'Чрезвычайный (500+)', color: '#7f1d1d' },
      { level: 'critical', label: 'Критический (200+)',  color: '#dc2626' },
      { level: 'high',     label: 'Высокий (100+)',      color: '#f97316' },
      { level: 'medium',   label: 'Средний (30+)',       color: '#eab308' },
      { level: 'low',      label: 'Низкий (5+)',         color: '#84cc16' },
      { level: 'minor',    label: 'Незначительный',      color: '#22c55e' },
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
function toCSVBody(rows) {
  const lines = ['date,region,fires,frp,confidence,severity'];
  for (const r of rows) { const s = severityFromFires(r.fires); lines.push(`${r.date},${r.region},${r.fires},${r.frp ?? ''},${r.confidence ?? ''},${s.level}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadData();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'firms-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: rows, stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      legend: fc.legend,
      features: fc.features,
      series: rows,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
