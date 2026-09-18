/**
 * apis/sources/ofac-api.mjs — API-МОДУЛЬ: САНКЦИИ OFAC SDN
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/ofac.json — плоский массив { entity, risk, reason, country, lat, lng, severity, timestamp }.
 * Резервный: data/basket/ofac-data.json — { sanctions: [...] }.
 * Сборщик: scripts/collectors/collect-ofac.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?severity=, ?country=, ?min_risk=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE   = join(PROJECT_ROOT, 'data', 'basket', 'ofac.json');
const BASKET_ALT    = join(PROJECT_ROOT, 'data', 'basket', 'ofac-data.json');

export const route  = '/api/layers/ofac';
export const method = 'GET';

export const meta = {
  category: 'threats',
  icon: '⚠️',
  color: '#a21caf',
  vizType: 'marker',
  source: 'basket/ofac.json',
  collector: 'collect-ofac.mjs',
  cache: 3600,
  description: 'Санкционные списки OFAC SDN — организации и лица',
  unit: 'entities',
};

const SEVERITY_COLOR = {
  'CRITICAL': '#7f1d1d',
  'HIGH':     '#dc2626',
  'MEDIUM':   '#f97316',
  'LOW':      '#eab308',
  'INFO':     '#22c55e',
};

const COUNTRY_COORDS = {
  'Russia': { lat: 55.7558, lng: 37.6173 }, 'China': { lat: 39.9042, lng: 116.4074 },
  'Iran': { lat: 35.6892, lng: 51.3890 }, 'North Korea': { lat: 39.0392, lng: 125.7625 },
  'Syria': { lat: 33.5138, lng: 36.2765 }, 'Belarus': { lat: 53.9045, lng: 27.5615 },
  'Venezuela': { lat: 10.4806, lng: -66.9036 }, 'Cuba': { lat: 23.1136, lng: -82.3666 },
  'Myanmar': { lat: 19.7633, lng: 96.0785 }, 'Sudan': { lat: 15.5007, lng: 32.5599 },
};

async function loadEntities() {
  let raw = null, fileUsed = null;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); fileUsed = 'ofac.json'; }
  catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
  if (!raw) {
    try { raw = await fs.readFile(BASKET_ALT, 'utf8'); fileUsed = 'ofac-data.json'; } catch {}
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-ofac.mjs'; throw err;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.sanctions)) arr = parsed.sanctions;
  else if (parsed && Array.isArray(parsed.entries))   arr = parsed.entries;
  else if (parsed && Array.isArray(parsed.data))      arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const country = r.country || r.region || null;
    const c = country ? COUNTRY_COORDS[country] : null;
    const lat = Number(r.lat ?? c?.lat);
    const lng = Number(r.lng ?? r.lon ?? c?.lng);
    const name = r.entity || r.name || 'Unknown';
    return {
      name,
      type: r.type || 'entity',
      program: r.program || r.reason || null,
      country,
      risk: Number(r.risk ?? 0),
      severity: String(r.severity || 'MEDIUM').toUpperCase(),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      timestamp: r.timestamp || r.date || null,
      file: fileUsed,
    };
  }).filter(r => r.name);

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.country)  { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.min_risk != null) { const n = parseFloat(query.min_risk); if (Number.isFinite(n)) r = r.filter(x => x.risk >= n); }
  if (query.type)     r = r.filter(x => x.type.toLowerCase() === String(query.type).toLowerCase());
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byCountry = {}, byType = {};
  let totalRisk = 0;
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    totalRisk += r.risk;
  }
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    avg_risk: +(totalRisk / rows.length).toFixed(1),
    by_severity: bySeverity,
    by_country: byCountry,
    by_type: byType,
    top_countries,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat != null && r.lng != null).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      name: r.name,
      type: r.type,
      program: r.program,
      country: r.country,
      risk: r.risk,
      severity: r.severity,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.MEDIUM,
      timestamp: r.timestamp,
      category: 'threats',
      icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: Object.entries(SEVERITY_COLOR).map(([severity, color]) => ({ severity, color })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_entities: full.length, returned_entities: filtered.length,
    coords_available: filtered.filter(r => r.lat != null && r.lng != null).length,
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
  const lines = ['name,type,country,risk,severity,program'];
  for (const r of rows) lines.push(`${r.name},${r.type},${r.country || ''},${r.risk},${r.severity},${r.program || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadEntities();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'ofac-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
