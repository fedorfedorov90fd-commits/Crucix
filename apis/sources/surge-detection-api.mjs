/**
 * apis/sources/surge-detection-api.mjs — API-МОДУЛЬ: ДЕТЕКТОР ВСПЛЕСКОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/detector/surge-detection.json.
 * Анализатор: scripts/analyzers/surge-detection.mjs.
 *
 * Обнаружение всплесков в временных рядах (vix, gold, oil, dxy).
 * Сигнал при резком отклонении от исторической нормы.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'detector', 'surge-detection.json');

export const route  = '/api/layers/surge-detection';
export const method = 'GET';

export const meta = {
  category: 'detector',
  icon: '📈',
  color: '#ff6600',
  vizType: 'marker',
  source: 'analytics/detector/surge-detection.json',
  collector: 'analyzer:surge-detection',
  cache: 300,
  description: 'Детектор всплесков во временных рядах',
  unit: 'detections',
};

const INDICATOR_COORDS = {
  'vix':   { lat: 41.8781, lng:  -87.6298, name: 'VIX (CBOE Chicago)' },
  'dxy':   { lat: 40.7069, lng:  -74.0113, name: 'DXY (NY)' },
  'gold':  { lat: 40.7128, lng:  -74.0060, name: 'Золото (COMEX)' },
  'oil':   { lat: 29.7604, lng:  -95.3698, name: 'Нефть (Хьюстон)' },
  'sp500': { lat: 40.7580, lng:  -73.9855, name: 'S&P 500 (NYSE)' },
};

function surgeColor(z) {
  const abs = Math.abs(z);
  if (abs >= 4) return { level: 'extreme',  color: '#7f1d1d', label: 'Экстремальный' };
  if (abs >= 3) return { level: 'critical', color: '#dc2626', label: 'Критический' };
  if (abs >= 2.5) return { level: 'high',   color: '#f97316', label: 'Высокий' };
  if (abs >= 2) return { level: 'medium',   color: '#eab308', label: 'Средний' };
  return               { level: 'low',    color: '#22c55e', label: 'Низкий' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/surge-detection.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.detections)) return data.data.detections;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.surges)) return data.data.surges;
  if (Array.isArray(data.detections)) return data.detections;
  if (Array.isArray(data.surges)) return data.surges;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function normalizeItem(r) {
  const ind = String(r.indicator || r.metric || r.series || 'unknown').toLowerCase();
  const loc = INDICATOR_COORDS[ind] || null;
  return {
    id: r.id || 'unknown',
    name: r.name || (loc ? loc.name : ind),
    indicator: ind,
    value: Number(r.value ?? r.current ?? 0),
    zScore: Number(r.zScore ?? r.zscore ?? r.z ?? 0),
    direction: r.direction || (r.value > (r.mean || 0) ? 'up' : 'down'),
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? loc?.lat ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? loc?.lng ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.indicator) r = r.filter(x => x.indicator === String(query.indicator).toLowerCase());
  if (query.direction) r = r.filter(x => x.direction === String(query.direction).toLowerCase());
  if (query.min_z != null) { const n = parseFloat(query.min_z); if (Number.isFinite(n)) r = r.filter(x => Math.abs(x.zScore) >= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const z = rows.map(r => Math.abs(r.zScore));
  const byLevel = {}, byIndicator = {};
  for (const r of rows) {
    const lvl = surgeColor(r.zScore).level;
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    byIndicator[r.indicator] = (byIndicator[r.indicator] || 0) + 1;
  }
  const top5 = rows.slice().sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 5)
    .map(r => ({ indicator: r.indicator, zScore: r.zScore }));
  return { count: rows.length, max_abs_z: Math.max(...z), by_level: byLevel, by_indicator: byIndicator, top_5: top5 };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const l = surgeColor(r.zScore);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, indicator: r.indicator,
        value: r.value, zScore: r.zScore, direction: r.direction, severity: r.severity, date: r.date,
        level: l.level, levelLabel: l.label, color: l.color,
        category: 'detector', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    levels: [
      { level: 'extreme',  label: 'Экстремальный (4σ+)', color: '#7f1d1d' },
      { level: 'critical', label: 'Критический (3σ+)',   color: '#dc2626' },
      { level: 'high',     label: 'Высокий (2.5σ+)',     color: '#f97316' },
      { level: 'medium',   label: 'Средний (2σ+)',       color: '#eab308' },
      { level: 'low',      label: 'Низкий',              color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_detections: full.length, returned_detections: filtered.length,
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
  const lines = ['id,name,indicator,value,zScore,direction,date'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.indicator},${r.value},${r.zScore},${r.direction},${r.date || ''}`);
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
    const extra = { 'X-Module': 'surge-detection-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
