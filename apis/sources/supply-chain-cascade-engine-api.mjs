/**
 * apis/sources/supply-chain-cascade-engine-api.mjs — API-МОДУЛЬ: ДВИЖОК КАСКАДОВ ЦЕПОЧЕК ПОСТАВОК
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/supply-chain-cascade-engine.json — { _meta:{stats}, data:{ top:[], items:[], chains? } }.
 * Анализатор: scripts/analyzers/supply-chain-cascade-engine.mjs.
 *
 * Каскадные эффекты в цепочках поставок: топ, зависимости, цепочки.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?min_value=, ?limit=, ?top=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'supply-chain-cascade-engine.json');

export const route  = '/api/layers/supply-chain-cascade-engine';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '🔗',
  color: '#7c3aed',
  vizType: 'marker',
  source: 'analytics/flow/supply-chain-cascade-engine.json',
  collector: 'scripts/analyzers/supply-chain-cascade-engine.mjs',
  cache: 120,
  description: 'Каскадные эффекты в цепочках поставок: топ, зависимости',
  unit: 'cascades',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/supply-chain-cascade-engine.mjs'; throw err;
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
  const arr = Array.isArray(d.top) ? d.top : (Array.isArray(d.items) ? d.items : (Array.isArray(d.chains) ? d.chains : []));
  return arr.map((it, i) => {
    const lat = Number(it.lat ?? it.latitude);
    const lng = Number(it.lng ?? it.lon ?? it.longitude);
    return {
      id: it.id || it.code || it.key || `cascade-${i}`,
      name: it.name || it.label || it.title || `Cascade ${i}`,
      type: it.type || it.kind || null,
      value: it.value != null ? Number(it.value) : (it.score != null ? Number(it.score) : null),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  });
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.q)     r = r.filter(x => (x.name + ' ' + (x.id || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.type)  r = r.filter(x => String(x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.min_value != null) {
    const n = Number(query.min_value);
    if (Number.isFinite(n)) r = r.filter(x => x.value != null && x.value >= n);
  }
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  const byType = {};
  for (const r of rows) if (r.type) byType[r.type] = (byType[r.type] || 0) + 1;
  return {
    count: rows.length,
    by_type: byType,
    max_value: values.length ? Math.max(...values) : null,
    min_value: values.length ? Math.min(...values) : null,
    mean_value: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null,
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
      properties: { id: r.id, name: r.name, type: r.type, value: r.value,
        category: meta.category, icon: meta.icon, color: meta.color },
    }));
  return { type: 'FeatureCollection', features, meta: { total: rows.length, mapped: features.length } };
}

function toSeries(rows) { return rows.map(r => ({ id: r.id, name: r.name, type: r.type, value: r.value })); }

function toCSV(rows) {
  const lines = ['id,name,type,value,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.type, r.value, r.lat, r.lng].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/supply-chain-cascade-engine/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractItems(doc);
    const extra = {
      'X-Module': 'supply-chain-cascade-engine-api',
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
