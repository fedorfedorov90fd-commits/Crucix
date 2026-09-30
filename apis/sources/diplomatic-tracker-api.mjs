/**
 * apis/sources/diplomatic-tracker-api.mjs — API-МОДУЛЬ: ДИПЛОМАТИЧЕСКИЙ ТРЕКЕР
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/diplomatic-tracker.json — результат анализатора.
 * Анализатор: scripts/analyzers/diplomatic-tracker.mjs.
 *
 * Дипломатические события: визиты, соглашения, разрывы отношений, посольства.
 * Это артефакт анализатора, не сырые данные из корзины.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'diplomatic-tracker.json');

export const route  = '/api/layers/diplomatic-tracker';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '🤝',
  color: '#00cc88',
  vizType: 'marker',
  source: 'analytics/flow/diplomatic-tracker.json',
  collector: 'analyzer:diplomatic-tracker',
  cache: 300,
  description: 'Дипломатический трекер — визиты, соглашения, разрывы отношений',
  unit: 'events',
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
      err.hint = 'run scripts/analyzers/diplomatic-tracker.mjs'; throw err;
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
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.events)) return data.events;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || r.event_id || 'unknown',
    name: r.name || r.title || r.event || 'Unknown',
    description: r.description || r.summary || '',
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    from: r.from || r.source || null,
    to: r.to || r.target || null,
    type: r.type || 'diplomatic',
    date: r.date || r.timestamp || null,
    country: r.country || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.type) r = r.filter(x => x.type.toLowerCase() === String(query.type).toLowerCase());
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byType = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
  }
  return { count: rows.length, by_severity: bySeverity, by_type: byType };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, description: r.description, severity: r.severity,
      from: r.from, to: r.to, type: r.type, date: r.date, country: r.country,
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
    total_events: full.length, returned_events: filtered.length,
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
  const lines = ['id,name,type,severity,from,to,country,date'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.type},${r.severity},${r.from || ''},${r.to || ''},${r.country || ''},${r.date || ''}`);
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
    const extra = { 'X-Module': 'diplomatic-tracker-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
