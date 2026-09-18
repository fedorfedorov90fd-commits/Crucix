/**
 * apis/sources/noaa-api.mjs — API-МОДУЛЬ: ПОГОДА NOAA
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/noaa.json — { type:'FeatureCollection', features:[{ type:'Feature', geometry:{ type:'Point', coordinates:[lng,lat] }, properties:{ name, id, temp, condition, wind, severity } }] } ИЛИ [{ lat, lng, name, temp, condition, wind, severity }].
 * Сборщик: scripts/collectors/collect-noaa.mjs.
 *
 * Погодные данные NOAA по городам мира: температура, состояние, ветер, severity.
 * Геокоординаты — из geometry или lat/lng.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?condition=, ?severity=, ?min_temp=, ?max_temp=, ?q=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats /status /hot /cold /windy /severe /conditions /featurecollection
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'noaa.json');

export const route  = '/api/layers/noaa';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '☁️',
  color: '#00ccff',
  vizType: 'marker',
  source: 'basket/noaa.json',
  collector: 'collect-noaa.mjs',
  cache: 300,
  description: 'NOAA Погода по городам мира',
  unit: 'stations',
};

const SEVERITY_META = {
  low:      { color: '#22c55e', label: 'Спокойно' },
  medium:   { color: '#eab308', label: 'Умеренно' },
  high:     { color: '#f97316', label: 'Опасно' },
  critical: { color: '#dc2626', label: 'Критично' },
  unknown:  { color: '#64748b', label: 'Неизвестно' },
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
      err.hint = 'run scripts/collectors/collect-noaa.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractStations(doc) {
  let arr = null;
  if (Array.isArray(doc)) arr = doc;
  else if (doc && Array.isArray(doc.features)) {
    return doc.features.map((f, i) => {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates || [];
      return {
        name: p.name || p.city || `Station ${i}`,
        station_id: p.id || p.station_id || null,
        temp: p.temp != null ? Number(p.temp) : null,
        condition: p.condition || p.weather || null,
        wind: p.wind != null ? Number(p.wind) : null,
        severity: String(p.severity || 'unknown').toLowerCase(),
        severityLabel: severityOf(p.severity).label,
        color: severityOf(p.severity).color,
        lat: Number.isFinite(Number(coords[1])) ? Number(coords[1]) : null,
        lng: Number.isFinite(Number(coords[0])) ? Number(coords[0]) : null,
        date: p.date || p.timestamp || null,
        category: 'ecological',
        icon: meta.icon,
      };
    });
  }
  else if (doc && Array.isArray(doc.data)) arr = doc.data;
  else if (doc && Array.isArray(doc.records)) arr = doc.records;

  if (!arr) return [];
  return arr.map((r, i) => {
    const lat = Number(r.lat ?? r.latitude);
    const lng = Number(r.lng ?? r.lon ?? r.longitude);
    return {
      name: r.name || r.city || `Station ${i}`,
      station_id: r.id || r.station_id || null,
      temp: r.temp != null ? Number(r.temp) : null,
      condition: r.condition || r.weather || null,
      wind: r.wind != null ? Number(r.wind) : null,
      severity: String(r.severity || 'unknown').toLowerCase(),
      severityLabel: severityOf(r.severity).label,
      color: severityOf(r.severity).color,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      date: r.date || r.timestamp || null,
      category: 'ecological',
      icon: meta.icon,
    };
  });
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country)   r = r.filter(x => String(x.name).toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.condition) r = r.filter(x => String(x.condition || '').toLowerCase().includes(String(query.condition).toLowerCase()));
  if (query.severity)  r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.q)         r = r.filter(x => String(x.name).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min_temp != null) { const n = Number(query.min_temp); if (Number.isFinite(n)) r = r.filter(x => x.temp != null && x.temp >= n); }
  if (query.max_temp != null) { const n = Number(query.max_temp); if (Number.isFinite(n)) r = r.filter(x => x.temp != null && x.temp <= n); }
  const sortKey = query.sort;
  if (sortKey === 'temp-desc') r.sort((a, b) => (b.temp ?? -999) - (a.temp ?? -999));
  else if (sortKey === 'temp-asc') r.sort((a, b) => (a.temp ?? 999) - (b.temp ?? 999));
  else if (sortKey === 'wind') r.sort((a, b) => (b.wind ?? 0) - (a.wind ?? 0));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  const temps = rows.map(r => r.temp).filter(Number.isFinite);
  const winds = rows.map(r => r.wind).filter(Number.isFinite);
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0, unknown: 0 };
  const byCondition = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.condition) byCondition[r.condition] = (byCondition[r.condition] || 0) + 1;
  }
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    with_temp: temps.length,
    with_wind: winds.length,
    temp_mean: temps.length ? Number((temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(2)) : null,
    temp_min: temps.length ? Number(Math.min(...temps).toFixed(2)) : null,
    temp_max: temps.length ? Number(Math.max(...temps).toFixed(2)) : null,
    wind_mean: winds.length ? Number((winds.reduce((a,b)=>a+b,0)/winds.length).toFixed(2)) : null,
    wind_max: winds.length ? Number(Math.max(...winds).toFixed(2)) : null,
    by_severity: bySeverity,
    top_conditions: top(byCondition, 10),
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name, station_id: r.station_id, temp: r.temp, condition: r.condition, wind: r.wind,
        severity: r.severity, severityLabel: r.severityLabel, color: r.color, date: r.date,
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

function toSeries(rows) { return rows.map(r => ({ name: r.name, temp: r.temp, condition: r.condition, wind: r.wind, severity: r.severity, date: r.date })); }

function toCSV(rows) {
  const lines = ['name,station_id,temp,condition,wind,severity,lat,lng,date'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.name, r.station_id, r.temp, r.condition, r.wind, r.severity, r.lat, r.lng, r.date].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/noaa/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractStations(doc);
    const extra = {
      'X-Module': 'noaa-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/hot') {
      const hot = all.filter(r => r.temp != null).sort((a, b) => b.temp - a.temp).slice(0, 10);
      return sendJSON(res, 200, { hot, count: hot.length }, extra);
    }
    if (sub === '/cold') {
      const cold = all.filter(r => r.temp != null).sort((a, b) => a.temp - b.temp).slice(0, 10);
      return sendJSON(res, 200, { cold, count: cold.length }, extra);
    }
    if (sub === '/windy') {
      const windy = all.filter(r => r.wind != null).sort((a, b) => b.wind - a.wind).slice(0, 10);
      return sendJSON(res, 200, { windy, count: windy.length }, extra);
    }
    if (sub === '/severe') {
      const severe = all.filter(r => r.severity === 'high' || r.severity === 'critical');
      return sendJSON(res, 200, { severe, count: severe.length }, extra);
    }
    if (sub === '/conditions') {
      const byCondition = {};
      for (const r of all) {
        if (!r.condition) continue;
        if (!byCondition[r.condition]) byCondition[r.condition] = [];
        byCondition[r.condition].push({ name: r.name, temp: r.temp, wind: r.wind });
      }
      return sendJSON(res, 200, { conditions: byCondition, total: Object.keys(byCondition).length }, extra);
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
        total_stations: all.length, returned_stations: rows.length,
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
