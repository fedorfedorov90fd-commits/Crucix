/**
 * apis/sources/epidemics-api.mjs — API-МОДУЛЬ: ЭПИДЕМИИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/epidemics.json — массив { country, value, date }.
 * Резервный: data/basket/covid.json — FeatureCollection.
 * Сборщик: scripts/collectors/collect-covid.mjs.
 *
 * Эпидемиологические данные по странам: случаи, распространение.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/epidemics';
export const method = 'GET';

export const meta = {
  category: 'health',
  icon: '🦠',
  color: '#dc2626',
  vizType: 'choropleth',
  source: 'basket/epidemics.json',
  collector: 'collect-covid.mjs',
  cache: 3600,
  description: 'Эпидемиологические данные по странам (случаи, распространение)',
  unit: 'cases',
};

const COUNTRY_COORDS = {
  'США': { lat: 38.9072, lng: -77.0369 }, 'Россия': { lat: 55.7558, lng: 37.6173 },
  'Китай': { lat: 39.9042, lng: 116.4074 }, 'Индия': { lat: 28.6139, lng: 77.2090 },
  'Бразилия': { lat: -15.7975, lng: -47.8919 }, 'Великобритания': { lat: 51.5074, lng: -0.1278 },
  'Германия': { lat: 52.5200, lng: 13.4050 }, 'Франция': { lat: 48.8566, lng: 2.3522 },
  'Япония': { lat: 35.6762, lng: 139.6503 }, 'Канада': { lat: 45.4215, lng: -75.6972 },
  'Австралия': { lat: -33.8688, lng: 151.2093 }, 'Италия': { lat: 41.9028, lng: 12.4964 },
  'Испания': { lat: 40.4168, lng: -3.7038 }, 'Мексика': { lat: 19.4326, lng: -99.1332 },
  'Иран': { lat: 35.6892, lng: 51.3890 }, 'Турция': { lat: 39.9334, lng: 32.8597 },
  'ЮАР': { lat: -25.7479, lng: 28.2293 }, 'Польша': { lat: 52.2297, lng: 21.0122 },
};

function casesBand(value) {
  if (value >= 1000000) return { level: 'mega',     color: '#7f1d1d', label: 'Мега (1M+)' };
  if (value >= 100000)  return { level: 'critical', color: '#dc2626', label: 'Критический (100K+)' };
  if (value >= 10000)   return { level: 'high',     color: '#f97316', label: 'Высокий (10K+)' };
  if (value >= 1000)    return { level: 'medium',   color: '#eab308', label: 'Средний (1K+)' };
  if (value >= 100)     return { level: 'low',      color: '#84cc16', label: 'Низкий (100+)' };
  return                       { level: 'minimal', color: '#22c55e', label: 'Минимальный' };
}

async function loadData() {
  let raw = null, fileUsed = null, parsed = null;
  for (const f of ['epidemics.json', 'covid.json']) {
    try { raw = await fs.readFile(join(BASKET_DIR, f), 'utf8'); parsed = JSON.parse(raw); fileUsed = f; break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-covid.mjs'; throw err;
  }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.countries)) arr = parsed.countries;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const p = (r && r.type === 'Feature') ? (r.properties || {}) : r;
    const country = p.country || p.name || 'Unknown';
    const value = Number(p.value ?? p.cases ?? p.confirmed ?? 0);
    const coords = COUNTRY_COORDS[country] || { lat: 0, lng: 0 };
    return {
      country,
      value,
      label: p.label || 'cases',
      unit: p.unit || '',
      date: p.date || null,
      hasCoords: coords.lat !== 0 || coords.lng !== 0,
      coords,
    };
  }).filter(r => r.country !== 'Unknown' && Number.isFinite(r.value));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.value - a.value);
  return { epidemics: clean, fileUsed };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max_value != null) { const n = parseFloat(query.max_value); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => x.country.toLowerCase().includes(c)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const total = v.reduce((a, b) => a + b, 0);
  const byBand = {};
  for (const r of rows) { const b = casesBand(r.value).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice(0, 5).map(r => ({ country: r.country, value: r.value }));
  return {
    count: rows.length,
    total: total,
    min: Math.min(...v),
    max: Math.max(...v),
    by_band: byBand,
    top_5: top5,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.hasCoords).map(r => {
    const b = casesBand(r.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.coords.lng, r.coords.lat] },
      properties: {
        country: r.country, value: r.value, label: r.label, unit: r.unit, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'health', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'mega',     label: 'Мега (1M+)',     color: '#7f1d1d' },
      { level: 'critical', label: 'Критический (100K+)', color: '#dc2626' },
      { level: 'high',     label: 'Высокий (10K+)', color: '#f97316' },
      { level: 'medium',   label: 'Средний (1K+)',  color: '#eab308' },
      { level: 'low',      label: 'Низкий (100+)',  color: '#84cc16' },
      { level: 'minimal',  label: 'Минимальный',    color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered, fileUsed) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_file: fileUsed,
    total_countries: full.length, returned_countries: filtered.length,
    coords_available: filtered.filter(r => r.hasCoords).length,
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
  const lines = ['country,value,band,label'];
  for (const r of rows) { const b = casesBand(r.value); lines.push(`${r.country},${r.value},${b.level},${r.label}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadData();
    const rows = applyFilters(loaded.epidemics, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'epidemics-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.epidemics, rows, loaded.fileUsed) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.epidemics, rows, loaded.fileUsed) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.epidemics, rows, loaded.fileUsed),
      bands: fc.bands,
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
