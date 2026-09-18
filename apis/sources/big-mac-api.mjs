/**
 * apis/sources/big-mac-api.mjs — API-МОДУЛЬ: ИНДЕКС БИГ-МАКА
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/big-mac.json — FeatureCollection с features.properties { name, value, label, unit }.
 * Сборщик: scripts/collectors/collect-big-mac.mjs.
 *
 * Индекс Биг-Мака — неофициальный индекс паритета покупательной способности.
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
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'big-mac.json');

export const route  = '/api/layers/big-mac';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '🍔',
  color: '#ff8800',
  vizType: 'marker',
  source: 'basket/big-mac.json',
  collector: 'collect-big-mac.mjs',
  cache: 3600,
  description: 'Индекс Биг-Мака — цена бургера в странах (неофициальный PPP)',
  unit: '$',
};

// Координаты столиц (по названию страны). Базовый набор.
const COUNTRY_COORDS = {
  'США':         { lat: 38.9072, lng:  -77.0369 },
  'Россия':      { lat: 55.7558, lng:   37.6173 },
  'Китай':       { lat: 39.9042, lng:  116.4074 },
  'Германия':    { lat: 52.5200, lng:   13.4050 },
  'Франция':     { lat: 48.8566, lng:    2.3522 },
  'Япония':      { lat: 35.6762, lng:  139.6503 },
  'Великобритания': { lat: 51.5074, lng: -0.1278 },
  'Индия':       { lat: 28.6139, lng:   77.2090 },
  'Бразилия':    { lat: -15.7975, lng: -47.8919 },
  'Канада':      { lat: 45.4215, lng:  -75.6972 },
  'Австралия':   { lat: -33.8688, lng: 151.2093 },
  'Южная Корея': { lat: 37.5665, lng:  126.9780 },
  'Мексика':     { lat: 19.4326, lng:  -99.1332 },
  'Италия':      { lat: 41.9028, lng:   12.4964 },
  'Испания':     { lat: 40.4168, lng:   -3.7038 },
  'Турция':      { lat: 39.9334, lng:   32.8597 },
  'Нидерланды':  { lat: 52.3676, lng:    4.9041 },
  'Швейцария':   { lat: 46.9481, lng:    7.4474 },
  'Швеция':      { lat: 59.3293, lng:   18.0686 },
  'Польша':      { lat: 52.2297, lng:   21.0122 },
  'Аргентина':   { lat: -34.6037, lng: -58.3816 },
  'ЮАР':         { lat: -25.7479, lng:  28.2293 },
  'Египет':      { lat: 30.0444, lng:   31.2357 },
  'Саудовская Аравия': { lat: 24.7136, lng: 46.6753 },
  'ОАЭ':         { lat: 24.4539, lng:   54.3773 },
  'Таиланд':     { lat: 13.7563, lng:  100.5018 },
  'Вьетнам':     { lat: 21.0285, lng:  105.8542 },
  'Индонезия':   { lat: -6.2088, lng:  106.8456 },
  'Малайзия':    { lat:  3.1390, lng:  101.6869 },
  'Филиппины':   { lat: 14.5995, lng:  120.9842 },
  'Колумбия':    { lat:  4.7110, lng:  -74.0721 },
  'Чили':        { lat: -33.4489, lng:  -70.6693 },
  'Украина':     { lat: 50.4501, lng:   30.5234 },
  'Израиль':     { lat: 31.7683, lng:   35.2137 },
};

function priceBand(value) {
  if (value <= 2) return { level: 'very_cheap', color: '#22c55e', label: 'Очень дешёво' };
  if (value <= 4) return { level: 'cheap',      color: '#84cc16', label: 'Дёшево' };
  if (value <= 6) return { level: 'mid',        color: '#eab308', label: 'Средне' };
  if (value <= 8) return { level: 'expensive',  color: '#f97316', label: 'Дорого' };
  return              { level: 'very_expensive', color: '#dc2626', label: 'Очень дорого' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-big-mac.mjs'; throw err;
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
    const value = Number(p.value ?? p.price ?? p.usd);
    const coords = COUNTRY_COORDS[name] || { lat: 0, lng: 0 };
    const geometry = (r && r.type === 'Feature' && r.geometry && r.geometry.coordinates && r.geometry.coordinates[0] !== 0)
      ? r.geometry
      : { type: 'Point', coordinates: [coords.lng, coords.lat] };
    return {
      name,
      value,
      unit: p.unit || '$',
      geometry,
      hasCoords: coords.lat !== 0 || coords.lng !== 0,
    };
  }).filter(r => r.name && Number.isFinite(r.value));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min != null) { const n = parseFloat(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = parseFloat(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(c)); }
  if (query.sort === 'asc') r.sort((a, b) => a.value - b.value);
  else r.sort((a, b) => b.value - a.value);
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const byBand = {};
  for (const r of rows) { const b = priceBand(r.value).level; byBand[b] = (byBand[b] || 0) + 1; }
  const sorted = v.slice().sort((a, b) => a - b);
  const median = sorted.length % 2 === 0 ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2 : sorted[Math.floor(sorted.length/2)];
  const top5 = rows.slice(0, 5).map(r => ({ name: r.name, value: +r.value.toFixed(2) }));
  const bottom5 = rows.slice().sort((a, b) => a.value - b.value).slice(0, 5).map(r => ({ name: r.name, value: +r.value.toFixed(2) }));
  return { count: rows.length, min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2), median: +median.toFixed(2), by_band: byBand, top_5: top5, bottom_5: bottom5 };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const b = priceBand(r.value);
    return {
      type: 'Feature',
      geometry: r.geometry,
      properties: {
        name: r.name,
        value: r.value,
        unit: r.unit,
        band: b.level,
        bandLabel: b.label,
        color: b.color,
        hasCoords: r.hasCoords,
        category: 'finance',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'very_cheap',    label: 'Очень дешёво',  color: '#22c55e' },
      { level: 'cheap',         label: 'Дёшево',        color: '#84cc16' },
      { level: 'mid',           label: 'Средне',        color: '#eab308' },
      { level: 'expensive',     label: 'Дорого',        color: '#f97316' },
      { level: 'very_expensive', label: 'Очень дорого', color: '#dc2626' },
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
  for (const r of rows) { const b = priceBand(r.value); lines.push(`${r.name},${r.value},${r.unit},${b.level},${b.label}`); }
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
    const extra = { 'X-Module': 'big-mac-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
