/**
 * apis/sources/signal-aggregator-api.mjs — API-МОДУЛЬ: АГРЕГАТОР СИГНАЛОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/signal-aggregator.json.
 * Анализатор: scripts/analyzers/signal-aggregator.mjs.
 *
 * Агрегатор сигналов из разных источников. Собирает важные события в единый поток.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'signal-aggregator.json');

export const route  = '/api/layers/signal-aggregator';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '📡',
  color: '#00aaff',
  vizType: 'marker',
  source: 'analytics/flow/signal-aggregator.json',
  collector: 'analyzer:signal-aggregator',
  cache: 300,
  description: 'Агрегатор сигналов — важные события в едином потоке',
  unit: 'signals',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/signal-aggregator.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && Array.isArray(data.data.signals)) return data.data.signals;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.signals)) return data.signals;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || r.title || 'Unknown',
    description: r.description || r.summary || '',
    source: r.source || null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    category: r.category || r.type || null,
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    country: r.country || null,
    date: r.date || r.timestamp || null,
    value: r.value != null ? Number(r.value) : null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.category) { const c = String(query.category).toLowerCase(); r = r.filter(x => (x.category || '').toLowerCase().includes(c)); }
  if (query.source) { const s = String(query.source).toLowerCase(); r = r.filter(x => (x.source || '').toLowerCase().includes(s)); }
  if (query.since) r = r.filter(x => (x.date || '') >= String(query.since));
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q) || x.description.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byCategory = {}, bySource = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.category) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
    if (r.source) bySource[r.source] = (bySource[r.source] || 0) + 1;
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const top_sources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    date_from: dates[0] || null, date_to: dates[dates.length - 1] || null,
    by_severity: bySeverity,
    by_category: byCategory,
    top_sources,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, description: r.description, source: r.source,
      severity: r.severity, category: r.category, country: r.country, date: r.date, value: r.value,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.info,
      category_layer: 'flow', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: Object.entries(SEVERITY_COLOR).map(([severity, color]) => ({ severity, color })),
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_signals: full.length, returned_signals: filtered.length,
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
  const lines = ['id,name,category,source,severity,country,date'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.category || ''},${r.source || ''},${r.severity},${r.country || ''},${r.date || ''}`);
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
    const extra = { 'X-Module': 'signal-aggregator-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      legend: fc.legend,
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
