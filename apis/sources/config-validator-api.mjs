/**
 * apis/sources/config-validator-api.mjs — API-МОДУЛЬ: ВАЛИДАТОР КОНФИГУРАЦИИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/config-validator.json.
 * Анализатор: scripts/analyzers/config-validator.mjs.
 *
 * Валидатор конфигурации проекта: проверяет целостность и корректность конфигов.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'config-validator.json');

export const route  = '/api/layers/config-validator';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '✅',
  color: '#00aaff',
  vizType: 'marker',
  source: 'analytics/specialist/config-validator.json',
  collector: 'analyzer:config-validator',
  cache: 60,
  description: 'Валидатор конфигурации проекта',
  unit: 'checks',
};

function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'ok' || s === 'valid' || s === 'pass') return '#22c55e';
  if (s === 'warning' || s === 'warn') return '#eab308';
  if (s === 'error' || s === 'invalid' || s === 'fail') return '#dc2626';
  return '#64748b';
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/config-validator.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.checks)) return data.data.checks;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.results)) return data.data.results;
  if (Array.isArray(data.checks)) return data.checks;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || r.check || r.name || 'unknown',
    name: r.name || r.check || 'Check',
    status: String(r.status ?? r.result ?? 'info').toLowerCase(),
    message: r.message || r.description || null,
    category: r.category || null,
    file: r.file || r.path || null,
    severity: String(r.severity || 'info').toLowerCase(),
    lat: Number(r.lat ?? 0),
    lng: Number(r.lng ?? r.lon ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.status) r = r.filter(x => x.status === String(query.status).toLowerCase());
  if (query.category) { const c = String(query.category).toLowerCase(); r = r.filter(x => (x.category || '').toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q) || (x.message || '').toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byStatus = {}, byCategory = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.category) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  return { count: rows.length, by_status: byStatus, by_category: byCategory };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, status: r.status, message: r.message,
      category: r.category, file: r.file, severity: r.severity, date: r.date,
      color: statusColor(r.status),
      category_layer: 'specialist', icon: meta.icon,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_checks: full.length, returned_checks: filtered.length,
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
  const lines = ['id,name,status,category,file,message'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.status},${r.category || ''},${r.file || ''},"${(r.message || '').replace(/"/g, '""')}"`);
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
    const extra = { 'X-Module': 'config-validator-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
