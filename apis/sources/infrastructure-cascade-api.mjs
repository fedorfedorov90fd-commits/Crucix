/**
 * apis/sources/infrastructure-cascade-api.mjs — API-МОДУЛЬ: КАСКАД ИНФРАСТРУКТУРЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/infrastructure-cascade.json.
 * Анализатор: scripts/analyzers/infrastructure-cascade.mjs.
 *
 * Каскадное распространение сбоев по инфраструктурным узлам.
 * Топологическая сортировка, PageRank, Monte Carlo.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'infrastructure-cascade.json');

export const route  = '/api/layers/infrastructure-cascade';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🏗️',
  color: '#ff6600',
  vizType: 'marker',
  source: 'analytics/specialist/infrastructure-cascade.json',
  collector: 'analyzer:infrastructure-cascade',
  cache: 600,
  description: 'Каскадное распространение сбоев по инфраструктурным узлам',
  unit: 'nodes',
};

function cascadeBand(value) {
  if (value >= 80) return { level: 'critical',  color: '#7f1d1d', label: 'Критический' };
  if (value >= 60) return { level: 'high',      color: '#dc2626', label: 'Высокий' };
  if (value >= 40) return { level: 'elevated',  color: '#f97316', label: 'Повышенный' };
  if (value >= 20) return { level: 'moderate',  color: '#eab308', label: 'Средний' };
  return                 { level: 'low',       color: '#22c55e', label: 'Низкий' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/infrastructure-cascade.mjs'; throw err;
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
  if (data.data && Array.isArray(data.data.nodes)) return data.data.nodes;
  if (Array.isArray(data.nodes)) return data.nodes;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || r.node_id || 'unknown',
    name: r.name || r.label || 'Unknown',
    type: r.type || r.category || 'unknown',
    cascadeRisk: Number(r.cascadeRisk ?? r.risk ?? r.value ?? r.score ?? 0),
    pagerank: Number(r.pagerank ?? r.pr ?? 0),
    connections: Number(r.connections ?? r.degree ?? 0),
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    country: r.country || null,
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type) r = r.filter(x => x.type.toLowerCase() === String(query.type).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.min_risk != null) { const n = parseFloat(query.min_risk); if (Number.isFinite(n)) r = r.filter(x => x.cascadeRisk >= n); }
  if (query.min_connections != null) { const n = parseInt(query.min_connections, 10); if (Number.isFinite(n)) r = r.filter(x => x.connections >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const risks = rows.map(r => r.cascadeRisk);
  const byType = {}, bySeverity = {}, byBand = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    const b = cascadeBand(r.cascadeRisk).level;
    byBand[b] = (byBand[b] || 0) + 1;
  }
  const top5 = rows.slice().sort((a, b) => b.cascadeRisk - a.cascadeRisk).slice(0, 5).map(r => ({ name: r.name, risk: r.cascadeRisk }));
  return {
    count: rows.length,
    max_risk: Math.max(...risks),
    avg_risk: +(risks.reduce((a, b) => a + b, 0) / risks.length).toFixed(2),
    max_connections: Math.max(...rows.map(r => r.connections)),
    by_type: byType,
    by_severity: bySeverity,
    by_band: byBand,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = cascadeBand(r.cascadeRisk);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, type: r.type,
        cascadeRisk: r.cascadeRisk, pagerank: r.pagerank, connections: r.connections,
        severity: r.severity, country: r.country, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'specialist', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'critical', label: 'Критический (80+)', color: '#7f1d1d' },
      { level: 'high',     label: 'Высокий (60+)',     color: '#dc2626' },
      { level: 'elevated', label: 'Повышенный (40+)',  color: '#f97316' },
      { level: 'moderate', label: 'Средний (20+)',     color: '#eab308' },
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
    total_nodes: full.length, returned_nodes: filtered.length,
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
  const lines = ['id,name,type,cascadeRisk,pagerank,connections,severity'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.type},${r.cascadeRisk},${r.pagerank},${r.connections},${r.severity}`);
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
    const extra = { 'X-Module': 'infrastructure-cascade-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
