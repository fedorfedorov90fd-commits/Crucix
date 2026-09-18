/**
 * apis/sources/country-instability-api.mjs — API-МОДУЛЬ: CII
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/index/country-instability.json — результат анализатора CII.
 * Анализатор: scripts/analyzers/country-instability.mjs.
 *
 * Country Instability Index — эталон внедрения анализатора. 5 статусов нестабильности.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'index', 'country-instability.json');

export const route  = '/api/layers/country-instability';
export const method = 'GET';

export const meta = {
  category: 'index',
  icon: '🎯',
  color: '#ef4444',
  vizType: 'choropleth',
  source: 'analytics/index/country-instability.json',
  collector: 'analyzer:country-instability',
  cache: 600,
  description: 'Индекс нестабильности стран (CII) — 5 уровней',
  unit: 'index',
};

const STATUS_DEFS = {
  'CRITICAL': { rank: 5, color: '#7f1d1d', label: 'Критический' },
  'PRE-WAR':  { rank: 4, color: '#dc2626', label: 'Предвоенный' },
  'HIGH':     { rank: 3, color: '#f97316', label: 'Высокий' },
  'MEDIUM':   { rank: 2, color: '#eab308', label: 'Средний' },
  'NORMAL':   { rank: 1, color: '#22c55e', label: 'Норма' },
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/country-instability.mjs'; throw err;
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
  if (data.data && Array.isArray(data.data.countries)) return data.data.countries;
  if (Array.isArray(data.countries)) return data.countries;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  const status = String(r.status || r.cii_status || r.severity || 'MEDIUM').toUpperCase();
  return {
    id: r.id || r.iso || r.code || 'unknown',
    name: r.name || r.country || 'Unknown',
    iso: r.iso || r.code || null,
    status: STATUS_DEFS[status] ? status : 'MEDIUM',
    score: Number(r.score ?? r.cii ?? r.value ?? r.index ?? 0),
    region: r.region || null,
    population: r.population != null ? Number(r.population) : null,
    capital: r.capital || null,
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.status) { const s = String(query.status).toUpperCase(); r = r.filter(x => x.status === s); }
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.iso) r = r.filter(x => (x.iso || '').toUpperCase() === String(query.iso).toUpperCase());
  if (query.min_score != null) { const n = parseFloat(query.min_score); if (Number.isFinite(n)) r = r.filter(x => x.score >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byStatus = {}, byRegion = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  }
  const critical = rows.filter(x => x.status === 'CRITICAL' || x.status === 'PRE-WAR').map(x => x.name);
  const high = rows.filter(x => x.status === 'HIGH').map(x => x.name);
  return { count: rows.length, by_status: byStatus, by_region: byRegion, critical_countries: critical, high_risk_countries: high };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const s = STATUS_DEFS[r.status];
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, iso: r.iso, status: r.status,
        statusLabel: s.label, rank: s.rank, score: r.score,
        region: r.region, population: r.population, capital: r.capital, date: r.date,
        color: s.color,
        category: 'index', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    statuses: Object.entries(STATUS_DEFS).map(([k, v]) => ({ status: k, ...v })),
    features,
  };
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
  const lines = ['iso,name,status,rank,score,region'];
  for (const r of rows) { const s = STATUS_DEFS[r.status]; lines.push(`${r.iso || ''},"${r.name.replace(/"/g, '""')}",${r.status},${s.rank},${r.score},${r.region || ''}`); }
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
    const extra = { 'X-Module': 'country-instability-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      statuses: fc.statuses,
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
