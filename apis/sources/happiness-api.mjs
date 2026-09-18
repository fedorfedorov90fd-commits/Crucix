/**
 * apis/sources/happiness-api.mjs — API-МОДУЛЬ: ИНДЕКС СЧАСТЬЯ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/happiness.json — FeatureCollection { properties: { name, value, label, unit } }.
 * Сборщик: scripts/collectors/collect-happiness.mjs.
 *
 * World Happiness Report — субъективное благополучие по странам (0-10).
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?min=, ?max=, ?country=, ?sort=desc|asc, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'happiness.json');

export const route  = '/api/layers/happiness';
export const method = 'GET';

export const meta = {
  category: 'esg',
  icon: '😊',
  color: '#22c55e',
  vizType: 'marker',
  source: 'basket/happiness.json',
  collector: 'collect-happiness.mjs',
  cache: 3600,
  description: 'Индекс счастья (World Happiness Report) — 0-10',
  unit: 'score',
};

const COUNTRY_COORDS = {
  'США': { lat: 38.9072, lng: -77.0369 }, 'Россия': { lat: 55.7558, lng: 37.6173 },
  'Китай': { lat: 39.9042, lng: 116.4074 }, 'Германия': { lat: 52.5200, lng: 13.4050 },
  'Франция': { lat: 48.8566, lng: 2.3522 }, 'Япония': { lat: 35.6762, lng: 139.6503 },
  'Великобритания': { lat: 51.5074, lng: -0.1278 }, 'Индия': { lat: 28.6139, lng: 77.2090 },
  'Бразилия': { lat: -15.7975, lng: -47.8919 }, 'Канада': { lat: 45.4215, lng: -75.6972 },
  'Австралия': { lat: -33.8688, lng: 151.2093 }, 'Южная Корея': { lat: 37.5665, lng: 126.9780 },
  'Мексика': { lat: 19.4326, lng: -99.1332 }, 'Италия': { lat: 41.9028, lng: 12.4964 },
  'Испания': { lat: 40.4168, lng: -3.7038 }, 'Турция': { lat: 39.9334, lng: 32.8597 },
  'Нидерланды': { lat: 52.3676, lng: 4.9041 }, 'Швейцария': { lat: 46.9481, lng: 7.4474 },
  'Швеция': { lat: 59.3293, lng: 18.0686 }, 'Польша': { lat: 52.2297, lng: 21.0122 },
  'Финляндия': { lat: 60.1699, lng: 24.9384 }, 'Норвегия': { lat: 59.9139, lng: 10.7522 },
  'Дания': { lat: 55.6761, lng: 12.5683 }, 'Исландия': { lat: 64.1466, lng: -21.9426 },
  'Израиль': { lat: 31.7683, lng: 35.2137 }, 'Аргентина': { lat: -34.6037, lng: -58.3816 },
  'ЮАР': { lat: -25.7479, lng: 28.2293 },
};

function happinessBand(score) {
  if (score >= 7.5) return { level: 'excellent', color: '#22c55e', label: 'Отличный' };
  if (score >= 6.5) return { level: 'high',      color: '#84cc16', label: 'Высокий' };
  if (score >= 5.5) return { level: 'medium',    color: '#eab308', label: 'Средний' };
  if (score >= 4.5) return { level: 'low',       color: '#f97316', label: 'Низкий' };
  return              { level: 'very_low',  color: '#dc2626', label: 'Очень низкий' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-happiness.mjs'; throw err;
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
    const p = (r && r.type === 'Feature') ? (r.properties || {}) : r;
    const name = p.name || p.country || 'Unknown';
    const value = Number(p.value ?? p.score);
    const coords = COUNTRY_COORDS[name] || { lat: 0, lng: 0 };
    return { name, value, unit: p.unit || '', hasCoords: coords.lat !== 0 || coords.lng !== 0, coords };
  }).filter(r => r.name && Number.isFinite(r.value));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min != null) { const n = parseFloat(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = parseFloat(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(c)); }
  if (query.sort === 'asc') r.sort((a, b) => a.value - b.value); else r.sort((a, b) => b.value - a.value);
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const byBand = {};
  for (const r of rows) { const b = happinessBand(r.value).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice(0, 5).map(r => ({ name: r.name, value: +r.value.toFixed(2) }));
  const bottom5 = rows.slice().sort((a, b) => a.value - b.value).slice(0, 5).map(r => ({ name: r.name, value: +r.value.toFixed(2) }));
  return { count: rows.length, min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2), by_band: byBand, top_5: top5, bottom_5: bottom5 };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.hasCoords).map(r => {
    const b = happinessBand(r.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.coords.lng, r.coords.lat] },
      properties: {
        name: r.name, value: r.value, unit: r.unit,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'esg', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'excellent', label: 'Отличный (7.5+)',    color: '#22c55e' },
      { level: 'high',      label: 'Высокий (6.5-7.5)',  color: '#84cc16' },
      { level: 'medium',    label: 'Средний (5.5-6.5)',  color: '#eab308' },
      { level: 'low',       label: 'Низкий (4.5-5.5)',   color: '#f97316' },
      { level: 'very_low',  label: 'Очень низкий (<4.5)',color: '#dc2626' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
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
  const lines = ['name,value,unit,band,label'];
  for (const r of rows) { const b = happinessBand(r.value); lines.push(`${r.name},${r.value},${r.unit},${b.level},${b.label}`); }
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
    const extra = { 'X-Module': 'happiness-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
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
