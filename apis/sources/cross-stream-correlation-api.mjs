/**
 * apis/sources/cross-stream-correlation-api.mjs — API-МОДУЛЬ: КРОСС-КОРРЕЛЯЦИЯ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/cross-stream-correlation.json.
 * Анализатор: scripts/analyzers/cross-stream-correlation.mjs.
 *
 * Кросс-корреляция между разными потоками данных: новости ↔ экономика ↔ военные.
 * Выявление скрытых связей между событиями в разных доменах.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'cross-stream-correlation.json');

export const route  = '/api/layers/cross-stream-correlation';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '🔗',
  color: '#ff88cc',
  vizType: 'marker',
  source: 'analytics/flow/cross-stream-correlation.json',
  collector: 'analyzer:cross-stream-correlation',
  cache: 600,
  description: 'Кросс-корреляция между разными потоками данных',
  unit: 'correlations',
};

function correlationBand(value) {
  const abs = Math.abs(value);
  if (abs >= 0.8) return { level: 'very_strong', color: '#7f1d1d', label: 'Очень сильная' };
  if (abs >= 0.6) return { level: 'strong',      color: '#dc2626', label: 'Сильная' };
  if (abs >= 0.4) return { level: 'moderate',    color: '#f97316', label: 'Умеренная' };
  if (abs >= 0.2) return { level: 'weak',        color: '#eab308', label: 'Слабая' };
  return                 { level: 'very_weak',  color: '#22c55e', label: 'Очень слабая' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/cross-stream-correlation.mjs'; throw err;
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
  if (data.data && Array.isArray(data.data.correlations)) return data.data.correlations;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.correlations)) return data.correlations;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || `${r.streamA || '?'} ↔ ${r.streamB || '?'}`,
    streamA: r.streamA || r.source || null,
    streamB: r.streamB || r.target || null,
    correlation: Number(r.correlation ?? r.value ?? r.score ?? 0),
    pValue: r.pValue != null ? Number(r.pValue) : null,
    sampleSize: r.sampleSize != null ? Number(r.sampleSize) : null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.stream) { const s = String(query.stream).toLowerCase(); r = r.filter(x => (x.streamA || '').toLowerCase().includes(s) || (x.streamB || '').toLowerCase().includes(s)); }
  if (query.min_correlation != null) { const n = parseFloat(query.min_correlation); if (Number.isFinite(n)) r = r.filter(x => Math.abs(x.correlation) >= n); }
  if (query.sign === 'positive') r = r.filter(x => x.correlation > 0);
  if (query.sign === 'negative') r = r.filter(x => x.correlation < 0);
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const c = rows.map(r => Math.abs(r.correlation));
  const byBand = {};
  let positive = 0, negative = 0;
  for (const r of rows) {
    const b = correlationBand(r.correlation).level;
    byBand[b] = (byBand[b] || 0) + 1;
    if (r.correlation > 0) positive++;
    else if (r.correlation < 0) negative++;
  }
  const top5 = rows.slice().sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)).slice(0, 5)
    .map(r => ({ name: r.name, correlation: r.correlation }));
  return {
    count: rows.length,
    max_abs_correlation: Math.max(...c),
    avg_abs_correlation: +(c.reduce((a, b) => a + b, 0) / c.length).toFixed(3),
    positive_count: positive,
    negative_count: negative,
    by_band: byBand,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = correlationBand(r.correlation);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name,
        streamA: r.streamA, streamB: r.streamB,
        correlation: r.correlation, pValue: r.pValue, sampleSize: r.sampleSize,
        severity: r.severity, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'flow', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'very_strong', label: 'Очень сильная (0.8+)', color: '#7f1d1d' },
      { level: 'strong',      label: 'Сильная (0.6+)',       color: '#dc2626' },
      { level: 'moderate',    label: 'Умеренная (0.4+)',     color: '#f97316' },
      { level: 'weak',        label: 'Слабая (0.2+)',        color: '#eab308' },
      { level: 'very_weak',   label: 'Очень слабая',         color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_correlations: full.length, returned_correlations: filtered.length,
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
  const lines = ['id,streamA,streamB,correlation,pValue,sampleSize'];
  for (const r of rows) lines.push(`${r.id},"${(r.streamA || '').replace(/"/g, '""')}","${(r.streamB || '').replace(/"/g, '""')}",${r.correlation},${r.pValue ?? ''},${r.sampleSize ?? ''}`);
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
    const extra = { 'X-Module': 'cross-stream-correlation-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
