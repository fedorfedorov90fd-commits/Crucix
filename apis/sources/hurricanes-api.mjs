/**
 * apis/sources/hurricanes-api.mjs — API-МОДУЛЬ: УРАГАНЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/hurricanes.json — массив { id, name, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-hurricanes.mjs.
 *
 * Активные ураганы, тайфуны, тропические штормы. Источник — NOAA, JTWC.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'hurricanes.json');

export const route  = '/api/layers/hurricanes';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🌀',
  color: '#0066ff',
  vizType: 'marker',
  source: 'basket/hurricanes.json',
  collector: 'collect-hurricanes.mjs',
  cache: 300,
  description: 'Ураганы, тайфуны, тропические штормы',
  unit: 'storms',
};

const CATEGORY_COLOR = {
  'td':        '#22c55e', 'ts':       '#eab308', 'cat1':   '#facc15',
  'cat2':      '#f97316', 'cat3':     '#dc2626', 'cat4':   '#b91c1c', 'cat5': '#7f1d1d',
  'info':      '#22c55e', 'low':      '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626',
};

function stormCategory(sev, windSpeed) {
  if (windSpeed != null) {
    if (windSpeed >= 252) return { level: 'cat5', color: '#7f1d1d', label: 'Категория 5' };
    if (windSpeed >= 209) return { level: 'cat4', color: '#b91c1c', label: 'Категория 4' };
    if (windSpeed >= 178) return { level: 'cat3', color: '#dc2626', label: 'Категория 3' };
    if (windSpeed >= 154) return { level: 'cat2', color: '#f97316', label: 'Категория 2' };
    if (windSpeed >= 119) return { level: 'cat1', color: '#facc15', label: 'Категория 1' };
    if (windSpeed >= 63)  return { level: 'ts',   color: '#eab308', label: 'Троп. шторм' };
    return                       { level: 'td',   color: '#22c55e', label: 'Троп. депрессия' };
  }
  const map = { 'critical': 'cat4', 'high': 'cat2', 'medium': 'cat1', 'low': 'ts', 'info': 'td' };
  const lvl = map[sev] || 'ts';
  return { level: lvl, color: CATEGORY_COLOR[lvl], label: lvl.toUpperCase() };
}

async function loadStorms() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-hurricanes.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.storms)) arr = parsed.storms;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        id: p.id || r.id || 'unknown',
        name: p.name || 'Unknown',
        category: p.category || null,
        windSpeed: p.windSpeed != null ? Number(p.windSpeed) : null,
        pressure: p.pressure != null ? Number(p.pressure) : null,
        severity: String(p.severity || 'medium').toLowerCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        basin: p.basin || null,
        direction: p.direction || null,
        timestamp: p.timestamp || null,
      };
    }
    return {
      id: r.id || 'unknown',
      name: r.name || 'Unknown',
      category: r.category || null,
      windSpeed: r.windSpeed != null ? Number(r.windSpeed) : null,
      pressure: r.pressure != null ? Number(r.pressure) : null,
      severity: String(r.severity || 'medium').toLowerCase(),
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      basin: r.basin || null,
      direction: r.direction || null,
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.basin) { const b = String(query.basin).toLowerCase(); r = r.filter(x => (x.basin || '').toLowerCase().includes(b)); }
  if (query.min_wind != null) { const n = parseFloat(query.min_wind); if (Number.isFinite(n)) r = r.filter(x => (x.windSpeed || 0) >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byCategory = {}, byBasin = {};
  for (const r of rows) {
    const cat = stormCategory(r.severity, r.windSpeed);
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byCategory[cat.level] = (byCategory[cat.level] || 0) + 1;
    if (r.basin) byBasin[r.basin] = (byBasin[r.basin] || 0) + 1;
  }
  const withWind = rows.filter(r => r.windSpeed != null);
  return {
    count: rows.length,
    max_wind: withWind.length > 0 ? Math.max(...withWind.map(r => r.windSpeed)) : 0,
    avg_wind: withWind.length > 0 ? +(withWind.reduce((a, b) => a + b.windSpeed, 0) / withWind.length).toFixed(1) : 0,
    by_severity: bySeverity,
    by_category: byCategory,
    by_basin: byBasin,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const cat = stormCategory(r.severity, r.windSpeed);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, category: r.category, windSpeed: r.windSpeed,
        pressure: r.pressure, severity: r.severity, basin: r.basin, direction: r.direction,
        timestamp: r.timestamp,
        stormLevel: cat.level, stormLabel: cat.label, color: cat.color,
        category_layer: 'ecological', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    categories: [
      { level: 'td',   label: 'Троп. депрессия', color: '#22c55e' },
      { level: 'ts',   label: 'Троп. шторм',     color: '#eab308' },
      { level: 'cat1', label: 'Категория 1',     color: '#facc15' },
      { level: 'cat2', label: 'Категория 2',     color: '#f97316' },
      { level: 'cat3', label: 'Категория 3',     color: '#dc2626' },
      { level: 'cat4', label: 'Категория 4',     color: '#b91c1c' },
      { level: 'cat5', label: 'Категория 5',     color: '#7f1d1d' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_storms: full.length, returned_storms: filtered.length,
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
  const lines = ['id,name,severity,windSpeed,pressure,basin,lat,lng'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.severity},${r.windSpeed ?? ''},${r.pressure ?? ''},${r.basin || ''},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadStorms();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'hurricanes-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      categories: fc.categories,
      features: fc.features,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
