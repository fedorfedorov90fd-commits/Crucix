/**
 * apis/sources/migration-flow-tracker-api.mjs — API-МОДУЛЬ: ТРЕКЕР МИГРАЦИИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/migration-flow-tracker.json — результат анализатора.
 * Анализатор: scripts/analyzers/migration-flow-tracker.mjs.
 *
 * Миграционные потоки между странами. Источник данных — UNHCR, IOM.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'migration-flow-tracker.json');

export const route  = '/api/layers/migration-flow-tracker';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '🚶',
  color: '#ff8844',
  vizType: 'marker',
  source: 'analytics/flow/migration-flow-tracker.json',
  collector: 'analyzer:migration-flow-tracker',
  cache: 300,
  description: 'Миграционные потоки между странами (UNHCR, IOM)',
  unit: 'migrations',
};

function severityColor(s) {
  const m = { 'critical': '#7f1d1d', 'high': '#dc2626', 'medium': '#f97316', 'low': '#eab308', 'info': '#22c55e' };
  return m[String(s || 'info').toLowerCase()] || m.info;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/migration-flow-tracker.mjs'; throw err;
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
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.top))   return data.data.top;
  if (Array.isArray(data.flows)) return data.flows;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || r.title || `${r.from || r.origin || '?'} → ${r.to || r.destination || '?'}`,
    from: r.from || r.origin || r.source || null,
    to: r.to || r.destination || r.target || null,
    count: r.count != null ? Number(r.count) : (r.value != null ? Number(r.value) : null),
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
    reason: r.reason || r.cause || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.from) { const f = String(query.from).toLowerCase(); r = r.filter(x => (x.from || '').toLowerCase().includes(f)); }
  if (query.to)   { const t = String(query.to).toLowerCase();   r = r.filter(x => (x.to || '').toLowerCase().includes(t)); }
  if (query.min_count != null) { const n = parseFloat(query.min_count); if (Number.isFinite(n)) r = r.filter(x => (x.count || 0) >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byFrom = {}, byTo = {};
  let totalCount = 0;
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.from) byFrom[r.from] = (byFrom[r.from] || 0) + (r.count || 0);
    if (r.to)   byTo[r.to]     = (byTo[r.to] || 0) + (r.count || 0);
    totalCount += (r.count || 0);
  }
  const top_origins = Object.entries(byFrom).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, sum]) => ({ name, sum }));
  const top_destinations = Object.entries(byTo).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, sum]) => ({ name, sum }));
  return { count: rows.length, total_migrants: totalCount, by_severity: bySeverity, top_origins, top_destinations };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name,
      from: r.from, to: r.to, count: r.count, severity: r.severity, reason: r.reason, date: r.date,
      color: severityColor(r.severity),
      category: 'flow', icon: meta.icon,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_flows: full.length, returned_flows: filtered.length,
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
  const lines = ['id,from,to,count,severity,reason,date'];
  for (const r of rows) lines.push(`${r.id},"${(r.from || '').replace(/"/g, '""')}","${(r.to || '').replace(/"/g, '""')}",${r.count ?? ''},${r.severity},${r.reason || ''},${r.date || ''}`);
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
    const extra = { 'X-Module': 'migration-flow-tracker-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
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
