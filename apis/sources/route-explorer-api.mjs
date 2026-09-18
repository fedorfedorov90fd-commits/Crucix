/**
 * apis/sources/route-explorer-api.mjs — API-МОДУЛЬ: ОБОЗРЕВАТЕЛЬ МАРШРУТОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/flow/route-explorer.json — { _meta:{stats}, data:{ ports:[{id,name,lat,lng,country,type,capacity}], chokepoints:[{id,name,lat,lng,type}], routes:[{id,from,to,type,lengthKm,risk}] } }.
 * Анализатор: scripts/analyzers/route-explorer.mjs.
 *
 * Морские порты, чокпоинты и торговые маршруты.
 *
 * ФОРМАТЫ: json (FC + ports + chokepoints + routes + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?type=, ?min_capacity=, ?q=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'flow', 'route-explorer.json');

export const route  = '/api/layers/route-explorer';
export const method = 'GET';

export const meta = {
  category: 'flow',
  icon: '🚢',
  color: '#0891b2',
  vizType: 'marker',
  source: 'analytics/flow/route-explorer.json',
  collector: 'scripts/analyzers/route-explorer.mjs',
  cache: 300,
  description: 'Порты, чокпоинты, торговые маршруты',
  unit: 'entities',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/route-explorer.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || !parsed.data) { const err = new Error('invalid_shape: missing data'); err.statusCode = 500; throw err; }
  return parsed;
}

function normPoint(x, i, kind) {
  const lat = Number(x.lat ?? x.latitude);
  const lng = Number(x.lng ?? x.lon ?? x.longitude);
  return {
    id: x.id || `${kind}-${i}`,
    name: x.name || x.label || x.id || `${kind} ${i}`,
    kind,
    type: x.type || kind,
    country: x.country || null,
    capacity: x.capacity != null ? Number(x.capacity) : null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function normRoute(r, i) {
  return {
    id: r.id || `route-${i}`,
    from: r.from || r.source || null,
    to: r.to || r.target || null,
    type: r.type || 'default',
    lengthKm: r.lengthKm != null ? Number(r.lengthKm) : (r.length != null ? Number(r.length) : null),
    risk: r.risk != null ? Number(r.risk) : null,
  };
}

function extractAll(doc) {
  const d = doc.data || {};
  const ports = (d.ports || []).map((x, i) => normPoint(x, i, 'port'));
  const chokepoints = (d.chokepoints || []).map((x, i) => normPoint(x, i, 'chokepoint'));
  const routes = (d.routes || []).map(normRoute);
  return { ports, chokepoints, routes };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) r = r.filter(x => (x.country || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.type)    r = r.filter(x => (x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.q)       r = r.filter(x => (x.name || '').toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min_capacity != null) {
    const n = Number(query.min_capacity);
    if (Number.isFinite(n)) r = r.filter(x => x.capacity != null && x.capacity >= n);
  }
  if (query.limit)   { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(ports, chokepoints, routes, doc) {
  const byCountry = {};
  for (const p of ports) if (p.country) byCountry[p.country] = (byCountry[p.country] || 0) + 1;
  const byType = {};
  for (const p of ports) byType[p.type] = (byType[p.type] || 0) + 1;
  const routeTypes = {};
  for (const r of routes) routeTypes[r.type] = (routeTypes[r.type] || 0) + 1;
  return {
    ports: ports.length,
    chokepoints: chokepoints.length,
    routes: routes.length,
    by_country: byCountry,
    by_port_type: byType,
    by_route_type: routeTypes,
    meta: doc._meta?.stats || null,
    generated_at: doc._meta?.updated_at || null,
  };
}

function toFeatureCollection(items) {
  const features = items
    .filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lng))
    .map(x => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [x.lng, x.lat] },
      properties: {
        id: x.id, name: x.name, kind: x.kind, type: x.type, country: x.country,
        capacity: x.capacity, category: meta.category, icon: meta.icon, color: meta.color,
      },
    }));
  return { type: 'FeatureCollection', features, meta: { total: items.length, mapped: features.length } };
}

function toSeries(items) {
  return items.map(x => ({ id: x.id, name: x.name, kind: x.kind, type: x.type, country: x.country }));
}

function toCSV(items) {
  const lines = ['id,name,kind,type,country,capacity,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const x of items) lines.push([x.id, x.name, x.kind, x.type, x.country, x.capacity, x.lat, x.lng].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/route-explorer/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { ports, chokepoints, routes } = extractAll(doc);
    const extra = {
      'X-Module': 'route-explorer-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(ports, chokepoints, routes, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/ports')       return sendJSON(res, 200, { ports: applyFilters(ports, query), total: ports.length }, extra);
    if (sub === '/chokepoints') return sendJSON(res, 200, { chokepoints: applyFilters(chokepoints, query), total: chokepoints.length }, extra);
    if (sub === '/routes')      return sendJSON(res, 200, { routes, total: routes.length }, extra);
    if (sub === '/featurecollection') return sendJSON(res, 200, toFeatureCollection(ports.concat(chokepoints)), extra);

    const fPorts = applyFilters(ports, query);
    const fChokes = applyFilters(chokepoints, query);
    const allPoints = fPorts.concat(fChokes);

    if (format === 'csv')    return sendText(res, 200, toCSV(allPoints), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(allPoints) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    const fc = toFeatureCollection(allPoints);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_ports: ports.length, total_chokepoints: chokepoints.length, total_routes: routes.length,
        returned_ports: fPorts.length, returned_chokepoints: fChokes.length,
        generated_at: new Date().toISOString(), source_updated_at: doc._meta?.updated_at || null,
      },
      features: fc.features,
      ports: fPorts,
      chokepoints: fChokes,
      routes,
      series: toSeries(allPoints),
      stats: computeStats(fPorts, fChokes, routes, doc),
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
