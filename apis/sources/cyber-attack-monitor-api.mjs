/**
 * apis/sources/cyber-attack-monitor-api.mjs — API-МОДУЛЬ: МОНИТОР КИБЕРАТАК
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/detector/cyber-attack-monitor.json.
 * Анализатор: scripts/analyzers/cyber-attack-monitor.mjs.
 *
 * Детектор кибератак из basket/cyber-attacks.json. Группирует и оценивает по регионам.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'detector', 'cyber-attack-monitor.json');

export const route  = '/api/layers/cyber-attack-monitor';
export const method = 'GET';

export const meta = {
  category: 'detector',
  icon: '💻',
  color: '#ff2200',
  vizType: 'marker',
  source: 'analytics/detector/cyber-attack-monitor.json',
  collector: 'analyzer:cyber-attack-monitor',
  cache: 300,
  description: 'Монитор кибератак — детектор и группировка по регионам',
  unit: 'attacks',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/cyber-attack-monitor.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.attacks)) return data.data.attacks;
  if (data.data && Array.isArray(data.data.items))   return data.data.items;
  if (data.data && Array.isArray(data.data.results)) return data.data.results;
  if (Array.isArray(data.attacks)) return data.attacks;
  if (Array.isArray(data.items))   return data.items;
  if (Array.isArray(data.data))    return data.data;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || r.type || 'Cyber attack',
    type: r.type || r.category || null,
    severity: String(r.severity ?? r.level ?? 'info').toLowerCase(),
    region: r.region || r.country || null,
    target: r.target || null,
    source: r.source || null,
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
    count: r.count != null ? Number(r.count) : null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.type) r = r.filter(x => (x.type || '').toLowerCase() === String(query.type).toLowerCase());
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.since) r = r.filter(x => (x.date || '') >= String(query.since));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byType = {}, byRegion = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.type) byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  }
  const top_regions = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, by_severity: bySeverity, by_type: byType, top_regions };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, type: r.type, severity: r.severity,
      region: r.region, target: r.target, source: r.source, date: r.date, count: r.count,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.info,
      category: 'detector', icon: meta.icon,
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
    total_attacks: full.length, returned_attacks: filtered.length,
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
  const lines = ['id,name,type,severity,region,target,date'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.type || ''},${r.severity},${r.region || ''},${r.target || ''},${r.date || ''}`);
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
    const extra = { 'X-Module': 'cyber-attack-monitor-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
