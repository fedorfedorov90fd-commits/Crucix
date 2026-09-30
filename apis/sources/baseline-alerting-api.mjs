/**
 * apis/sources/baseline-alerting-api.mjs — API-МОДУЛЬ: BASELINE ALERTING
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/detector/baseline-alerting.json — результат анализатора.
 * Анализатор: scripts/analyzers/baseline-alerting.mjs.
 *
 * Детектор отклонений от базовой линии по финансовым индикаторам (vix, dxy, gold, oil).
 * Срабатывает при выходе значения за пределы ожидаемого коридора.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'detector', 'baseline-alerting.json');

export const route  = '/api/layers/baseline-alerting';
export const method = 'GET';

export const meta = {
  category: 'detector',
  icon: '🚨',
  color: '#ff4400',
  vizType: 'marker',
  source: 'analytics/detector/baseline-alerting.json',
  collector: 'analyzer:baseline-alerting',
  cache: 300,
  description: 'Baseline Alerting — детектор отклонений от базовой линии',
  unit: 'alerts',
};

function alertLevelColor(level) {
  const m = { 'critical': '#7f1d1d', 'high': '#dc2626', 'medium': '#f97316', 'low': '#eab308', 'info': '#22c55e' };
  return m[String(level || 'info').toLowerCase()] || m.info;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/baseline-alerting.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.alerts)) return data.data.alerts;
  if (data.data && Array.isArray(data.data.items))  return data.data.items;
  if (Array.isArray(data.alerts)) return data.alerts;
  if (Array.isArray(data.items))  return data.items;
  if (Array.isArray(data.data))   return data.data;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || r.metric || r.indicator || 'Unknown',
    metric: r.metric || r.indicator || null,
    value: Number(r.value ?? r.current ?? 0),
    baseline: Number(r.baseline ?? r.expected ?? 0),
    deviation: Number(r.deviation ?? r.delta ?? 0),
    level: String(r.level || r.severity || 'info').toLowerCase(),
    message: r.message || r.description || null,
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.level) r = r.filter(x => x.level === String(query.level).toLowerCase());
  if (query.metric) { const m = String(query.metric).toLowerCase(); r = r.filter(x => (x.metric || '').toLowerCase().includes(m)); }
  if (query.min_deviation != null) { const n = parseFloat(query.min_deviation); if (Number.isFinite(n)) r = r.filter(x => Math.abs(x.deviation) >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byLevel = {}, byMetric = {};
  for (const r of rows) {
    byLevel[r.level] = (byLevel[r.level] || 0) + 1;
    if (r.metric) byMetric[r.metric] = (byMetric[r.metric] || 0) + 1;
  }
  return { count: rows.length, by_level: byLevel, by_metric: byMetric };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, metric: r.metric,
      value: r.value, baseline: r.baseline, deviation: r.deviation,
      level: r.level, message: r.message, date: r.date,
      color: alertLevelColor(r.level),
      category: 'detector', icon: meta.icon,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_alerts: full.length, returned_alerts: filtered.length,
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
  const lines = ['id,name,metric,value,baseline,deviation,level'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.metric || ''},${r.value},${r.baseline},${r.deviation},${r.level}`);
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
    const extra = { 'X-Module': 'baseline-alerting-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
