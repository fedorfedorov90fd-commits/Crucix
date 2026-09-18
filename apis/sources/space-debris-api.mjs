/**
 * apis/sources/space-debris-api.mjs — API-МОДУЛЬ: КОСМИЧЕСКИЙ МУСОР
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/space-debris.json — массив { label, value, country, lat, lng }.
 * Сборщик: scripts/collectors/collect-space-track.mjs.
 *
 * Космический мусор по орбитальным поясам: LEO, GEO, Sun-sync.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'space-debris.json');

export const route  = '/api/layers/space-debris';
export const method = 'GET';

export const meta = {
  category: 'space',
  icon: '🛰️',
  color: '#888888',
  vizType: 'marker',
  source: 'basket/space-debris.json',
  collector: 'collect-space-track.mjs',
  cache: 3600,
  description: 'Космический мусор по орбитальным поясам',
  unit: 'objects',
};

function debrisBand(value) {
  if (value >= 2000) return { level: 'extreme',  color: '#7f1d1d', label: 'Экстремально' };
  if (value >= 1000) return { level: 'critical', color: '#dc2626', label: 'Критично' };
  if (value >= 500)  return { level: 'high',     color: '#f97316', label: 'Высокий' };
  if (value >= 100)  return { level: 'medium',   color: '#eab308', label: 'Средний' };
  return                    { level: 'low',     color: '#22c55e', label: 'Низкий' };
}

async function loadDebris() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-space-track.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        label: p.label || p.name || 'Unknown',
        value: Number(p.value ?? p.count ?? 0),
        lat: Number(coords[1]), lng: Number(coords[0]),
        country: p.country || 'Global',
        orbit: p.orbit || null,
      };
    }
    return {
      label: r.label || r.name || 'Unknown',
      value: Number(r.value ?? r.count ?? 0),
      lat: Number(r.lat ?? r.latitude ?? 0),
      lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
      country: r.country || 'Global',
      orbit: r.orbit || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng) && Number.isFinite(r.value));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.value - a.value);
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.orbit) r = r.filter(x => (x.orbit || x.label).toLowerCase().includes(String(query.orbit).toLowerCase()));
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const total = v.reduce((a, b) => a + b, 0);
  const byBand = {};
  for (const r of rows) { const b = debrisBand(r.value).level; byBand[b] = (byBand[b] || 0) + 1; }
  return { count: rows.length, total_objects: total, max: Math.max(...v), min: Math.min(...v), by_band: byBand };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const b = debrisBand(r.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        label: r.label, value: r.value, country: r.country, orbit: r.orbit,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'space', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'extreme',  label: 'Экстремально (2000+)', color: '#7f1d1d' },
      { level: 'critical', label: 'Критично (1000+)',     color: '#dc2626' },
      { level: 'high',     label: 'Высокий (500+)',       color: '#f97316' },
      { level: 'medium',   label: 'Средний (100+)',       color: '#eab308' },
      { level: 'low',      label: 'Низкий (<100)',        color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_clusters: full.length, returned_clusters: filtered.length,
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
  const lines = ['label,value,orbit,country,lat,lng'];
  for (const r of rows) lines.push(`"${r.label.replace(/"/g, '""')}",${r.value},${r.orbit || ''},${r.country || ''},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadDebris();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'space-debris-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      bands: fc.bands,
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
