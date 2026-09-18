/**
 * apis/sources/gps-jamming-api.mjs — API-МОДУЛЬ: GPS-ГЛУШЕНИЕ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/gps-jamming.json — массив { location, country, lat, lng, intensity }.
 * Сборщик: scripts/collectors/collect-gps-jamming.mjs.
 *
 * Зоны GPS-глушения. Intensity: 1-5. Критичный сигнал в военных зонах.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'gps-jamming.json');

export const route  = '/api/layers/gps-jamming';
export const method = 'GET';

export const meta = {
  category: 'military',
  icon: '📡',
  color: '#ff8800',
  vizType: 'marker',
  source: 'basket/gps-jamming.json',
  collector: 'collect-gps-jamming.mjs',
  cache: 300,
  description: 'Зоны GPS-глушения — интенсивность 1-5',
  unit: 'intensity',
};

function intensityLevel(n) {
  if (n >= 5) return { level: 'critical', color: '#7f1d1d', label: 'Критическая' };
  if (n >= 4) return { level: 'high',     color: '#dc2626', label: 'Высокая' };
  if (n >= 3) return { level: 'medium',   color: '#f97316', label: 'Средняя' };
  if (n >= 2) return { level: 'low',      color: '#eab308', label: 'Низкая' };
  return           { level: 'info',     color: '#22c55e', label: 'Информационная' };
}

async function loadZones() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-gps-jamming.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.zones)) arr = parsed.zones;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        location: p.location || p.name || 'Unknown',
        country: p.country || null,
        lat: Number(coords[1]), lng: Number(coords[0]),
        intensity: Number(p.intensity ?? p.value ?? 1),
        source: p.source || null,
        timestamp: p.timestamp || null,
      };
    }
    return {
      location: r.location || r.name || 'Unknown',
      country: r.country || null,
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      intensity: Number(r.intensity ?? r.value ?? 1),
      source: r.source || null,
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.intensity - a.intensity);
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.min_intensity != null) { const n = parseFloat(query.min_intensity); if (Number.isFinite(n)) r = r.filter(x => x.intensity >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.location.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const ints = rows.map(r => r.intensity);
  const total = ints.reduce((a, b) => a + b, 0);
  const byLevel = {}, byCountry = {};
  for (const r of rows) {
    const lvl = intensityLevel(r.intensity).level;
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, max_intensity: Math.max(...ints), avg_intensity: +(total / rows.length).toFixed(2), by_level: byLevel, by_country: byCountry, top_countries };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const lvl = intensityLevel(r.intensity);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        location: r.location, country: r.country,
        intensity: r.intensity, intensityLevel: lvl.level, intensityLabel: lvl.label,
        source: r.source, timestamp: r.timestamp,
        color: lvl.color,
        category: 'military', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'info',     label: 'Информационная (1)', color: '#22c55e' },
      { level: 'low',      label: 'Низкая (2)',         color: '#eab308' },
      { level: 'medium',   label: 'Средняя (3)',        color: '#f97316' },
      { level: 'high',     label: 'Высокая (4)',        color: '#dc2626' },
      { level: 'critical', label: 'Критическая (5+)',   color: '#7f1d1d' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_zones: full.length, returned_zones: filtered.length,
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
  const lines = ['location,country,intensity,intensityLevel,lat,lng'];
  for (const r of rows) { const lvl = intensityLevel(r.intensity); lines.push(`"${r.location.replace(/"/g, '""')}",${r.country || ''},${r.intensity},${lvl.level},${r.lat},${r.lng}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadZones();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'gps-jamming-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
