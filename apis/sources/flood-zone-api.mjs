/**
 * apis/sources/flood-zone-api.mjs — API-МОДУЛЬ: ЗОНЫ НАВОДНЕНИЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/flood-zone.json — массив { label, value, country, lat, lng }.
 * Сборщик: scripts/collectors/collect-flood-zones.mjs.
 *
 * Зоны риска наводнений. Value 1-5. Статический справочник.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'flood-zone.json');

export const route  = '/api/layers/flood-zone';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🌊',
  color: '#0066ff',
  vizType: 'marker',
  source: 'basket/flood-zone.json',
  collector: 'collect-flood-zones.mjs',
  cache: 3600,
  description: 'Зоны риска наводнений (статический справочник)',
  unit: 'risk_level',
};

function zoneLevel(value) {
  if (value >= 5) return { level: 'extreme', color: '#7f1d1d', label: 'Экстремальный' };
  if (value >= 4) return { level: 'high',    color: '#dc2626', label: 'Высокий' };
  if (value >= 3) return { level: 'medium',  color: '#f97316', label: 'Средний' };
  if (value >= 2) return { level: 'low',     color: '#eab308', label: 'Низкий' };
  return                 { level: 'minor',  color: '#22c55e', label: 'Минимальный' };
}

async function loadZones() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-flood-zones.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.zones)) arr = parsed.zones;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        label: p.label || p.name || 'Unknown',
        value: Number(p.value ?? p.risk ?? 1),
        country: p.country || null,
        lat: Number(coords[1]), lng: Number(coords[0]),
        description: p.description || null,
      };
    }
    return {
      label: r.label || r.name || 'Unknown',
      value: Number(r.value ?? r.risk ?? 1),
      country: r.country || null,
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      description: r.description || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.value - a.value);
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.label.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const byLevel = {}, byCountry = {};
  for (const r of rows) {
    const lvl = zoneLevel(r.value).level;
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const top_zones = rows.slice(0, 5).map(r => ({ label: r.label, value: r.value }));
  return { count: rows.length, max: Math.max(...v), min: Math.min(...v), by_level: byLevel, by_country: byCountry, top_zones };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const lvl = zoneLevel(r.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        label: r.label, country: r.country, value: r.value,
        level: lvl.level, levelLabel: lvl.label,
        description: r.description,
        color: lvl.color,
        category: 'ecological', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'extreme', label: 'Экстремальный (5)', color: '#7f1d1d' },
      { level: 'high',    label: 'Высокий (4)',       color: '#dc2626' },
      { level: 'medium',  label: 'Средний (3)',       color: '#f97316' },
      { level: 'low',     label: 'Низкий (2)',        color: '#eab308' },
      { level: 'minor',   label: 'Минимальный (1)',   color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_zones: full.length, returned_zones: filtered.length,
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
  const lines = ['label,country,value,level,lat,lng'];
  for (const r of rows) { const lvl = zoneLevel(r.value); lines.push(`"${r.label.replace(/"/g, '""')}",${r.country || ''},${r.value},${lvl.level},${r.lat},${r.lng}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadZones();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'flood-zone-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
