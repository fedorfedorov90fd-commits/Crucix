/**
 * apis/sources/weather-api.mjs — API-МОДУЛЬ: ПОГОДНЫЙ МОНИТОРИНГ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/weather.json — точки погоды { lat, lng, temp, ... }.
 * Сборщик: scripts/collectors/collect-open-meteo.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?min_temp=, ?max_temp=, ?city=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'weather.json');

export const route  = '/api/layers/weather';
export const method = 'GET';

export const meta = {
  category: 'ecological',
  icon: '🌤️',
  color: '#00aaff',
  vizType: 'marker',
  source: 'basket/weather.json',
  collector: 'collect-open-meteo.mjs',
  cache: 300,
  description: 'Погодные данные по ключевым городам мира',
  unit: '°C',
};

function tempBand(t) {
  if (t <= -20) return { level: 'extreme_cold', color: '#1e40af', label: 'Экстрим-холод' };
  if (t <= -5)  return { level: 'cold',         color: '#3b82f6', label: 'Холодно' };
  if (t <= 10)  return { level: 'cool',         color: '#22d3ee', label: 'Прохладно' };
  if (t <= 20)  return { level: 'mild',         color: '#22c55e', label: 'Умеренно' };
  if (t <= 30)  return { level: 'warm',         color: '#eab308', label: 'Тепло' };
  if (t <= 40)  return { level: 'hot',          color: '#f97316', label: 'Жарко' };
  return { level: 'extreme_heat', color: '#dc2626', label: 'Экстрим-жара' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-open-meteo.mjs'; throw err;
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
  else if (parsed && Array.isArray(parsed.cities)) arr = parsed.cities;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const p = r.properties || {};
      const coords = r.geometry?.coordinates || [0, 0];
      return {
        name: p.name || p.city || 'Unknown',
        lat: Number(p.lat ?? coords[1]), lng: Number(p.lng ?? coords[0]),
        temp: Number(p.temp ?? p.temperature ?? p.value),
        humidity: p.humidity != null ? Number(p.humidity) : null,
        wind: p.wind != null ? Number(p.wind) : null,
        pressure: p.pressure != null ? Number(p.pressure) : null,
        condition: p.condition || p.weather || null,
        country: p.country || null,
      };
    }
    return {
      name: r.name || r.city || 'Unknown',
      lat: Number(r.lat ?? r.latitude), lng: Number(r.lng ?? r.lon ?? r.longitude),
      temp: Number(r.temp ?? r.temperature ?? r.value),
      humidity: r.humidity != null ? Number(r.humidity) : null,
      wind: r.wind != null ? Number(r.wind) : null,
      pressure: r.pressure != null ? Number(r.pressure) : null,
      condition: r.condition || r.weather || null,
      country: r.country || null,
    };
  }).filter(r => r.name && Number.isFinite(r.temp) && Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_temp != null) { const n = parseFloat(query.min_temp); if (Number.isFinite(n)) r = r.filter(x => x.temp >= n); }
  if (query.max_temp != null) { const n = parseFloat(query.max_temp); if (Number.isFinite(n)) r = r.filter(x => x.temp <= n); }
  if (query.city) { const c = String(query.city).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(c)); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.sort === 'hot')  r.sort((a, b) => b.temp - a.temp);
  if (query.sort === 'cold') r.sort((a, b) => a.temp - b.temp);
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const t = rows.map(r => r.temp);
  const min = Math.min(...t), max = Math.max(...t);
  const avg = t.reduce((a, b) => a + b, 0) / t.length;
  const byBand = {};
  for (const r of rows) { const b = tempBand(r.temp).level; byBand[b] = (byBand[b] || 0) + 1; }
  const hottest = rows.slice().sort((a, b) => b.temp - a.temp).slice(0, 5).map(r => ({ name: r.name, temp: +r.temp.toFixed(1) }));
  const coldest = rows.slice().sort((a, b) => a.temp - b.temp).slice(0, 5).map(r => ({ name: r.name, temp: +r.temp.toFixed(1) }));
  return {
    count: rows.length,
    min: +min.toFixed(1), max: +max.toFixed(1), avg: +avg.toFixed(1),
    by_band: byBand, hottest, coldest,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const b = tempBand(r.temp);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: r.name, country: r.country,
        temp: +r.temp.toFixed(1), humidity: r.humidity, wind: r.wind, pressure: r.pressure,
        condition: r.condition,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'ecological', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'extreme_cold', label: 'Экстрим-холод', color: '#1e40af' },
      { level: 'cold',         label: 'Холодно',       color: '#3b82f6' },
      { level: 'cool',         label: 'Прохладно',     color: '#22d3ee' },
      { level: 'mild',         label: 'Умеренно',      color: '#22c55e' },
      { level: 'warm',         label: 'Тепло',         color: '#eab308' },
      { level: 'hot',          label: 'Жарко',         color: '#f97316' },
      { level: 'extreme_heat', label: 'Экстрим-жара',  color: '#dc2626' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_points: full.length, returned_points: filtered.length,
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
  const lines = ['name,country,lat,lng,temp,humidity,wind,condition,band'];
  for (const r of rows) { const b = tempBand(r.temp); lines.push(`${r.name},${r.country || ''},${r.lat},${r.lng},${r.temp},${r.humidity ?? ''},${r.wind ?? ''},${r.condition || ''},${b.level}`); }
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
    const extra = { 'X-Module': 'weather-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
