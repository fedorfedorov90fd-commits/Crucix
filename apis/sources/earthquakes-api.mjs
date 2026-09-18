/**
 * apis/sources/earthquakes-api.mjs — API-МОДУЛЬ: ЗЕМЛЕТРЯСЕНИЯ (USGS)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/earthquakes.json — массив событий { name, place, magnitude, depth, time, lat, lng, severity, date }.
 * Сборщик: scripts/collectors/collect-earthquakes.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?min_magnitude=, ?max_depth=, ?severity=, ?since=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'earthquakes.json');

export const route  = '/api/layers/earthquakes';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🌋',
  color: '#ff8800',
  vizType: 'marker',
  source: 'basket/earthquakes.json',
  collector: 'collect-earthquakes.mjs',
  cache: 300,
  description: 'Землетрясения по данным USGS (магнитуда, глубина, время)',
  unit: 'events',
};

// Классы магнитуды
function magnitudeClass(mag) {
  if (mag >= 8) return { level: 'great',     color: '#7f1d1d', label: 'Великое',        radius: 40 };
  if (mag >= 7) return { level: 'major',     color: '#dc2626', label: 'Крупное',        radius: 30 };
  if (mag >= 6) return { level: 'strong',    color: '#f97316', label: 'Сильное',        radius: 22 };
  if (mag >= 5) return { level: 'moderate',  color: '#eab308', label: 'Умеренное',      radius: 16 };
  if (mag >= 4) return { level: 'light',     color: '#84cc16', label: 'Слабое',         radius: 10 };
  return              { level: 'minor',     color: '#22c55e', label: 'Мелкое',         radius: 6  };
}

async function loadEvents() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-earthquakes.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  else if (parsed && Array.isArray(parsed.events)) arr = parsed.events;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    name: r.name || r.place || 'Unknown',
    place: r.place || r.name || '',
    magnitude: Number(r.magnitude ?? r.mag ?? 0),
    depth: Number(r.depth ?? 0),
    lat: Number(r.lat ?? r.latitude),
    lng: Number(r.lng ?? r.lon ?? r.longitude),
    severity: r.severity || null,
    date: String(r.date || r.time || '').slice(0, 10),
    time: r.time || null,
  })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng) && Number.isFinite(r.magnitude));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_magnitude != null) { const n = parseFloat(query.min_magnitude); if (Number.isFinite(n)) r = r.filter(x => x.magnitude >= n); }
  if (query.max_magnitude != null) { const n = parseFloat(query.max_magnitude); if (Number.isFinite(n)) r = r.filter(x => x.magnitude <= n); }
  if (query.max_depth != null) { const n = parseFloat(query.max_depth); if (Number.isFinite(n)) r = r.filter(x => x.depth <= n); }
  if (query.severity) r = r.filter(x => (x.severity || '').toLowerCase() === String(query.severity).toLowerCase());
  if (query.since) r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const mags = rows.map(r => r.magnitude);
  const depths = rows.map(r => r.depth);
  const min = Math.min(...mags), max = Math.max(...mags);
  const avg = mags.reduce((a, b) => a + b, 0) / mags.length;
  const byClass = {};
  for (const r of rows) { const c = magnitudeClass(r.magnitude).level; byClass[c] = (byClass[c] || 0) + 1; }
  const strongest = rows.slice().sort((a, b) => b.magnitude - a.magnitude).slice(0, 5).map(r => ({ name: r.name, magnitude: r.magnitude, date: r.date }));
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    min_magnitude: +min.toFixed(2),
    max_magnitude: +max.toFixed(2),
    avg_magnitude: +avg.toFixed(2),
    avg_depth_km: +(depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(1),
    by_class: byClass,
    strongest,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const c = magnitudeClass(r.magnitude);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name,
        place: r.place,
        magnitude: r.magnitude,
        depth: r.depth,
        class: c.level,
        classLabel: c.label,
        radius: c.radius,
        date: r.date,
        time: r.time,
        color: c.color,
        category: 'ecological',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'great',    label: 'Великое (8+)',   color: '#7f1d1d', radius: 40 },
      { level: 'major',    label: 'Крупное (7-8)',  color: '#dc2626', radius: 30 },
      { level: 'strong',   label: 'Сильное (6-7)',  color: '#f97316', radius: 22 },
      { level: 'moderate', label: 'Умеренное (5-6)',color: '#eab308', radius: 16 },
      { level: 'light',    label: 'Слабое (4-5)',   color: '#84cc16', radius: 10 },
      { level: 'minor',    label: 'Мелкое (<4)',    color: '#22c55e', radius: 6  },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_events: full.length, returned_events: filtered.length,
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
  const lines = ['name,place,magnitude,depth,lat,lng,date,class'];
  for (const r of rows) { const c = magnitudeClass(r.magnitude); lines.push(`${r.name},${r.place},${r.magnitude},${r.depth},${r.lat},${r.lng},${r.date},${c.level}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadEvents();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'earthquakes-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      legend: fc.legend,
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
