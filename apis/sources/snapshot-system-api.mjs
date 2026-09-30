/**
 * apis/sources/snapshot-system-api.mjs — API-МОДУЛЬ: SNAPSHOT SYSTEM
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/detector/snapshot-system.json.
 * Анализатор: scripts/analyzers/snapshot-system.mjs.
 *
 * Система снимков состояния. Фиксирует состояние ключевых индикаторов (vix, gold, oil, dxy, earthquakes)
 * в определённые моменты времени для сравнения и выявления изменений.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'detector', 'snapshot-system.json');

export const route  = '/api/layers/snapshot-system';
export const method = 'GET';

export const meta = {
  category: 'detector',
  icon: '📸',
  color: '#0088ff',
  vizType: 'marker',
  source: 'analytics/detector/snapshot-system.json',
  collector: 'analyzer:snapshot-system',
  cache: 300,
  description: 'Snapshot System — снимки состояния ключевых индикаторов',
  unit: 'snapshots',
};

const INDICATOR_COORDS = {
  'vix':         { lat: 41.8781, lng:  -87.6298, country: 'USA', name: 'VIX (CBOE Chicago)' },
  'dxy':         { lat: 40.7069, lng:  -74.0113, country: 'USA', name: 'DXY (NY)' },
  'gold':        { lat: 40.7128, lng:  -74.0060, country: 'USA', name: 'Золото (COMEX)' },
  'oil':         { lat: 29.7604, lng:  -95.3698, country: 'USA', name: 'Нефть (Хьюстон)' },
  'earthquakes': { lat: 35.6762, lng:  139.6503, country: 'Japan', name: 'Землетрясения (Токио)' },
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/snapshot-system.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.snapshots)) return data.data.snapshots;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.snapshots)) return data.snapshots;
  if (Array.isArray(data.items)) return data.items;
  if (data.data && typeof data.data === 'object') return [data.data];
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || r.snapshotId || 'unknown',
    name: r.name || r.label || r.date || 'Snapshot',
    date: r.date || r.timestamp || r.createdAt || null,
    indicators: r.indicators || r.values || null,
    summary: r.summary || null,
    severity: String(r.severity || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    values: r.values || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.since) r = r.filter(x => (x.date || '') >= String(query.since));
  if (query.until) r = r.filter(x => (x.date || '') <= String(query.until));
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
  };
}

function toFeatureCollection(rows) {
  // Каждый snapshot → набор точек по индикаторам
  const features = [];
  for (const snap of rows) {
    const ind = snap.indicators || snap.values;
    if (!ind || typeof ind !== 'object') continue;
    for (const [key, val] of Object.entries(ind)) {
      const loc = INDICATOR_COORDS[key];
      if (!loc) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
        properties: {
          snapshotId: snap.id,
          date: snap.date,
          indicator: key,
          indicatorName: loc.name,
          value: typeof val === 'number' ? val : (val && val.value != null ? Number(val.value) : null),
          unit: (val && val.unit) || null,
          country: loc.country,
          color: meta.color,
          category: 'detector', icon: meta.icon,
        },
      });
    }
  }
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_snapshots: full.length, returned_snapshots: filtered.length,
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
  const lines = ['id,name,date,severity'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.date || ''},${r.severity}`);
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
    const extra = { 'X-Module': 'snapshot-system-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
