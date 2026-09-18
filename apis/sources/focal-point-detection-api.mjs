/**
 * apis/sources/focal-point-detection-api.mjs — API-МОДУЛЬ: ДЕТЕКТОР ФОКУСНЫХ ТОЧЕК
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/detector/focal-point-detection.json.
 * Анализатор: scripts/analyzers/focal-point-detection.mjs.
 *
 * Детектор фокусных точек — мест, где концентрация событий резко выше обычной.
 * Источники: acled, earthquakes. Выделяет точки притяжения аномалий.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'detector', 'focal-point-detection.json');

export const route  = '/api/layers/focal-point-detection';
export const method = 'GET';

export const meta = {
  category: 'detector',
  icon: '🎯',
  color: '#dc2626',
  vizType: 'marker',
  source: 'analytics/detector/focal-point-detection.json',
  collector: 'analyzer:focal-point-detection',
  cache: 300,
  description: 'Детектор фокусных точек — концентрация событий выше обычной',
  unit: 'points',
};

function densityBand(value) {
  if (value >= 100) return { level: 'extreme',  color: '#7f1d1d', label: 'Экстремальная' };
  if (value >= 50)  return { level: 'critical', color: '#dc2626', label: 'Критическая' };
  if (value >= 20)  return { level: 'high',     color: '#f97316', label: 'Высокая' };
  if (value >= 10)  return { level: 'medium',   color: '#eab308', label: 'Средняя' };
  if (value >= 5)   return { level: 'low',      color: '#84cc16', label: 'Низкая' };
  return                   { level: 'minor',   color: '#22c55e', label: 'Минимальная' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/focal-point-detection.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.points)) return data.data.points;
  if (data.data && Array.isArray(data.data.focalPoints)) return data.data.focalPoints;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.points)) return data.points;
  if (Array.isArray(data.items))  return data.items;
  if (Array.isArray(data.data))   return data.data;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || r.label || 'Focal point',
    density: Number(r.density ?? r.count ?? r.value ?? r.score ?? 0),
    sources: Array.isArray(r.sources) ? r.sources : (r.source ? [r.source] : []),
    eventTypes: Array.isArray(r.eventTypes) ? r.eventTypes : (r.types || []),
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    region: r.region || r.country || null,
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.min_density != null) { const n = parseFloat(query.min_density); if (Number.isFinite(n)) r = r.filter(x => x.density >= n); }
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const densities = rows.map(r => r.density);
  const byBand = {};
  for (const r of rows) { const b = densityBand(r.density).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice().sort((a, b) => b.density - a.density).slice(0, 5).map(r => ({ name: r.name, density: r.density }));
  return {
    count: rows.length,
    max_density: Math.max(...densities),
    avg_density: +(densities.reduce((a, b) => a + b, 0) / densities.length).toFixed(2),
    by_band: byBand,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = densityBand(r.density);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, density: r.density,
        sources: r.sources, eventTypes: r.eventTypes,
        severity: r.severity, region: r.region, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'detector', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'extreme',  label: 'Экстремальная (100+)', color: '#7f1d1d' },
      { level: 'critical', label: 'Критическая (50+)',    color: '#dc2626' },
      { level: 'high',     label: 'Высокая (20+)',        color: '#f97316' },
      { level: 'medium',   label: 'Средняя (10+)',        color: '#eab308' },
      { level: 'low',      label: 'Низкая (5+)',          color: '#84cc16' },
      { level: 'minor',    label: 'Минимальная (<5)',     color: '#22c55e' },
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
  const lines = ['id,name,density,severity,region,lat,lng'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.density},${r.severity},${r.region || ''},${r.lat},${r.lng}`);
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
    const extra = { 'X-Module': 'focal-point-detection-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
