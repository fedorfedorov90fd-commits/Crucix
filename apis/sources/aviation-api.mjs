/**
 * apis/sources/aviation-api.mjs — API-МОДУЛЬ: АВИАЦИОННЫЙ МОНИТОРИНГ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/aviation.json — { success, data: { features: [...] } }.
 * Сборщик: scripts/collectors/collect-aviation-real.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?type=, ?severity=, ?aircraft=, ?min_altitude=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'aviation.json');

export const route  = '/api/layers/aviation';
export const method = 'GET';

export const meta = {
  category: 'transport',
  icon: '✈️',
  color: '#f97316',
  vizType: 'marker',
  source: 'basket/aviation.json',
  collector: 'collect-aviation-real.mjs',
  cache: 60,
  description: 'Авиационный мониторинг — рейсы, высоты, типы ВС',
  unit: 'flights',
};

// Классификация высоты
function altitudeBand(alt) {
  if (alt <= 1000)  return { level: 'ground',    color: '#64748b', label: 'Земля' };
  if (alt <= 5000)  return { level: 'low',       color: '#22c55e', label: 'Низкая' };
  if (alt <= 10000) return { level: 'medium',    color: '#eab308', label: 'Средняя' };
  if (alt <= 13000) return { level: 'high',      color: '#f97316', label: 'Высокая' };
  return { level: 'very_high', color: '#dc2626', label: 'Очень высокая' };
}

const SEVERITY_COLOR = { low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#dc2626' };

async function loadFlights() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-aviation-real.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  // Достаём features из любой формы
  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.data && Array.isArray(parsed.data.features)) arr = parsed.data.features;
  else if (parsed && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        flight: p.flight || p.callsign || 'Unknown',
        aircraft: p.aircraft || p.model || null,
        altitude: Number(p.altitude ?? p.alt ?? 0),
        lat: Number(coords[1]), lng: Number(coords[0]),
        type: p.type || 'unknown',
        severity: p.severity || 'low',
        speed: p.speed != null ? Number(p.speed) : null,
        heading: p.heading != null ? Number(p.heading) : null,
        country: p.country || null,
        origin: p.origin || null,
        destination: p.destination || null,
      };
    }
    return null;
  }).filter(r => r && Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type)     r = r.filter(x => x.type.toLowerCase() === String(query.type).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity.toLowerCase() === String(query.severity).toLowerCase());
  if (query.aircraft) r = r.filter(x => (x.aircraft || '').toLowerCase().includes(String(query.aircraft).toLowerCase()));
  if (query.min_altitude != null) {
    const n = parseFloat(query.min_altitude);
    if (Number.isFinite(n)) r = r.filter(x => x.altitude >= n);
  }
  if (query.max_altitude != null) {
    const n = parseFloat(query.max_altitude);
    if (Number.isFinite(n)) r = r.filter(x => x.altitude <= n);
  }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const alt = rows.map(r => r.altitude);
  const min = Math.min(...alt), max = Math.max(...alt);
  const avg = alt.reduce((a, b) => a + b, 0) / alt.length;
  const byType = {}, bySeverity = {}, byBand = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    const b = altitudeBand(r.altitude).level;
    byBand[b] = (byBand[b] || 0) + 1;
  }
  const highest = rows.slice().sort((a, b) => b.altitude - a.altitude).slice(0, 5)
    .map(r => ({ flight: r.flight, altitude: r.altitude }));
  return {
    count: rows.length,
    min_altitude: min, max_altitude: max, avg_altitude: +avg.toFixed(0),
    by_type: byType, by_severity: bySeverity, by_band: byBand,
    highest,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const b = altitudeBand(r.altitude);
    const sevColor = SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.low;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        flight: r.flight, aircraft: r.aircraft,
        altitude: r.altitude, altitudeBand: b.level, altitudeLabel: b.label,
        speed: r.speed, heading: r.heading,
        type: r.type, severity: r.severity, severityColor: sevColor,
        country: r.country, origin: r.origin, destination: r.destination,
        color: sevColor,
        category: 'transport',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'ground',    label: 'Земля',           color: '#64748b' },
      { level: 'low',       label: 'Низкая',          color: '#22c55e' },
      { level: 'medium',    label: 'Средняя',         color: '#eab308' },
      { level: 'high',      label: 'Высокая',         color: '#f97316' },
      { level: 'very_high', label: 'Очень высокая',   color: '#dc2626' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_flights: full.length, returned_flights: filtered.length,
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
  const lines = ['flight,aircraft,type,severity,altitude,lat,lng,speed,heading'];
  for (const r of rows) lines.push(`${r.flight},${r.aircraft || ''},${r.type},${r.severity},${r.altitude},${r.lat},${r.lng},${r.speed ?? ''},${r.heading ?? ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadFlights();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'aviation-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
