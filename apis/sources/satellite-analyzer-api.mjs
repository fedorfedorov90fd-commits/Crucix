/**
 * apis/sources/satellite-analyzer-api.mjs — API-МОДУЛЬ: АНАЛИЗАТОР СПУТНИКОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/space/satellite-analyzer.json — { _meta:{stats}, data:{ top:[], items:[], summary? } }.
 * Анализатор: scripts/analyzers/satellite-analyzer.mjs.
 *
 * Спутниковый анализ: активность, покрытие, топ-объекты.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?country=, ?limit=, ?top=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'space', 'satellite-analyzer.json');

export const route  = '/api/layers/satellite-analyzer';
export const method = 'GET';

export const meta = {
  category: 'space',
  icon: '🛰️',
  color: '#0ea5e9',
  vizType: 'marker',
  source: 'analytics/space/satellite-analyzer.json',
  collector: 'scripts/analyzers/satellite-analyzer.mjs',
  cache: 120,
  description: 'Спутниковый анализ: активность, покрытие, топ-объекты',
  unit: 'satellites',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/satellite-analyzer.mjs'; throw err;
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
  const arr = Array.isArray(d.top) ? d.top : (Array.isArray(d.items) ? d.items : []);
  return arr.map((it, i) => {
    const lat = Number(it.lat ?? it.latitude);
    const lng = Number(it.lng ?? it.lon ?? it.longitude);
    return {
      id: it.id || it.noradId || it.catalogNumber || `sat-${i}`,
      name: it.name || it.label || `Satellite ${i}`,
      type: it.type || it.category || null,
      country: it.country || it.operator || null,
      value: it.value != null ? Number(it.value) : (it.score != null ? Number(it.score) : null),
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
    };
  });
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.q)       r = r.filter(x => (x.name + ' ' + (x.id || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.type)    r = r.filter(x => String(x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.country) r = r.filter(x => String(x.country || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.top)     { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit)   { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const byType = {};
  const byCountry = {};
  for (const r of rows) {
    if (r.type) byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  return {
    count: rows.length,
    by_type: byType,
    by_country: byCountry,
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
      properties: { id: r.id, name: r.name, type: r.type, country: r.country, value: r.value,
        category: meta.category, icon: meta.icon, color: meta.color },
    }));
  return { type: 'FeatureCollection', features, meta: { total: rows.length, mapped: features.length } };
}

function toSeries(rows) { return rows.map(r => ({ id: r.id, name: r.name, type: r.type, country: r.country, value: r.value })); }

function toCSV(rows) {
  const lines = ['id,name,type,country,value,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.type, r.country, r.value, r.lat, r.lng].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/satellite-analyzer/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractItems(doc);
    const extra = {
      'X-Module': 'satellite-analyzer-api',
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
