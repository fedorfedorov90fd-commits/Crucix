/**
 * apis/sources/internet-outages-api.mjs — API-МОДУЛЬ: ИНТЕРНЕТ-ОТКЛЮЧЕНИЯ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/internet.json — массив { country, value, date }.
 * Резервный: data/basket/mobile.json.
 * Сборщик: scripts/collectors/collect-internet-outages.mjs.
 *
 * Данные об интернет-отключениях по странам (Cloudflare Radar).
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/internet-outages';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '📡',
  color: '#ffaa00',
  vizType: 'choropleth',
  source: 'basket/internet.json',
  collector: 'collect-internet-outages.mjs',
  cache: 300,
  description: 'Интернет-отключения по странам (Cloudflare Radar)',
  unit: 'index',
};

const COUNTRY_COORDS = {
  'США': { lat: 38.9072, lng: -77.0369 }, 'Россия': { lat: 55.7558, lng: 37.6173 },
  'Китай': { lat: 39.9042, lng: 116.4074 }, 'Индия': { lat: 28.6139, lng: 77.2090 },
  'Бразилия': { lat: -15.7975, lng: -47.8919 }, 'Великобритания': { lat: 51.5074, lng: -0.1278 },
  'Германия': { lat: 52.5200, lng: 13.4050 }, 'Франция': { lat: 48.8566, lng: 2.3522 },
  'Япония': { lat: 35.6762, lng: 139.6503 }, 'Канада': { lat: 45.4215, lng: -75.6972 },
  'Австралия': { lat: -33.8688, lng: 151.2093 }, 'Иран': { lat: 35.6892, lng: 51.3890 },
  'Украина': { lat: 50.4501, lng: 30.5234 }, 'Турция': { lat: 39.9334, lng: 32.8597 },
  'Египет': { lat: 30.0444, lng: 31.2357 }, 'Пакистан': { lat: 30.3753, lng: 69.3451 },
};

function outageBand(value) {
  if (value >= 80) return { level: 'critical', color: '#7f1d1d', label: 'Критический' };
  if (value >= 60) return { level: 'high',     color: '#dc2626', label: 'Высокий' };
  if (value >= 40) return { level: 'medium',   color: '#f97316', label: 'Средний' };
  if (value >= 20) return { level: 'low',      color: '#eab308', label: 'Низкий' };
  return                 { level: 'info',     color: '#22c55e', label: 'Информационный' };
}

async function loadData() {
  let raw = null, fileUsed = null;
  for (const f of ['internet.json', 'mobile.json']) {
    try { raw = await fs.readFile(join(BASKET_DIR, f), 'utf8'); fileUsed = f; break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-internet-outages.mjs'; throw err;
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
    const country = p.country || p.name || 'Unknown';
    const value = Number(p.value ?? p.outage ?? p.index ?? 0);
    const coords = COUNTRY_COORDS[country] || { lat: 0, lng: 0 };
    return {
      country,
      value,
      date: p.date || null,
      hasCoords: coords.lat !== 0 || coords.lng !== 0,
      coords,
    };
  }).filter(r => r.country !== 'Unknown' && Number.isFinite(r.value));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.value - a.value);
  return { outages: clean, fileUsed };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_value != null) { const n = parseFloat(query.min_value); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => x.country.toLowerCase().includes(c)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.country.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const byBand = {};
  for (const r of rows) { const b = outageBand(r.value).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top5 = rows.slice(0, 5).map(r => ({ country: r.country, value: r.value }));
  const bottom5 = rows.slice().sort((a, b) => a.value - b.value).slice(0, 5).map(r => ({ country: r.country, value: r.value }));
  return { count: rows.length, min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2), by_band: byBand, top_5: top5, bottom_5: bottom5 };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.hasCoords).map(r => {
    const b = outageBand(r.value);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.coords.lng, r.coords.lat] },
      properties: {
        country: r.country, value: r.value, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'cyber', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'critical', label: 'Критический (80+)', color: '#7f1d1d' },
      { level: 'high',     label: 'Высокий (60+)',     color: '#dc2626' },
      { level: 'medium',   label: 'Средний (40+)',     color: '#f97316' },
      { level: 'low',      label: 'Низкий (20+)',      color: '#eab308' },
      { level: 'info',     label: 'Информационный',    color: '#22c55e' },
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
  const lines = ['country,value,band,date'];
  for (const r of rows) { const b = outageBand(r.value); lines.push(`${r.country},${r.value},${b.level},${r.date || ''}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadData();
    const rows = applyFilters(loaded.outages, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'internet-outages-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.outages, rows, loaded.fileUsed) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.outages, rows, loaded.fileUsed) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.outages, rows, loaded.fileUsed),
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
