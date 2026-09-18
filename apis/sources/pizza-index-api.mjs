/**
 * apis/sources/pizza-index-api.mjs — API-МОДУЛЬ: PIZZA INDEX
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/detector/pizza-index.json.
 * Анализатор: scripts/analyzers/pizza-index.mjs.
 *
 * Pizza Index — неофициальный индикатор активности госструктур США (Пентагон, ЦРУ, Белый дом).
 * Растёт, когда количество заказов пиццы рядом с этими объектами резко увеличивается —
 * признак ночной работы над кризисом.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'detector', 'pizza-index.json');

export const route  = '/api/layers/pizza-index';
export const method = 'GET';

export const meta = {
  category: 'detector',
  icon: '🍕',
  color: '#ff4400',
  vizType: 'marker',
  source: 'analytics/detector/pizza-index.json',
  collector: 'analyzer:pizza-index',
  cache: 600,
  description: 'Pizza Index — неофициальный индикатор активности госструктур США',
  unit: 'index',
};

const PIZZA_LOCATIONS = {
  'Pentagon':      { lat: 38.8719, lng: -77.0563, country: 'USA', name: 'Пентагон' },
  'CIA':           { lat: 38.9517, lng: -77.1467, country: 'USA', name: 'ЦРУ' },
  'White House':   { lat: 38.8977, lng: -77.0365, country: 'USA', name: 'Белый дом' },
  'State Dept':    { lat: 38.8945, lng: -77.0486, country: 'USA', name: 'Госдеп' },
  'NSA':           { lat: 39.1086, lng: -76.7711, country: 'USA', name: 'АНБ' },
  'FBI':           { lat: 38.8977, lng: -77.0249, country: 'USA', name: 'ФБР' },
};

function pizzaBand(value) {
  if (value >= 80) return { level: 'critical', color: '#7f1d1d', label: 'Критический' };
  if (value >= 60) return { level: 'high',     color: '#dc2626', label: 'Высокий' };
  if (value >= 40) return { level: 'elevated', color: '#f97316', label: 'Повышенный' };
  if (value >= 20) return { level: 'medium',   color: '#eab308', label: 'Средний' };
  return                 { level: 'low',      color: '#22c55e', label: 'Низкий' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/pizza-index.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.results)) return data.data.results;
  if (data.data && Array.isArray(data.data.points)) return data.data.points;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function findLocation(name) {
  if (!name) return null;
  const lower = String(name).toLowerCase();
  for (const [key, val] of Object.entries(PIZZA_LOCATIONS)) {
    if (key.toLowerCase().includes(lower) || val.name.toLowerCase().includes(lower)) return val;
  }
  return null;
}

function normalizeItem(r) {
  const loc = findLocation(r.name) || findLocation(r.location) || findLocation(r.target);
  return {
    id: r.id || 'unknown',
    name: r.name || r.location || r.target || 'Pizza location',
    value: Number(r.value ?? r.index ?? r.score ?? 0),
    baseline: r.baseline != null ? Number(r.baseline) : null,
    change: r.change != null ? Number(r.change) : null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? loc?.lat ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? loc?.lng ?? 0),
    country: r.country || loc?.country || null,
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const byBand = {};
  for (const r of rows) { const b = pizzaBand(r.value).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice().sort((a, b) => b.value - a.value).slice(0, 5).map(r => ({ name: r.name, value: r.value }));
  return {
    count: rows.length,
    max_value: Math.max(...v),
    avg_value: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2),
    by_band: byBand,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = pizzaBand(r.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, value: r.value, baseline: r.baseline,
        change: r.change, severity: r.severity, country: r.country, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'detector', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'critical', label: 'Критический (80+)', color: '#7f1d1d' },
      { level: 'high',     label: 'Высокий (60+)',     color: '#dc2626' },
      { level: 'elevated', label: 'Повышенный (40+)',  color: '#f97316' },
      { level: 'medium',   label: 'Средний (20+)',     color: '#eab308' },
      { level: 'low',      label: 'Низкий (<20)',      color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_points: full.length, returned_points: filtered.length,
    with_coords: filtered.filter(r => r.lat !== 0 || r.lng !== 0).length,
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
  const lines = ['id,name,value,baseline,change,severity,country'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.value},${r.baseline ?? ''},${r.change ?? ''},${r.severity},${r.country || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const data = await loadData();
    const rawItems = extractItems(data);
    const full = rawItems.map(normalizeItem);
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'pizza-index-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      bands: fc.bands,
      features: fc.features,
      items: rows,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
