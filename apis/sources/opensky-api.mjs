/**
 * apis/sources/opensky-api.mjs — API-МОДУЛЬ: OPENSKY АВИАЦИЯ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/opensky.json — массив { airport, flights, status, country, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-opensky.mjs.
 *
 * OpenSky — данные о загрузке аэропортов, задержках, статусах рейсов.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?status=, ?country=, ?min_flights=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'opensky.json');

export const route  = '/api/layers/opensky';
export const method = 'GET';

export const meta = {
  category: 'transport',
  icon: '✈️',
  color: '#ffcc00',
  vizType: 'marker',
  source: 'basket/opensky.json',
  collector: 'collect-opensky.mjs',
  cache: 300,
  description: 'OpenSky — загрузка аэропортов, статусы рейсов',
  unit: 'flights',
};

const SEVERITY_COLOR = { 'INFO': '#22c55e', 'LOW': '#84cc16', 'MEDIUM': '#eab308', 'HIGH': '#f97316', 'CRITICAL': '#dc2626' };

function flightsBand(n) {
  if (n >= 1000) return { level: 'mega',   color: '#7f1d1d', label: 'Мега-хаб' };
  if (n >= 500)  return { level: 'huge',   color: '#dc2626', label: 'Очень крупный' };
  if (n >= 200)  return { level: 'large',  color: '#f97316', label: 'Крупный' };
  if (n >= 100)  return { level: 'medium', color: '#eab308', label: 'Средний' };
  return               { level: 'small',  color: '#22c55e', label: 'Малый' };
}

async function loadAirports() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-opensky.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.data && Array.isArray(parsed.data.features)) arr = parsed.data.features;
  else if (parsed && Array.isArray(parsed.airports)) arr = parsed.airports;
  else if (parsed && Array.isArray(parsed.data))     arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        airport: p.airport || p.name || 'Unknown',
        flights: Number(p.flights ?? 0),
        status: p.status || 'Normal',
        country: p.country || null,
        lat: Number(coords[1]), lng: Number(coords[0]),
        severity: String(p.severity || 'INFO').toUpperCase(),
        timestamp: p.timestamp || null,
      };
    }
    return {
      airport: r.airport || r.name || 'Unknown',
      flights: Number(r.flights ?? 0),
      status: r.status || 'Normal',
      country: r.country || null,
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      severity: String(r.severity || 'INFO').toUpperCase(),
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.status)  { const x = String(query.status).toLowerCase(); r = r.filter(e => e.status.toLowerCase().includes(x)); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.min_flights != null) { const n = parseInt(query.min_flights, 10); if (Number.isFinite(n)) r = r.filter(x => x.flights >= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const f = rows.map(r => r.flights);
  const total = f.reduce((a, b) => a + b, 0);
  const byStatus = {}, bySeverity = {}, byBand = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    const b = flightsBand(r.flights).level;
    byBand[b] = (byBand[b] || 0) + 1;
  }
  const top_airports = rows.slice().sort((a, b) => b.flights - a.flights).slice(0, 5).map(r => ({ airport: r.airport, flights: r.flights }));
  return {
    count: rows.length,
    total_flights: total,
    max_flights: Math.max(...f),
    avg_flights: +(total / rows.length).toFixed(1),
    by_status: byStatus,
    by_severity: bySeverity,
    by_band: byBand,
    top_airports,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const b = flightsBand(r.flights);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        airport: r.airport, country: r.country,
        flights: r.flights, status: r.status,
        band: b.level, bandLabel: b.label,
        severity: r.severity,
        color: SEVERITY_COLOR[r.severity] || b.color,
        category: 'transport', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'mega',   label: 'Мега-хаб (1000+)',    color: '#7f1d1d' },
      { level: 'huge',   label: 'Очень крупный (500+)', color: '#dc2626' },
      { level: 'large',  label: 'Крупный (200+)',       color: '#f97316' },
      { level: 'medium', label: 'Средний (100+)',       color: '#eab308' },
      { level: 'small',  label: 'Малый (<100)',         color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_airports: full.length, returned_airports: filtered.length,
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
  const lines = ['airport,country,flights,status,severity,lat,lng'];
  for (const r of rows) lines.push(`"${r.airport.replace(/"/g, '""')}",${r.country || ''},${r.flights},${r.status},${r.severity},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadAirports();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'opensky-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
