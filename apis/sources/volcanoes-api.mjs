/**
 * apis/sources/volcanoes-api.mjs — API-МОДУЛЬ: ВУЛКАНЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/volcanoes.json — массив { id, name, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-volcanoes.mjs.
 *
 * Активные вулканы мира. Источник — Smithsonian GVP, USGS.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'volcanoes.json');

export const route  = '/api/layers/volcanoes';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🌋',
  color: '#ff4400',
  vizType: 'marker',
  source: 'basket/volcanoes.json',
  collector: 'collect-volcanoes.mjs',
  cache: 600,
  description: 'Активные вулканы мира (Smithsonian GVP, USGS)',
  unit: 'volcanoes',
};

function alertLevel(sev) {
  const map = {
    'critical': { level: 'red',    color: '#7f1d1d', label: 'Красный' },
    'high':     { level: 'orange', color: '#dc2626', label: 'Оранжевый' },
    'medium':   { level: 'yellow', color: '#f97316', label: 'Жёлтый' },
    'low':      { level: 'green',  color: '#eab308', label: 'Зелёный' },
    'info':     { level: 'normal', color: '#22c55e', label: 'Норма' },
  };
  return map[sev] || map.info;
}

async function loadVolcanoes() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-volcanoes.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.volcanoes)) arr = parsed.volcanoes;
  else if (parsed && Array.isArray(parsed.data))      arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        id: p.id || r.id || 'unknown',
        name: p.name || 'Unknown',
        country: p.country || null,
        elevation: p.elevation != null ? Number(p.elevation) : null,
        alertLevel: p.alertLevel || null,
        severity: String(p.severity || 'info').toLowerCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        lastEruption: p.lastEruption || null,
        timestamp: p.timestamp || null,
      };
    }
    return {
      id: r.id || 'unknown',
      name: r.name || 'Unknown',
      country: r.country || null,
      elevation: r.elevation != null ? Number(r.elevation) : null,
      alertLevel: r.alertLevel || null,
      severity: String(r.severity || 'info').toLowerCase(),
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      lastEruption: r.lastEruption || null,
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
  if (query.min_elevation != null) { const n = parseFloat(query.min_elevation); if (Number.isFinite(n)) r = r.filter(x => (x.elevation || 0) >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byLevel = {}, byCountry = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    const lvl = alertLevel(r.severity).level;
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const withElev = rows.filter(r => r.elevation != null);
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    max_elevation: withElev.length > 0 ? Math.max(...withElev.map(r => r.elevation)) : 0,
    by_severity: bySeverity,
    by_level: byLevel,
    by_country: byCountry,
    top_countries,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const lvl = alertLevel(r.severity);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, country: r.country, elevation: r.elevation,
        alertLevel: r.alertLevel, severity: r.severity, lastEruption: r.lastEruption,
        timestamp: r.timestamp,
        level: lvl.level, levelLabel: lvl.label, color: lvl.color,
        category: 'ecological', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    levels: [
      { level: 'red',    label: 'Красный',   color: '#7f1d1d' },
      { level: 'orange', label: 'Оранжевый', color: '#dc2626' },
      { level: 'yellow', label: 'Жёлтый',    color: '#f97316' },
      { level: 'green',  label: 'Зелёный',   color: '#eab308' },
      { level: 'normal', label: 'Норма',     color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_volcanoes: full.length, returned_volcanoes: filtered.length,
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
  const lines = ['id,name,country,severity,alertLevel,elevation,lat,lng'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.country || ''},${r.severity},${r.alertLevel || ''},${r.elevation ?? ''},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadVolcanoes();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'volcanoes-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      levels: fc.levels,
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
