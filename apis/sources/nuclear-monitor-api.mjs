/**
 * apis/sources/nuclear-monitor-api.mjs — API-МОДУЛЬ: ЯДЕРНЫЙ МОНИТОРИНГ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/nuclear-monitor.json — [{ date, value, lat, lng, site?, region?, status? }] ИЛИ { data:[...] } ИЛИ { sites:[{ id, name, lat, lng, series:[{date,value}] }] }.
 * Сборщик: scripts/collectors/collect-nuclear-monitor.mjs.
 *
 * Ядерный мониторинг: активность АЭС, статусы площадок, временные ряды по объектам.
 * Геокоординаты — из файла.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?site=, ?region=, ?status=, ?min_value=, ?max_value=, ?since=, ?limit=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats /status /latest /sites /regions /anomalies /featurecollection
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'nuclear-monitor.json');

export const route  = '/api/layers/nuclear-monitor';
export const method = 'GET';

export const meta = {
  category: 'military',
  icon: '☢️',
  color: '#ff00ff',
  vizType: 'marker',
  source: 'basket/nuclear-monitor.json',
  collector: 'collect-nuclear-monitor.mjs',
  cache: 300,
  description: 'Ядерный мониторинг: АЭС, площадки, временные ряды',
  unit: 'sites',
};

const STATUS_META = {
  normal:    { color: '#22c55e', label: 'Норма' },
  elevated:  { color: '#eab308', label: 'Повышенный' },
  warning:   { color: '#f97316', label: 'Внимание' },
  critical:  { color: '#dc2626', label: 'Критический' },
  offline:   { color: '#64748b', label: 'Неактивен' },
  unknown:   { color: '#6b7280', label: 'Неизвестно' },
};

function statusOf(s) {
  const k = String(s || '').toLowerCase();
  return STATUS_META[k] || STATUS_META.unknown;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-nuclear-monitor.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

/**
 * Нормализует вход в два возможных формата:
 *   1. Плоский массив [ {date, value, lat, lng, site?} ]
 *   2. { sites:[ { id, name, lat, lng, series:[{date,value}] } ] }
 * Возвращает { sites:[...], points:[...] }.
 *   sites — агрегированные по площадкам (id/name/lat/lng, серия, последнее значение, статистика)
 *   points — плоские точки (date,value,lat,lng)
 */
function normalizeData(doc) {
  if (Array.isArray(doc)) {
    return buildSitesFromPoints(doc);
  }
  if (doc && Array.isArray(doc.sites)) {
    return buildSitesFromSites(doc.sites);
  }
  if (doc && Array.isArray(doc.data)) {
    return buildSitesFromPoints(doc.data);
  }
  if (doc && Array.isArray(doc.records)) {
    return buildSitesFromPoints(doc.records);
  }
  return { sites: [], points: [] };
}

function buildSitesFromPoints(rows) {
  const bySite = new Map();
  const points = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const lat = Number(r.lat ?? r.latitude);
    const lng = Number(r.lng ?? r.lon ?? r.longitude);
    const value = Number(r.value ?? r.radiation ?? r.level);
    if (!Number.isFinite(value)) continue;
    const date = String(r.date || r.timestamp || '').slice(0, 10) || null;
    const siteId = r.site || r.site_id || r.id || `site-${Number.isFinite(lat) ? lat.toFixed(2) : i}`;
    const siteName = r.name || r.site_name || siteId;

    points.push({ date, value, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, site: siteId, region: r.region || null });

    if (!bySite.has(siteId)) {
      bySite.set(siteId, {
        id: siteId,
        name: siteName,
        region: r.region || null,
        status: r.status || 'unknown',
        lat: Number.isFinite(lat) ? lat : null,
        lng: Number.isFinite(lng) ? lng : null,
        series: [],
      });
    }
    const s = bySite.get(siteId);
    s.series.push({ date, value });
    if (Number.isFinite(lat) && s.lat == null) s.lat = lat;
    if (Number.isFinite(lng) && s.lng == null) s.lng = lng;
    if (r.status && s.status === 'unknown') s.status = r.status;
  }

  const sites = [];
  for (const s of bySite.values()) {
    s.series.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const values = s.series.map(x => x.value);
    const last = s.series[s.series.length - 1] || null;
    const first = s.series[0] || null;
    s.count = s.series.length;
    s.last_value = last?.value ?? null;
    s.last_date = last?.date ?? null;
    s.min_value = values.length ? Math.min(...values) : null;
    s.max_value = values.length ? Math.max(...values) : null;
    s.mean_value = values.length ? Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)) : null;
    s.change_abs = (last && first) ? Number((last.value - first.value).toFixed(4)) : null;
    s.change_pct = (last && first && first.value !== 0) ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null;
    const sev = statusOf(s.status);
    s.statusLabel = sev.label;
    s.color = sev.color;
    s.category = 'military';
    s.icon = meta.icon;
    sites.push(s);
  }
  sites.sort((a, b) => (b.last_value ?? 0) - (a.last_value ?? 0));
  return { sites, points };
}

function buildSitesFromSites(rawSites) {
  const sites = [];
  const points = [];
  for (let i = 0; i < rawSites.length; i++) {
    const raw = rawSites[i];
    const lat = Number(raw.lat ?? raw.latitude);
    const lng = Number(raw.lng ?? raw.lon ?? raw.longitude);
    const series = Array.isArray(raw.series) ? raw.series.map(p => ({
      date: String(p.date || p.timestamp || '').slice(0, 10) || null,
      value: Number(p.value ?? p.radiation ?? p.level),
    })).filter(p => Number.isFinite(p.value)).sort((a, b) => (a.date || '').localeCompare(b.date || '')) : [];
    for (const p of series) points.push({ ...p, site: raw.id || raw.name, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, region: raw.region || null });
    const values = series.map(x => x.value);
    const last = series[series.length - 1] || null;
    const first = series[0] || null;
    const sev = statusOf(raw.status);
    sites.push({
      id: raw.id || `site-${i}`,
      name: raw.name || raw.id || `Site ${i}`,
      region: raw.region || null,
      status: raw.status || 'unknown',
      statusLabel: sev.label,
      color: sev.color,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      series,
      count: series.length,
      last_value: last?.value ?? null,
      last_date: last?.date ?? null,
      first_value: first?.value ?? null,
      min_value: values.length ? Math.min(...values) : null,
      max_value: values.length ? Math.max(...values) : null,
      mean_value: values.length ? Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)) : null,
      change_abs: (last && first) ? Number((last.value - first.value).toFixed(4)) : null,
      change_pct: (last && first && first.value !== 0) ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null,
      category: 'military',
      icon: meta.icon,
    });
  }
  sites.sort((a, b) => (b.last_value ?? 0) - (a.last_value ?? 0));
  return { sites, points };
}

function applyFilters(sites, query) {
  let r = sites.slice();
  if (query.site)   r = r.filter(x => String(x.id).toLowerCase().includes(String(query.site).toLowerCase()) || String(x.name).toLowerCase().includes(String(query.site).toLowerCase()));
  if (query.region) r = r.filter(x => String(x.region || '').toLowerCase().includes(String(query.region).toLowerCase()));
  if (query.status) r = r.filter(x => x.status === String(query.status).toLowerCase());
  if (query.q)      r = r.filter(x => String(x.name).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min_value != null) { const n = Number(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.last_value != null && x.last_value >= n); }
  if (query.max_value != null) { const n = Number(query.max_value); if (Number.isFinite(n)) r = r.filter(x => x.last_value != null && x.last_value <= n); }
  const sortKey = query.sort;
  if (sortKey === 'value-desc') r.sort((a, b) => (b.last_value ?? 0) - (a.last_value ?? 0));
  else if (sortKey === 'value-asc') r.sort((a, b) => (a.last_value ?? 0) - (b.last_value ?? 0));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(sites, points) {
  const allValues = points.map(p => p.value).filter(Number.isFinite);
  const statuses = {};
  for (const s of sites) statuses[s.status] = (statuses[s.status] || 0) + 1;
  const dates = points.map(p => p.date).filter(Boolean).sort();
  const highest = sites.slice().sort((a, b) => (b.last_value ?? 0) - (a.last_value ?? 0))[0] || null;
  const lowest = sites.slice().sort((a, b) => (a.last_value ?? 0) - (b.last_value ?? 0))[0] || null;
  return {
    sites_count: sites.length,
    points_count: points.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    value_mean: allValues.length ? Number((allValues.reduce((a,b)=>a+b,0)/allValues.length).toFixed(2)) : null,
    value_min: allValues.length ? Number(Math.min(...allValues).toFixed(2)) : null,
    value_max: allValues.length ? Number(Math.max(...allValues).toFixed(2)) : null,
    by_status: statuses,
    highest_site: highest ? { id: highest.id, name: highest.name, value: highest.last_value } : null,
    lowest_site: lowest ? { id: lowest.id, name: lowest.name, value: lowest.last_value } : null,
  };
}

function toFeatureCollection(sites) {
  const features = sites
    .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
    .map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id, name: s.name, region: s.region, status: s.status, statusLabel: s.statusLabel,
        last_value: s.last_value, last_date: s.last_date,
        min_value: s.min_value, max_value: s.max_value, mean_value: s.mean_value,
        change_abs: s.change_abs, change_pct: s.change_pct,
        count: s.count, color: s.color, category: s.category, icon: s.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(STATUS_META).map(([key, def]) => ({ key, ...def })),
    meta: { total: sites.length, mapped: features.length, unmapped: sites.length - features.length },
  };
}

function toSeries(sites) { return sites.map(s => ({ id: s.id, name: s.name, region: s.region, status: s.status, last_value: s.last_value, last_date: s.last_date, change_pct: s.change_pct, count: s.count })); }

function toCSV(sites) {
  const lines = ['id,name,region,status,last_value,last_date,min_value,max_value,mean_value,change_pct,count,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const s of sites) lines.push([s.id, s.name, s.region, s.status, s.last_value, s.last_date, s.min_value, s.max_value, s.mean_value, s.change_pct, s.count, s.lat, s.lng].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/nuclear-monitor/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { sites, points } = normalizeData(doc);
    const extra = {
      'X-Module': 'nuclear-monitor-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(sites, points) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', sites: sites.length, points: points.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/latest') {
      const latestPoints = points.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 30);
      return sendJSON(res, 200, { latest: latestPoints, count: latestPoints.length }, extra);
    }
    if (sub === '/sites') {
      return sendJSON(res, 200, { sites, total: sites.length }, extra);
    }
    if (sub === '/regions') {
      const byRegion = {};
      for (const s of sites) {
        const r = s.region || 'unknown';
        if (!byRegion[r]) byRegion[r] = [];
        byRegion[r].push({ id: s.id, name: s.name, last_value: s.last_value, status: s.status });
      }
      return sendJSON(res, 200, { regions: byRegion, total: Object.keys(byRegion).length }, extra);
    }
    if (sub === '/anomalies') {
      // Аномалии: change_pct > 20% ИЛИ status = critical/warning
      const anomalies = sites.filter(s =>
        (s.change_pct != null && Math.abs(s.change_pct) > 20) ||
        s.status === 'critical' || s.status === 'warning'
      );
      return sendJSON(res, 200, { anomalies, count: anomalies.length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(sites, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(sites, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc, meta: { sites: sites.length, points: points.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_sites: sites.length, returned_sites: rows.length,
        total_points: points.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      sites: rows,
      series: toSeries(rows),
      stats: computeStats(rows, points),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
