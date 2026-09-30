/**
 * apis/sources/alert-dispatcher-api.mjs — API-МОДУЛЬ: ДИСПЕТЧЕР ОПОВЕЩЕНИЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/alert-dispatcher.json.
 * Анализатор: scripts/analyzers/alert-dispatcher.mjs.
 *
 * Диспетчер оповещений. Собирает сигналы из детекторов и рассылает алерты
 * по уровням критичности.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'alert-dispatcher.json');

export const route  = '/api/layers/alert-dispatcher';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🚨',
  color: '#ff2200',
  vizType: 'marker',
  source: 'analytics/specialist/alert-dispatcher.json',
  collector: 'analyzer:alert-dispatcher',
  cache: 60,
  description: 'Диспетчер оповещений — рассылка алертов по уровням',
  unit: 'alerts',
};

const ALERT_LEVELS = {
  'critical': { level: 'critical', color: '#7f1d1d', label: 'Критический' },
  'high':     { level: 'high',     color: '#dc2626', label: 'Высокий' },
  'medium':   { level: 'medium',   color: '#f97316', label: 'Средний' },
  'low':      { level: 'low',      color: '#eab308', label: 'Низкий' },
  'info':     { level: 'info',     color: '#22c55e', label: 'Информационный' },
};

function alertLevel(level) {
  return ALERT_LEVELS[String(level || 'info').toLowerCase()] || ALERT_LEVELS.info;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/alert-dispatcher.mjs'; throw err;
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
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.alerts)) return data.alerts;
  if (Array.isArray(data.items)) return data.items;
  if (data.data && typeof data.data === 'object') {
    return Object.entries(data.data).map(([key, val]) => {
      if (Array.isArray(val)) return { name: key, alerts: val };
      if (val && typeof val === 'object') return { name: key, ...val };
      return { name: key, value: val };
    });
  }
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || 'unknown',
    name: r.name || r.title || r.alert || 'Alert',
    level: String(r.level ?? r.severity ?? 'info').toLowerCase(),
    source: r.source || r.channel || null,
    message: r.message || r.text || r.description || null,
    category: r.category || null,
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.level) r = r.filter(x => x.level === String(query.level).toLowerCase());
  if (query.source) { const s = String(query.source).toLowerCase(); r = r.filter(x => (x.source || '').toLowerCase().includes(s)); }
  if (query.category) { const c = String(query.category).toLowerCase(); r = r.filter(x => (x.category || '').toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q) || (x.message || '').toLowerCase().includes(q)); }
  if (query.since) r = r.filter(x => (x.date || '') >= String(query.since));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byLevel = {}, bySource = {}, byCategory = {};
  for (const r of rows) {
    byLevel[r.level] = (byLevel[r.level] || 0) + 1;
    if (r.source) bySource[r.source] = (bySource[r.source] || 0) + 1;
    if (r.category) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  }
  return { count: rows.length, by_level: byLevel, by_source: bySource, by_category: byCategory };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const lvl = alertLevel(r.level);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, level: r.level, levelLabel: lvl.label,
        source: r.source, message: r.message, category: r.category, date: r.date,
        color: lvl.color,
        category_layer: 'specialist', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    levels: Object.values(ALERT_LEVELS),
    features,
  };
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
  const lines = ['id,name,level,source,category,date'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.level},${r.source || ''},${r.category || ''},${r.date || ''}`);
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
    const extra = { 'X-Module': 'alert-dispatcher-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      levels: fc.levels,
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
