/**
 * apis/sources/epa-api.mjs — API-МОДУЛЬ: ЭКОЛОГИЧЕСКИЕ ДАННЫЕ EPA
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/epa.json — [{ id, name, type, lat, lng, status, severity, pollutant?, region?, date?, value?, unit?, description? }] ИЛИ { data:[...] } ИЛИ { records:[...] }.
 * Сборщик: scripts/collectors/collect-epa.mjs.
 *
 * Экологические данные EPA (Environmental Protection Agency):
 * объекты загрязнения, нарушения, статусы, регионы. Геокоординаты — из файла.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?type=, ?status=, ?severity=, ?region=, ?q=, ?since=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats /status /regions /types /critical /featurecollection
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'epa.json');

export const route  = '/api/layers/epa';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🌿',
  color: '#16a34a',
  vizType: 'marker',
  source: 'basket/epa.json',
  collector: 'collect-epa.mjs',
  cache: 600,
  description: 'Экологические данные EPA: объекты, нарушения, статусы',
  unit: 'records',
};

const SEVERITY_META = {
  critical: { color: '#dc2626', label: 'Критический' },
  high:     { color: '#f97316', label: 'Высокий' },
  medium:   { color: '#eab308', label: 'Средний' },
  low:      { color: '#22c55e', label: 'Низкий' },
  info:     { color: '#64748b', label: 'Информация' },
  unknown:  { color: '#6b7280', label: 'Неизвестно' },
};

function severityOf(s) {
  const k = String(s || '').toLowerCase();
  return SEVERITY_META[k] || SEVERITY_META.unknown;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-epa.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  else if (parsed && Array.isArray(parsed.records)) arr = parsed.records;
  else if (parsed && Array.isArray(parsed.facilities)) arr = parsed.facilities;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }
  return arr;
}

function normalizeRecord(r, i) {
  const lat = Number(r.lat ?? r.latitude);
  const lng = Number(r.lng ?? r.lon ?? r.longitude);
  const sev = severityOf(r.severity);
  return {
    id: String(r.id || `epa-${i}`),
    name: r.name || r.title || r.facility || `Record ${i}`,
    type: r.type || r.category || 'unknown',
    status: r.status || 'unknown',
    severity: String(r.severity || 'unknown').toLowerCase(),
    severityLabel: sev.label,
    color: sev.color,
    pollutant: r.pollutant || r.chemical || null,
    region: r.region || r.state || r.country || null,
    date: String(r.date || r.timestamp || '').slice(0, 10) || null,
    value: r.value != null ? Number(r.value) : null,
    unit: r.unit || null,
    description: r.description || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    category: 'ecological',
    icon: meta.icon,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type)     r = r.filter(x => String(x.type).toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.status)   r = r.filter(x => String(x.status).toLowerCase() === String(query.status).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.region)   r = r.filter(x => String(x.region || '').toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.pollutant)r = r.filter(x => String(x.pollutant || '').toLowerCase().includes(String(query.pollutant).toLowerCase()));
  if (query.q)        r = r.filter(x => (x.name + ' ' + (x.description || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.since)    r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.top)      { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit)    { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0, unknown: 0 };
  const byType = {};
  const byStatus = {};
  const byRegion = {};
  const pollutants = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    if (r.pollutant) pollutants[r.pollutant] = (pollutants[r.pollutant] || 0) + 1;
  }
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    by_severity: bySeverity,
    by_type: byType,
    by_status: byStatus,
    top_regions: top(byRegion, 10),
    top_pollutants: top(pollutants, 10),
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, type: r.type, status: r.status,
        severity: r.severity, severityLabel: r.severityLabel,
        pollutant: r.pollutant, region: r.region, date: r.date,
        value: r.value, unit: r.unit, color: r.color,
        category: r.category, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(SEVERITY_META).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) { return rows.map(r => ({ id: r.id, name: r.name, type: r.type, status: r.status, severity: r.severity, region: r.region, date: r.date })); }

function toCSV(rows) {
  const lines = ['id,name,type,status,severity,region,pollutant,value,unit,date,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.type, r.status, r.severity, r.region, r.pollutant, r.value, r.unit, r.date, r.lat, r.lng].map(esc).join(','));
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

function groupBy(rows, keyFn) {
  const groups = {};
  for (const r of rows) {
    const k = keyFn(r);
    if (!k) continue;
    if (!groups[k]) groups[k] = [];
    groups[k].push({ id: r.id, name: r.name, severity: r.severity, type: r.type });
  }
  return groups;
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/epa/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const rawArr = await loadData();
    const all = rawArr.map(normalizeRecord);
    const extra = {
      'X-Module': 'epa-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/regions') {
      const g = groupBy(all, r => r.region);
      return sendJSON(res, 200, { regions: g, total: Object.keys(g).length }, extra);
    }
    if (sub === '/types') {
      const g = groupBy(all, r => r.type);
      return sendJSON(res, 200, { types: g, total: Object.keys(g).length }, extra);
    }
    if (sub === '/critical') {
      const crit = all.filter(r => r.severity === 'critical' || r.severity === 'high');
      return sendJSON(res, 200, { critical: crit, total: crit.length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { total: all.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: all.length, returned_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
