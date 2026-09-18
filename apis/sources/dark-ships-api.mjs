/**
 * apis/sources/dark-ships-api.mjs — API-МОДУЛЬ: ТЁМНЫЕ СУДА
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/dark-ships.json — FeatureCollection судов с выключенным AIS.
 * Сборщик: scripts/collectors/collect-dark-ships-real.mjs.
 *
 * Суда, выключившие транспондеры. Подозрительная активность в стратегических зонах.
 * Отличие от dark-fleet-api: dark-fleet — временной ряд по портам, dark-ships — конкретные суда-нарушители.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'dark-ships.json');

export const route  = '/api/layers/dark-ships';
export const method = 'GET';

export const meta = {
  category: 'transport',
  icon: '🚢',
  color: '#ff2200',
  vizType: 'marker',
  source: 'basket/dark-ships.json',
  collector: 'collect-dark-ships-real.mjs',
  cache: 300,
  description: 'Тёмные суда — суда с выключенным AIS, подозрительная активность',
  unit: 'vessels',
};

const TYPE_STYLE = {
  'cargo':     { color: '#3b82f6', icon: '🚢', label: 'Грузовое' },
  'tanker':    { color: '#f97316', icon: '🛢️', label: 'Танкер' },
  'fishing':   { color: '#22c55e', icon: '🎣', label: 'Рыболовное' },
  'military':  { color: '#dc2626', icon: '⚓', label: 'Военное' },
  'passenger': { color: '#8b5cf6', icon: '⛴️', label: 'Пассажирское' },
  'unknown':   { color: '#64748b', icon: '❓', label: 'Неизвестно' },
};

const SEVERITY_COLOR = { 'INFO': '#22c55e', 'LOW': '#84cc16', 'MEDIUM': '#eab308', 'HIGH': '#f97316', 'CRITICAL': '#dc2626' };

const ZONE_COORDS = {
  'strait-of-hormuz': { lat: 26.5, lng: 56.0, name: 'Ормузский пролив' },
  'bab-el-mandeb':    { lat: 13.0, lng: 43.5, name: 'Баб-эль-Мандеб' },
  'suez-canal':       { lat: 30.0, lng: 32.5, name: 'Суэцкий канал' },
  'panama-canal':     { lat:  9.0, lng: -79.5, name: 'Панамский канал' },
  'malacca-strait':   { lat:  1.5, lng: 102.5, name: 'Малаккский пролив' },
  'bosphorus':        { lat: 41.1, lng: 29.0, name: 'Босфор' },
  'baltic-sea':       { lat: 55.0, lng: 18.0, name: 'Балтийское море' },
  'south-china-sea':  { lat: 15.0, lng: 115.0, name: 'Южно-Китайское море' },
  'black-sea':        { lat: 43.0, lng: 31.0, name: 'Чёрное море' },
  'gulf-of-aden':     { lat: 12.0, lng: 48.0, name: 'Аденский залив' },
};

async function loadShips() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-dark-ships-real.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && parsed.data && Array.isArray(parsed.data.ships)) arr = parsed.data.ships;
  else if (parsed && Array.isArray(parsed.ships)) arr = parsed.ships;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        name: p.name || p.id || 'Unknown',
        type: String(p.type || 'unknown').toLowerCase(),
        status: p.status || 'suspicious',
        severity: String(p.severity || 'HIGH').toUpperCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        zone: p.zone || null,
        imo: p.imo || null, mmsi: p.mmsi || null,
        flag: p.flag || null,
        lastSeen: p.lastSeen || p.timestamp || null,
        detectedAt: p.detectedAt || null,
      };
    }
    return {
      name: r.name || r.id || 'Unknown',
      type: String(r.type || 'unknown').toLowerCase(),
      status: r.status || 'suspicious',
      severity: String(r.severity || 'HIGH').toUpperCase(),
      lat: Number(r.lat ?? r.latitude), lng: Number(r.lng ?? r.lon ?? r.longitude),
      zone: r.zone || null, imo: r.imo || null, mmsi: r.mmsi || null,
      flag: r.flag || null,
      lastSeen: r.lastSeen || r.timestamp || null,
      detectedAt: r.detectedAt || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type) r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.status) { const s = String(query.status).toLowerCase(); r = r.filter(x => x.status.toLowerCase() === s); }
  if (query.zone) { const z = String(query.zone).toLowerCase(); r = r.filter(x => (x.zone || '').toLowerCase().includes(z)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byType = {}, bySeverity = {}, byZone = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.zone) byZone[r.zone] = (byZone[r.zone] || 0) + 1;
  }
  const top_zones = Object.entries(byZone).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([zone, count]) => ({ zone, count }));
  return { count: rows.length, by_type: byType, by_severity: bySeverity, by_zone: byZone, top_zones };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const style = TYPE_STYLE[r.type] || TYPE_STYLE.unknown;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name, type: r.type, typeLabel: style.label,
        status: r.status, severity: r.severity,
        zone: r.zone, imo: r.imo, mmsi: r.mmsi, flag: r.flag,
        lastSeen: r.lastSeen, detectedAt: r.detectedAt,
        color: SEVERITY_COLOR[r.severity] || style.color,
        icon: style.icon,
        category: 'transport',
      },
    };
  });
  return {
    type: 'FeatureCollection',
    types: Object.entries(TYPE_STYLE).map(([k, v]) => ({ type: k, ...v })),
    zones: Object.entries(ZONE_COORDS).map(([id, z]) => ({ id, ...z })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_ships: full.length, returned_ships: filtered.length,
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
  const lines = ['name,type,status,severity,zone,imo,mmsi,flag,lat,lng,lastSeen'];
  for (const r of rows) lines.push(`"${r.name.replace(/"/g, '""')}",${r.type},${r.status},${r.severity},${r.zone || ''},${r.imo || ''},${r.mmsi || ''},${r.flag || ''},${r.lat},${r.lng},${r.lastSeen || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadShips();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'dark-ships-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      types: fc.types,
      zones: fc.zones,
      features: fc.features,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
