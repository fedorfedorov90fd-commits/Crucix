/**
 * apis/sources/arms-transfer-tracker-api.mjs — API-МОДУЛЬ: ТРЕКЕР ПОСТАВОК ОРУЖИЯ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/arms-transfer-tracker.json — результат анализатора.
 * Анализатор: scripts/analyzers/arms-transfer-tracker.mjs.
 *
 * Поставки вооружений между странами: экспортёр → импортёр, тип вооружения, объём.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'arms-transfer-tracker.json');

export const route  = '/api/layers/arms-transfer-tracker';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '⚔️',
  color: '#dc2626',
  vizType: 'marker',
  source: 'analytics/flow/arms-transfer-tracker.json',
  collector: 'analyzer:arms-transfer-tracker',
  cache: 300,
  description: 'Трекер поставок оружия между странами',
  unit: 'transfers',
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
      err.hint = 'run scripts/analyzers/arms-transfer-tracker.mjs'; throw err;
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
  if (Array.isArray(data.transfers)) return data.transfers;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || r.title || `${r.exporter || r.from || '?'} → ${r.importer || r.to || '?'}`,
    exporter: r.exporter || r.from || r.source || null,
    importer: r.importer || r.to || r.target || null,
    weaponType: r.weaponType || r.type || r.category || null,
    volume: r.volume != null ? Number(r.volume) : null,
    unit: r.unit || null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
    value: r.value != null ? Number(r.value) : null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.exporter) { const e = String(query.exporter).toLowerCase(); r = r.filter(x => (x.exporter || '').toLowerCase().includes(e)); }
  if (query.importer) { const i = String(query.importer).toLowerCase(); r = r.filter(x => (x.importer || '').toLowerCase().includes(i)); }
  if (query.weapon)   { const w = String(query.weapon).toLowerCase(); r = r.filter(x => (x.weaponType || '').toLowerCase().includes(w)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byExporter = {}, byImporter = {}, byWeapon = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.exporter) byExporter[r.exporter] = (byExporter[r.exporter] || 0) + 1;
    if (r.importer) byImporter[r.importer] = (byImporter[r.importer] || 0) + 1;
    if (r.weaponType) byWeapon[r.weaponType] = (byWeapon[r.weaponType] || 0) + 1;
  }
  const top_exporters = Object.entries(byExporter).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_importers = Object.entries(byImporter).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_weapons = Object.entries(byWeapon).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, by_severity: bySeverity, top_exporters, top_importers, top_weapons };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name,
      exporter: r.exporter, importer: r.importer,
      weaponType: r.weaponType, volume: r.volume, unit: r.unit,
      severity: r.severity, date: r.date, value: r.value,
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
    total_transfers: full.length, returned_transfers: filtered.length,
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
  const lines = ['id,exporter,importer,weaponType,volume,unit,severity,date'];
  for (const r of rows) lines.push(`${r.id},${r.exporter || ''},${r.importer || ''},${r.weaponType || ''},${r.volume ?? ''},${r.unit || ''},${r.severity},${r.date || ''}`);
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
    const extra = { 'X-Module': 'arms-transfer-tracker-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
