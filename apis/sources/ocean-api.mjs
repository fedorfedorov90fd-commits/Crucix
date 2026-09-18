/**
 * apis/sources/ocean-api.mjs — API-МОДУЛЬ: ОКЕАНИЧЕСКИЕ ДАННЫЕ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/ocean.json — массив { id, name, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-ocean.mjs.
 *
 * Океанические данные: температура, течения, штормы, уровень моря.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'ocean.json');

export const route  = '/api/layers/ocean';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🌊',
  color: '#00ccff',
  vizType: 'marker',
  source: 'basket/ocean.json',
  collector: 'collect-ocean.mjs',
  cache: 600,
  description: 'Океанические данные: температура, течения, штормы, уровень моря',
  unit: 'events',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

const TYPE_STYLE = {
  'temperature': { color: '#ff6600', icon: '🌡️', label: 'Температура' },
  'current':     { color: '#00ccff', icon: '♒',  label: 'Течения' },
  'storm':       { color: '#0066ff', icon: '🌀',  label: 'Шторм' },
  'level':       { color: '#00aa88', icon: '📏',  label: 'Уровень моря' },
  'salinity':    { color: '#ffcc00', icon: '🧂',  label: 'Солёность' },
  'wave':        { color: '#0066ff', icon: '🌊',  label: 'Волны' },
  'unknown':     { color: '#64748b', icon: '❓',  label: 'Неизвестно' },
};

async function loadEvents() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-ocean.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.events)) arr = parsed.events;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        id: p.id || r.id || 'unknown',
        name: p.name || 'Unknown',
        type: String(p.type || 'unknown').toLowerCase(),
        severity: String(p.severity || 'info').toLowerCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        value: p.value != null ? Number(p.value) : null,
        unit: p.unit || null,
        timestamp: p.timestamp || null,
      };
    }
    return {
      id: r.id || 'unknown',
      name: r.name || 'Unknown',
      type: String(r.type || 'unknown').toLowerCase(),
      severity: String(r.severity || 'info').toLowerCase(),
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      value: r.value != null ? Number(r.value) : null,
      unit: r.unit || null,
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type) r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byType = {}, bySeverity = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  }
  const withValue = rows.filter(r => r.value != null);
  return {
    count: rows.length,
    avg_value: withValue.length > 0 ? +(withValue.reduce((a, b) => a + b.value, 0) / withValue.length).toFixed(2) : 0,
    by_type: byType,
    by_severity: bySeverity,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const style = TYPE_STYLE[r.type] || TYPE_STYLE.unknown;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, type: r.type, typeLabel: style.label,
        severity: r.severity, value: r.value, unit: r.unit, timestamp: r.timestamp,
        color: SEVERITY_COLOR[r.severity] || style.color,
        icon: style.icon,
        category: 'ecological',
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
  const lines = ['id,name,type,severity,value,unit,lat,lng,timestamp'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.type},${r.severity},${r.value ?? ''},${r.unit || ''},${r.lat},${r.lng},${r.timestamp || ''}`);
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
    const extra = { 'X-Module': 'ocean-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
