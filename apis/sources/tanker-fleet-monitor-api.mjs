/**
 * apis/sources/tanker-fleet-monitor-api.mjs — API-МОДУЛЬ: МОНИТОР ТАНКЕРНОГО ФЛОТА
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/tanker-fleet-monitor.json — { _meta:{stats:{items_processed,total_result}}, data:{items:[{id,name,imo?,mmsi?,flag?,lat?,lng?,type?,status?}], top:[], total, generated_at } }.
 * Анализатор: scripts/analyzers/tanker-fleet-monitor.mjs.
 * Зависимость: dark-fleet.json.
 *
 * Мониторинг танкерного флота: позиции, флаги, статусы, аномалии.
 *
 * ФОРМАТЫ: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?flag=, ?status=, ?limit=, ?top=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'tanker-fleet-monitor.json');

export const route  = '/api/layers/tanker-fleet-monitor';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '🛢️',
  color: '#b45309',
  vizType: 'marker',
  source: 'analytics/flow/tanker-fleet-monitor.json',
  collector: 'scripts/analyzers/tanker-fleet-monitor.mjs',
  cache: 120,
  description: 'Монитор танкерного флота: позиции, флаги, статусы',
  unit: 'vessels',
};

const STATUS_COLORS = {
  'under way':       '#22c55e',
  'underway':        '#22c55e',
  'anchored':        '#eab308',
  'moored':          '#0ea5e9',
  'dark':            '#dc2626',
  'idle':            '#64748b',
  'unknown':         '#6b7280',
};

function statusColor(s) {
  const k = String(s || '').toLowerCase();
  return STATUS_COLORS[k] || STATUS_COLORS.unknown;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/tanker-fleet-monitor.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function normalizeVessels(doc) {
  const arr = Array.isArray(doc.data?.items) ? doc.data.items
    : Array.isArray(doc.data?.top) ? doc.data.top : [];
  return arr.map((v, i) => {
    const lat = Number(v.lat ?? v.latitude);
    const lng = Number(v.lng ?? v.lon ?? v.longitude);
    return {
      id: v.id || v.imo || v.mmsi || `vessel-${i}`,
      name: v.name || v.vesselName || `Vessel ${i}`,
      type: v.type || v.vesselType || null,
      flag: v.flag || v.country || null,
      status: v.status || v.navStatus || 'unknown',
      color: statusColor(v.status || v.navStatus),
      imo: v.imo || null,
      mmsi: v.mmsi || null,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      dark: !!(v.dark || v.isDark),
    };
  });
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.q)      r = r.filter(x => (x.name + ' ' + (x.id || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.type)   r = r.filter(x => String(x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.flag)   r = r.filter(x => String(x.flag || '').toLowerCase().includes(String(query.flag).toLowerCase()));
  if (query.status) r = r.filter(x => String(x.status || '').toLowerCase() === String(query.status).toLowerCase());
  if (query.dark === '1' || query.dark === 'true') r = r.filter(x => x.dark);
  if (query.top)    { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit)  { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const byStatus = {};
  const byFlag = {};
  const byType = {};
  let dark = 0;
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.flag) byFlag[r.flag] = (byFlag[r.flag] || 0) + 1;
    if (r.type) byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.dark) dark++;
  }
  return {
    count: rows.length,
    dark_vessels: dark,
    by_status: byStatus,
    by_flag: byFlag,
    by_type: byType,
    meta_items_processed: doc._meta?.stats?.items_processed ?? null,
    meta_total_result: doc._meta?.stats?.total_result ?? null,
    source_total: doc.data?.total ?? null,
    generated_at: doc.data?.generated_at || doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms ?? null,
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, type: r.type, flag: r.flag, status: r.status,
        imo: r.imo, mmsi: r.mmsi, dark: r.dark,
        color: r.color, category: meta.category, icon: meta.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) { return rows.map(r => ({ id: r.id, name: r.name, type: r.type, flag: r.flag, status: r.status, dark: r.dark })); }

function toCSV(rows) {
  const lines = ['id,name,type,flag,status,imo,mmsi,lat,lng,dark'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.type, r.flag, r.status, r.imo, r.mmsi, r.lat, r.lng, r.dark].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/tanker-fleet-monitor/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = normalizeVessels(doc);
    const extra = {
      'X-Module': 'tanker-fleet-monitor-api',
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
    if (sub === '/dark') {
      const dark = all.filter(v => v.dark);
      return sendJSON(res, 200, { dark_vessels: dark, total: dark.length }, extra);
    }
    if (sub === '/featurecollection') return sendJSON(res, 200, toFeatureCollection(all), extra);

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_vessels: all.length, returned_vessels: rows.length,
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
