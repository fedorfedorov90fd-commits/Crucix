/**
 * apis/sources/supply-chain-resilience-api.mjs — API-МОДУЛЬ: УСТОЙЧИВОСТЬ ЦЕПОЧЕК ПОСТАВОК
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/supply-chain-resilience.json — { _meta:{stats}, data:{ top:[], entities:[], chains:[] } }.
 * Анализатор: scripts/analyzers/supply-chain-resilience.mjs.
 *
 * Устойчивость цепочек поставок: индексы, топ-страны/регионы, слабые места.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?region=, ?min_score=, ?limit=, ?top=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'supply-chain-resilience.json');

export const route  = '/api/layers/supply-chain-resilience';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '🛡️',
  color: '#059669',
  vizType: 'marker',
  source: 'analytics/flow/supply-chain-resilience.json',
  collector: 'scripts/analyzers/supply-chain-resilience.mjs',
  cache: 120,
  description: 'Устойчивость цепочек поставок: индексы, топ-регионы, слабые места',
  unit: 'index',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/supply-chain-resilience.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function extractItems(doc) {
  const d = doc.data || {};
  const arr = Array.isArray(d.top) ? d.top
    : Array.isArray(d.entities) ? d.entities
    : Array.isArray(d.chains) ? d.chains
    : Array.isArray(d.items) ? d.items : [];
  return arr.map((it, i) => {
    const lat = Number(it.lat ?? it.latitude);
    const lng = Number(it.lng ?? it.lon ?? it.longitude);
    return {
      id: it.id || it.code || it.key || `res-${i}`,
      name: it.name || it.label || it.title || it.code || `Item ${i}`,
      region: it.region || it.country || null,
      score: Number(it.score ?? it.value ?? it.resilience ?? 0),
      risk: it.risk != null ? Number(it.risk) : null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  });
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.q)      r = r.filter(x => (x.name + ' ' + (x.id || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.region) r = r.filter(x => String(x.region || '').toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.min_score != null) {
    const n = Number(query.min_score);
    if (Number.isFinite(n)) r = r.filter(x => x.score >= n);
  }
  if (query.top)    { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit)  { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const values = rows.map(r => r.score).filter(Number.isFinite);
  const byRegion = {};
  for (const r of rows) if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length === 0 ? null
    : sorted.length % 2 === 0 ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  return {
    count: rows.length,
    mean: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null,
    median: median != null ? Number(median.toFixed(2)) : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    by_region: byRegion,
    meta: doc._meta?.stats || null,
    generated_at: doc._meta?.updated_at || null,
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: { id: r.id, name: r.name, region: r.region, score: r.score, risk: r.risk,
        category: meta.category, icon: meta.icon, color: meta.color },
    }));
  return { type: 'FeatureCollection', features, meta: { total: rows.length, mapped: features.length } };
}

function toSeries(rows) { return rows.map(r => ({ id: r.id, name: r.name, region: r.region, score: r.score, risk: r.risk })); }

function toCSV(rows) {
  const lines = ['id,name,region,score,risk,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.region, r.score, r.risk, r.lat, r.lng].map(esc).join(','));
  return lines.join('\n') + '\n';
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

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/supply-chain-resilience/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractItems(doc);
    const extra = {
      'X-Module': 'supply-chain-resilience-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/top') {
      const n = parseInt(query.n, 10) || parseInt(query.top, 10) || 10;
      return sendJSON(res, 200, { top: all.slice(0, n), total: all.length, n }, extra);
    }
    if (sub === '/regions') {
      const byRegion = {};
      for (const e of all) if (e.region) (byRegion[e.region] = byRegion[e.region] || []).push(e);
      return sendJSON(res, 200, { regions: byRegion, total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/featurecollection') return sendJSON(res, 200, toFeatureCollection(all), extra);

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_items: all.length, returned_items: rows.length,
        generated_at: new Date().toISOString(), source_updated_at: doc._meta?.updated_at || null,
      },
      features: fc.features,
      top: rows.slice(0, 10),
      series: toSeries(rows),
      stats: computeStats(rows, doc),
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
