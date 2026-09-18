/**
 * apis/sources/social-unrest-api.mjs — API-МОДУЛЬ: СОЦИАЛЬНЫЕ ПРОТЕСТЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/social-unrest.json — массив { country, intensity, lat, lng, region, timestamp }.
 * Сборщик: scripts/collectors/collect-social-unrest.mjs.
 *
 * Социальная напряжённость и протесты по странам мира. Intensity: 1-5.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'social-unrest.json');

export const route  = '/api/layers/social-unrest';
export const method = 'GET';

export const meta = {
  category: 'social',
  icon: '🔥',
  color: '#ff4400',
  vizType: 'marker',
  source: 'basket/social-unrest.json',
  collector: 'collect-social-unrest.mjs',
  cache: 300,
  description: 'Социальная напряжённость и протесты по странам',
  unit: 'intensity',
};

function intensityLevel(n) {
  if (n >= 5) return { level: 'critical', color: '#7f1d1d', label: 'Критический' };
  if (n >= 4) return { level: 'high',     color: '#dc2626', label: 'Высокий' };
  if (n >= 3) return { level: 'medium',   color: '#f97316', label: 'Средний' };
  if (n >= 2) return { level: 'low',      color: '#eab308', label: 'Низкий' };
  return           { level: 'info',     color: '#22c55e', label: 'Информационный' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-social-unrest.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        country: p.country || p.name || 'Unknown',
        intensity: Number(p.intensity ?? p.value ?? 1),
        region: p.region || null,
        lat: Number(coords[1]), lng: Number(coords[0]),
        event: p.event || null,
        casualties: p.casualties != null ? Number(p.casualties) : null,
        timestamp: p.timestamp || null,
      };
    }
    return {
      country: r.country || r.name || 'Unknown',
      intensity: Number(r.intensity ?? r.value ?? 1),
      region: r.region || null,
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      event: r.event || null,
      casualties: r.casualties != null ? Number(r.casualties) : null,
      timestamp: r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.intensity - a.intensity);
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.region) { const g = String(query.region).toLowerCase(); r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => x.country.toLowerCase().includes(c)); }
  if (query.min_intensity != null) { const n = parseFloat(query.min_intensity); if (Number.isFinite(n)) r = r.filter(x => x.intensity >= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byLevel = {}, byRegion = {}, byCountry = {};
  let totalIntensity = 0;
  for (const r of rows) {
    const lvl = intensityLevel(r.intensity).level;
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    if (r.region) byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    totalIntensity += r.intensity;
  }
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    avg_intensity: +(totalIntensity / rows.length).toFixed(2),
    max_intensity: Math.max(...rows.map(r => r.intensity)),
    by_level: byLevel,
    by_region: byRegion,
    top_countries,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const lvl = intensityLevel(r.intensity);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        country: r.country, region: r.region,
        intensity: r.intensity, intensityLevel: lvl.level, intensityLabel: lvl.label,
        event: r.event, casualties: r.casualties, timestamp: r.timestamp,
        color: lvl.color,
        category: 'social', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'info',     label: 'Информационный (1)', color: '#22c55e' },
      { level: 'low',      label: 'Низкий (2)',         color: '#eab308' },
      { level: 'medium',   label: 'Средний (3)',        color: '#f97316' },
      { level: 'high',     label: 'Высокий (4)',        color: '#dc2626' },
      { level: 'critical', label: 'Критический (5+)',   color: '#7f1d1d' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_countries: full.length, returned_countries: filtered.length,
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
  const lines = ['country,region,intensity,intensityLevel,lat,lng,timestamp'];
  for (const r of rows) { const lvl = intensityLevel(r.intensity); lines.push(`${r.country},${r.region || ''},${r.intensity},${lvl.level},${r.lat},${r.lng},${r.timestamp || ''}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadData();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'social-unrest-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
