/**
 * apis/sources/ships-api.mjs — API-МОДУЛЬ: МОРСКОЙ ТРЕКИНГ (AIS)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/ships.json — FeatureCollection судов { name, imo, type, severity }.
 * Сборщик: scripts/collectors/collect-ships-real.mjs.
 *
 * AIS-трекинг: контейнеровозы, танкеры, военные суда. Ключевые морские узлы.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'ships.json');

export const route  = '/api/layers/ships';
export const method = 'GET';

export const meta = {
  category: 'transport',
  icon: '🚢',
  color: '#00aaff',
  vizType: 'marker',
  source: 'basket/ships.json',
  collector: 'collect-ships-real.mjs',
  cache: 300,
  description: 'Морской трекинг AIS — суда по типам и статусам',
  unit: 'vessels',
};

const TYPE_STYLE = {
  'container': { color: '#3b82f6', icon: '📦', label: 'Контейнеровоз' },
  'cargo':     { color: '#3b82f6', icon: '🚢', label: 'Грузовое' },
  'tanker':    { color: '#f97316', icon: '🛢️', label: 'Танкер' },
  'passenger': { color: '#8b5cf6', icon: '⛴️', label: 'Пассажирское' },
  'fishing':   { color: '#22c55e', icon: '🎣', label: 'Рыболовное' },
  'military':  { color: '#dc2626', icon: '⚓', label: 'Военное' },
  'tug':       { color: '#a16207', icon: '🛟', label: 'Буксир' },
  'unknown':   { color: '#64748b', icon: '❓', label: 'Неизвестно' },
};

const SEVERITY_COLOR = { 'INFO': '#22c55e', 'LOW': '#84cc16', 'MEDIUM': '#eab308', 'HIGH': '#f97316', 'CRITICAL': '#dc2626' };

async function loadShips() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-ships-real.mjs'; throw err;
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
        name: p.name || 'Unknown',
        imo: p.imo || null,
        mmsi: p.mmsi || null,
        type: String(p.type || 'unknown').toLowerCase(),
        severity: String(p.severity || 'INFO').toUpperCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        country: p.country || null,
        flag: p.flag || null,
        speed: p.speed != null ? Number(p.speed) : null,
        heading: p.heading != null ? Number(p.heading) : null,
        destination: p.destination || null,
        length: p.length != null ? Number(p.length) : null,
      };
    }
    return {
      name: r.name || 'Unknown',
      imo: r.imo || null, mmsi: r.mmsi || null,
      type: String(r.type || 'unknown').toLowerCase(),
      severity: String(r.severity || 'INFO').toUpperCase(),
      lat: Number(r.lat ?? r.latitude), lng: Number(r.lng ?? r.lon ?? r.longitude),
      country: r.country || null, flag: r.flag || null,
      speed: r.speed != null ? Number(r.speed) : null,
      heading: r.heading != null ? Number(r.heading) : null,
      destination: r.destination || null,
      length: r.length != null ? Number(r.length) : null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type) r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q) || (x.imo || '').includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byType = {}, bySeverity = {}, byFlag = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.flag) byFlag[r.flag] = (byFlag[r.flag] || 0) + 1;
  }
  return { count: rows.length, by_type: byType, by_severity: bySeverity, by_flag: byFlag };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const style = TYPE_STYLE[r.type] || TYPE_STYLE.unknown;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name, imo: r.imo, mmsi: r.mmsi,
        type: r.type, typeLabel: style.label,
        severity: r.severity, severityColor: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.INFO,
        country: r.country, flag: r.flag,
        speed: r.speed, heading: r.heading, destination: r.destination, length: r.length,
        color: style.color, icon: style.icon,
        category: 'transport',
      },
    };
  });
  return {
    type: 'FeatureCollection',
    types: Object.entries(TYPE_STYLE).map(([k, v]) => ({ type: k, ...v })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_vessels: full.length, returned_vessels: filtered.length,
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
  const lines = ['name,imo,mmsi,type,severity,country,flag,lat,lng,speed,heading,destination'];
  for (const r of rows) lines.push(`"${r.name.replace(/"/g, '""')}",${r.imo || ''},${r.mmsi || ''},${r.type},${r.severity},${r.country || ''},${r.flag || ''},${r.lat},${r.lng},${r.speed ?? ''},${r.heading ?? ''},${r.destination || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadShips();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'ships-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      types: fc.types,
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
