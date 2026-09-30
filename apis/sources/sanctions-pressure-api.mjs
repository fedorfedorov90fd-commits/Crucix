/**
 * apis/sources/sanctions-pressure-api.mjs — API-МОДУЛЬ: САНКЦИОННОЕ ДАВЛЕНИЕ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/sanctions-pressure.json — результат анализатора.
 * Анализатор: scripts/analyzers/sanctions-pressure.mjs.
 *
 * Санкционное давление на страны: количество программ, объекты, интенсивность.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'sanctions-pressure.json');

export const route  = '/api/layers/sanctions-pressure';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '⚠️',
  color: '#a21caf',
  vizType: 'marker',
  source: 'analytics/specialist/sanctions-pressure.json',
  collector: 'analyzer:sanctions-pressure',
  cache: 300,
  description: 'Санкционное давление на страны (количество программ, объекты, интенсивность)',
  unit: 'sanctions',
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
      err.hint = 'run scripts/analyzers/sanctions-pressure.mjs'; throw err;
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
  if (data.data && Array.isArray(data.data.entities)) return data.data.entities;
  if (data.data && Array.isArray(data.data.countries)) return data.data.countries;
  if (data.data && Array.isArray(data.data.chains)) return data.data.chains;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || r.iso || 'unknown',
    name: r.name || r.country || r.entity || 'Unknown',
    iso: r.iso || r.code || null,
    pressure: Number(r.pressure ?? r.value ?? r.index ?? 0),
    programs: Number(r.programs ?? r.programCount ?? 0),
    entities: Number(r.entities ?? r.entityCount ?? 0),
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
    description: r.description || r.summary || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.min_pressure != null) { const n = parseFloat(query.min_pressure); if (Number.isFinite(n)) r = r.filter(x => x.pressure >= n); }
  if (query.iso) r = r.filter(x => (x.iso || '').toLowerCase() === String(query.iso).toLowerCase());
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const withPressure = rows.filter(r => r.pressure > 0);
  const bySeverity = {};
  for (const r of rows) bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  const top5 = rows.slice().sort((a, b) => b.pressure - a.pressure).slice(0, 5).map(r => ({ name: r.name, iso: r.iso, pressure: r.pressure }));
  return {
    count: rows.length,
    max_pressure: withPressure.length > 0 ? Math.max(...withPressure.map(r => r.pressure)) : 0,
    total_entities: rows.reduce((a, b) => a + (b.entities || 0), 0),
    by_severity: bySeverity,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, iso: r.iso,
      pressure: r.pressure, programs: r.programs, entities: r.entities,
      severity: r.severity, description: r.description, date: r.date,
      color: severityColor(r.severity),
      category: 'specialist', icon: meta.icon,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_countries: full.length, returned_countries: filtered.length,
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
  const lines = ['iso,name,pressure,programs,entities,severity'];
  for (const r of rows) lines.push(`${r.iso || ''},"${r.name.replace(/"/g, '""')}",${r.pressure},${r.programs},${r.entities},${r.severity}`);
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
    const extra = { 'X-Module': 'sanctions-pressure-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
