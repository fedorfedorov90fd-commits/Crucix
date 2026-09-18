/**
 * apis/sources/wildfires-api.mjs — API-МОДУЛЬ: ЛЕСНЫЕ ПОЖАРЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/wildfires.json — массив { id, name, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-fires.mjs.
 *
 * Лесные пожары. Источник — NASA FIRMS, EFFIS, CalFire.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'wildfires.json');

export const route  = '/api/layers/wildfires';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🔥',
  color: '#ff2200',
  vizType: 'marker',
  source: 'basket/wildfires.json',
  collector: 'collect-fires.mjs',
  cache: 300,
  description: 'Лесные пожары (NASA FIRMS, EFFIS, CalFire)',
  unit: 'fires',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

async function loadFires() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-fires.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.fires)) arr = parsed.fires;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        id: p.id || r.id || 'unknown',
        name: p.name || 'Unknown',
        severity: String(p.severity || 'medium').toLowerCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        area: p.area != null ? Number(p.area) : null,
        brightness: p.brightness != null ? Number(p.brightness) : null,
        confidence: p.confidence != null ? Number(p.confidence) : null,
        country: p.country || null,
        timestamp: p.timestamp || null,
      };
    }
    return {
      id: r.id || 'unknown',
      name: r.name || 'Unknown',
      severity: String(r.severity || 'medium').toLowerCase(),
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      area: r.area != null ? Number(r.area) : null,
      brightness: r.brightness != null ? Number(r.brightness) : null,
      confidence: r.confidence != null ? Number(r.confidence) : null,
      country: r.country || null,
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.min_area != null) { const n = parseFloat(query.min_area); if (Number.isFinite(n)) r = r.filter(x => (x.area || 0) >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byCountry = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const withArea = rows.filter(r => r.area != null);
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    total_area: withArea.length > 0 ? withArea.reduce((a, b) => a + b.area, 0) : 0,
    max_area: withArea.length > 0 ? Math.max(...withArea.map(r => r.area)) : 0,
    by_severity: bySeverity,
    by_country: byCountry,
    top_countries,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, severity: r.severity, area: r.area,
      brightness: r.brightness, confidence: r.confidence, country: r.country, timestamp: r.timestamp,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.medium,
      category: 'ecological', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: Object.entries(SEVERITY_COLOR).map(([severity, color]) => ({ severity, color })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_fires: full.length, returned_fires: filtered.length,
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
  const lines = ['id,name,severity,area,brightness,confidence,country,lat,lng'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.severity},${r.area ?? ''},${r.brightness ?? ''},${r.confidence ?? ''},${r.country || ''},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadFires();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'wildfires-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      legend: fc.legend,
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
