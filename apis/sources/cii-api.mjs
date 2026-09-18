/**
 * apis/sources/cii-api.mjs — API-МОДУЛЬ: COUNTRY INSTABILITY INDEX (CII)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/cii.json — массив стран со свойствами статуса нестабильности.
 * Сборщик: scripts/collectors/collect-instability-index.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?status=CRITICAL|PRE-WAR|HIGH|MEDIUM|NORMAL, ?region=, ?limit=, ?sort=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'cii.json');

export const route  = '/api/layers/cii';
export const method = 'GET';

export const meta = {
  category: 'geopolitical',
  icon: '🎯',
  color: '#ef4444',
  vizType: 'choropleth',
  source: 'basket/cii.json',
  collector: 'collect-instability-index.mjs',
  cache: 600,
  description: 'Индекс нестабильности стран (CII) — 5 уровней',
  unit: 'index',
};

// Статусы CII
const STATUS_DEFS = {
  CRITICAL:  { rank: 5, color: '#7f1d1d', label: 'Критический' },
  'PRE-WAR': { rank: 4, color: '#dc2626', label: 'Предвоенный' },
  HIGH:      { rank: 3, color: '#f97316', label: 'Высокий' },
  MEDIUM:    { rank: 2, color: '#eab308', label: 'Средний' },
  NORMAL:    { rank: 1, color: '#22c55e', label: 'Норма' },
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-instability-index.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.countries)) arr = parsed.countries;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const p = r.properties || {};
      const status = String(p.status || p.cii_status || 'UNKNOWN').toUpperCase();
      return {
        name: p.name || p.country || 'Unknown',
        iso: p.iso || p.code || null,
        status: STATUS_DEFS[status] ? status : 'MEDIUM',
        score: Number(p.score ?? p.cii ?? p.value) || null,
        region: p.region || null,
        capital: p.capital || null,
        population: p.population || null,
        geometry: r.geometry,
      };
    }
    const status = String(r.status || r.cii_status || 'UNKNOWN').toUpperCase();
    return {
      name: r.name || r.country, iso: r.iso || r.code || null,
      status: STATUS_DEFS[status] ? status : 'MEDIUM',
      score: Number(r.score ?? r.cii ?? r.value) || null,
      region: r.region || null, capital: r.capital || null, population: r.population || null,
    };
  }).filter(r => r.name);

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.status) { const s = String(query.status).toUpperCase(); r = r.filter(x => x.status === s); }
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.iso)    { const c = String(query.iso).toUpperCase(); r = r.filter(x => (x.iso || '').toUpperCase() === c); }

  if (query.sort === 'desc') r.sort((a, b) => (STATUS_DEFS[b.status]?.rank || 0) - (STATUS_DEFS[a.status]?.rank || 0));
  else if (query.sort === 'asc') r.sort((a, b) => (STATUS_DEFS[a.status]?.rank || 0) - (STATUS_DEFS[b.status]?.rank || 0));
  else r.sort((a, b) => (STATUS_DEFS[b.status]?.rank || 0) - (STATUS_DEFS[a.status]?.rank || 0));

  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byStatus = {};
  for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  const byRegion = {};
  for (const r of rows) { const g = r.region || 'Unknown'; byRegion[g] = (byRegion[g] || 0) + 1; }

  const critical = rows.filter(x => x.status === 'CRITICAL' || x.status === 'PRE-WAR').map(x => x.name);
  const high = rows.filter(x => x.status === 'HIGH').map(x => x.name);

  return {
    count: rows.length,
    by_status: byStatus,
    by_region: byRegion,
    critical_countries: critical,
    high_risk_countries: high,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const sdef = STATUS_DEFS[r.status] || STATUS_DEFS.MEDIUM;
    return {
      type: 'Feature',
      geometry: r.geometry || { type: 'Point', coordinates: [0, 0] },
      properties: {
        name: r.name,
        iso: r.iso,
        status: r.status,
        statusLabel: sdef.label,
        rank: sdef.rank,
        color: sdef.color,
        score: r.score,
        region: r.region,
        capital: r.capital,
        population: r.population,
        category: 'geopolitical',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    statuses: Object.entries(STATUS_DEFS).map(([k, v]) => ({ status: k, ...v })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_countries: full.length, returned_countries: filtered.length,
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
  const lines = ['name,iso,status,rank,score,region'];
  for (const r of rows) { const s = STATUS_DEFS[r.status] || STATUS_DEFS.MEDIUM; lines.push(`${r.name},${r.iso || ''},${r.status},${s.rank},${r.score ?? ''},${r.region || ''}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadData();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'cii-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      statuses: fc.statuses,
      features: fc.features,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
