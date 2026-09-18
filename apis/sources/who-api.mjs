/**
 * apis/sources/who-api.mjs — API-МОДУЛЬ: ЗДРАВООХРАНЕНИЕ (WHO)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/who.json — FeatureCollection { properties: { name, value, label, unit } }.
 * Сборщик: scripts/collectors/collect-who.mjs.
 *
 * Данные ВОЗ — оповещения о вспышках заболеваний по странам.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?min=, ?country=, ?sort=desc|asc, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'who.json');

export const route  = '/api/layers/who';
export const method = 'GET';

export const meta = {
  category: 'health',
  icon: '🏥',
  color: '#ff44aa',
  vizType: 'marker',
  source: 'basket/who.json',
  collector: 'collect-who.mjs',
  cache: 3600,
  description: 'Данные ВОЗ — оповещения о вспышках заболеваний по странам',
  unit: 'alerts',
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
  'Нигерия': { lat: 9.0820, lng: 8.6753 }, 'Египет': { lat: 30.0444, lng: 31.2357 },
  'ЮАР': { lat: -25.7479, lng: 28.2293 }, 'Индонезия': { lat: -0.7893, lng: 113.9213 },
  'Пакистан': { lat: 30.3753, lng: 69.3451 }, 'Иран': { lat: 32.4279, lng: 53.6880 },
  'Украина': { lat: 50.4501, lng: 30.5234 }, 'Польша': { lat: 52.2297, lng: 21.0122 },
};

function alertBand(value) {
  if (value >= 100) return { level: 'critical', color: '#7f1d1d', label: 'Критический' };
  if (value >= 50)  return { level: 'high',     color: '#dc2626', label: 'Высокий' };
  if (value >= 20)  return { level: 'medium',   color: '#f97316', label: 'Средний' };
  if (value >= 5)   return { level: 'low',      color: '#eab308', label: 'Низкий' };
  return                  { level: 'info',     color: '#22c55e', label: 'Информационный' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-who.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && parsed.data && Array.isArray(parsed.data.alerts)) arr = parsed.data.alerts;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const p = (r && r.type === 'Feature') ? (r.properties || {}) : r;
    const name = p.name || p.country || 'Unknown';
    const value = Number(p.value ?? p.alerts ?? 0);
    const c = COUNTRY_COORDS[name] || { lat: 0, lng: 0 };
    return {
      name, value,
      label: p.label || 'alerts',
      unit: p.unit || '',
      hasCoords: c.lat !== 0 || c.lng !== 0,
      coords: c,
    };
  }).filter(r => r.name && Number.isFinite(r.value));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min != null) { const n = parseFloat(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
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
  const total = v.reduce((a, b) => a + b, 0);
  const byBand = {};
  for (const r of rows) { const b = alertBand(r.value).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice(0, 5).map(r => ({ name: r.name, value: +r.value.toFixed(2) }));
  return { count: rows.length, min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2), total: +total.toFixed(2), by_band: byBand, top_5: top5 };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.hasCoords).map(r => {
    const b = alertBand(r.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.coords.lng, r.coords.lat] },
      properties: {
        name: r.name, value: r.value, unit: r.unit,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'health', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'critical', label: 'Критический (100+)',  color: '#7f1d1d' },
      { level: 'high',     label: 'Высокий (50+)',       color: '#dc2626' },
      { level: 'medium',   label: 'Средний (20+)',       color: '#f97316' },
      { level: 'low',      label: 'Низкий (5+)',         color: '#eab308' },
      { level: 'info',     label: 'Информационный',      color: '#22c55e' },
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
  for (const r of rows) { const b = alertBand(r.value); lines.push(`${r.name},${r.value},${r.unit},${b.level},${b.label}`); }
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
    const extra = { 'X-Module': 'who-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
