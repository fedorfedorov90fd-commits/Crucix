/**
 * apis/sources/conflict-escalation-tracker-api.mjs — API-МОДУЛЬ: ЭСКАЛАЦИЯ КОНФЛИКТОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/forecast/conflict-escalation-tracker.json.
 * Анализатор: scripts/analyzers/conflict-escalation-tracker.mjs.
 *
 * Трекер эскалации конфликтов. 6-уровневая шкала: мир → напряжение → кризис →
 * открытый конфликт → война → тотальная война.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'forecast', 'conflict-escalation-tracker.json');

export const route  = '/api/layers/conflict-escalation-tracker';
export const method = 'GET';

export const meta = {
  category: 'forecast',
  icon: '🔥',
  color: '#dc2626',
  vizType: 'marker',
  source: 'analytics/forecast/conflict-escalation-tracker.json',
  collector: 'analyzer:conflict-escalation-tracker',
  cache: 300,
  description: 'Трекер эскалации конфликтов — 6-уровневая шкала',
  unit: 'index',
};

const ESCALATION_LEVELS = {
  1: { level: 'peace',       color: '#22c55e', label: 'Мир' },
  2: { level: 'tension',     color: '#84cc16', label: 'Напряжение' },
  3: { level: 'crisis',      color: '#eab308', label: 'Кризис' },
  4: { level: 'conflict',    color: '#f97316', label: 'Открытый конфликт' },
  5: { level: 'war',         color: '#dc2626', label: 'Война' },
  6: { level: 'total_war',   color: '#7f1d1d', label: 'Тотальная война' },
};

function escalationBand(level) {
  const n = Math.round(Number(level));
  return ESCALATION_LEVELS[n] || ESCALATION_LEVELS[3];
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/conflict-escalation-tracker.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.countries)) return data.data.countries;
  if (data.data && Array.isArray(data.data.conflicts)) return data.data.conflicts;
  if (Array.isArray(data.countries)) return data.countries;
  if (Array.isArray(data.conflicts)) return data.conflicts;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || r.iso || r.name || 'unknown',
    name: r.name || r.country || r.region || 'Unknown',
    iso: r.iso || r.code || null,
    level: Number(r.level ?? r.escalation ?? r.value ?? 3),
    trend: r.trend || 'stable',
    previousLevel: r.previousLevel != null ? Number(r.previousLevel) : null,
    description: r.description || r.summary || null,
    severity: String(r.severity || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    region: r.region || null,
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_level != null) { const n = parseInt(query.min_level, 10); if (Number.isFinite(n)) r = r.filter(x => x.level >= n); }
  if (query.max_level != null) { const n = parseInt(query.max_level, 10); if (Number.isFinite(n)) r = r.filter(x => x.level <= n); }
  if (query.trend) r = r.filter(x => x.trend === String(query.trend).toLowerCase());
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.iso) r = r.filter(x => (x.iso || '').toUpperCase() === String(query.iso).toUpperCase());
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const levels = rows.map(r => r.level);
  const byLevel = {}, byTrend = {};
  for (const r of rows) {
    const lvl = escalationBand(r.level).level;
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    byTrend[r.trend] = (byTrend[r.trend] || 0) + 1;
  }
  const critical = rows.filter(x => x.level >= 5).map(x => x.name);
  const top5 = rows.slice().sort((a, b) => b.level - a.level).slice(0, 5).map(r => ({ name: r.name, level: r.level }));
  return {
    count: rows.length,
    max_level: Math.max(...levels),
    avg_level: +(levels.reduce((a, b) => a + b, 0) / levels.length).toFixed(2),
    by_level: byLevel,
    by_trend: byTrend,
    critical_countries: critical,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = escalationBand(r.level);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, iso: r.iso, level: r.level,
        trend: r.trend, previousLevel: r.previousLevel,
        description: r.description, severity: r.severity, region: r.region, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'forecast', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    levels: Object.entries(ESCALATION_LEVELS).map(([lvl, v]) => ({ level: Number(lvl), ...v })),
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_items: full.length, returned_items: filtered.length,
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
  const lines = ['id,name,iso,level,band,trend,region'];
  for (const r of rows) { const b = escalationBand(r.level); lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.iso || ''},${r.level},${b.level},${r.trend},${r.region || ''}`); }
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
    const extra = { 'X-Module': 'conflict-escalation-tracker-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
