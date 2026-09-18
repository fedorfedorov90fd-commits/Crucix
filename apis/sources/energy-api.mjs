/**
 * apis/sources/energy-api.mjs — API-МОДУЛЬ: ЭНЕРГЕТИКА
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/energy.json — массив энергетических объектов { name, lat, lng, type, capacity_mw }.
 * Сборщик: scripts/collectors/collect-energy.mjs.
 *
 * Энергетические мощности по регионам (hydro/solar/wind/nuclear/mixed).
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?type=, ?min_capacity=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'energy.json');

export const route  = '/api/layers/energy';
export const method = 'GET';

export const meta = {
  category: 'energy',
  icon: '⚡',
  color: '#ff8800',
  vizType: 'marker',
  source: 'basket/energy.json',
  collector: 'collect-energy.mjs',
  cache: 600,
  description: 'Энергетические мощности по регионам мира',
  unit: 'MW',
};

const TYPE_STYLE = {
  'hydro':   { color: '#0066ff', icon: '💧', label: 'Гидро' },
  'solar':   { color: '#ffcc00', icon: '☀️', label: 'Солнечная' },
  'wind':    { color: '#22c55e', icon: '🌬️', label: 'Ветровая' },
  'nuclear': { color: '#a21caf', icon: '☢️', label: 'Атомная' },
  'gas':     { color: '#f97316', icon: '🔥', label: 'Газовая' },
  'coal':    { color: '#3f3f46', icon: '⛏️', label: 'Угольная' },
  'mixed':   { color: '#64748b', icon: '⚡', label: 'Смешанная' },
  'unknown': { color: '#94a3b8', icon: '⚡', label: 'Неизвестно' },
};

function capacityBand(mw) {
  if (mw >= 100000) return { level: 'giant',    color: '#7f1d1d', label: 'Гигант (100+ ГВт)' };
  if (mw >= 50000)  return { level: 'very_big', color: '#dc2626', label: 'Очень крупный' };
  if (mw >= 20000)  return { level: 'big',      color: '#f97316', label: 'Крупный' };
  if (mw >= 5000)   return { level: 'medium',   color: '#eab308', label: 'Средний' };
  return                   { level: 'small',    color: '#22c55e', label: 'Малый' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-energy.mjs'; throw err;
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
        lat: Number(p.lat ?? coords[1]),
        lng: Number(p.lng ?? coords[0]),
        type: String(p.type || 'unknown').toLowerCase(),
        capacity_mw: Number(p.capacity_mw ?? p.capacity ?? 0),
      };
    }
    return {
      name: r.name || 'Unknown',
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      type: String(r.type || 'unknown').toLowerCase(),
      capacity_mw: Number(r.capacity_mw ?? r.capacity ?? 0),
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type) r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.min_capacity != null) { const n = parseFloat(query.min_capacity); if (Number.isFinite(n)) r = r.filter(x => x.capacity_mw >= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const cap = rows.map(r => r.capacity_mw);
  const total = cap.reduce((a, b) => a + b, 0);
  const min = Math.min(...cap), max = Math.max(...cap);
  const byType = {};
  for (const r of rows) {
    if (!byType[r.type]) byType[r.type] = { count: 0, total_mw: 0 };
    byType[r.type].count++;
    byType[r.type].total_mw += r.capacity_mw;
  }
  const top5 = rows.slice().sort((a, b) => b.capacity_mw - a.capacity_mw).slice(0, 5).map(r => ({ name: r.name, capacity_mw: r.capacity_mw, type: r.type }));
  return { count: rows.length, total_mw: total, min_mw: min, max_mw: max, avg_mw: +(total / rows.length).toFixed(0), by_type: byType, top_5: top5 };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const style = TYPE_STYLE[r.type] || TYPE_STYLE.unknown;
    const cb = capacityBand(r.capacity_mw);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name,
        type: r.type,
        typeLabel: style.label,
        capacity_mw: r.capacity_mw,
        capacityLevel: cb.level,
        capacityLabel: cb.label,
        color: style.color,
        category: 'energy',
        icon: style.icon,
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
    total_points: full.length, returned_points: filtered.length,
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
  const lines = ['name,type,capacity_mw,lat,lng,capacityLevel'];
  for (const r of rows) { const cb = capacityBand(r.capacity_mw); lines.push(`${r.name},${r.type},${r.capacity_mw},${r.lat},${r.lng},${cb.level}`); }
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
    const extra = { 'X-Module': 'energy-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
