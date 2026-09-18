/**
 * apis/sources/big-mac-main-api.mjs — API-МОДУЛЬ: ИНДЕКС БИГ-МАКА (ОСНОВНОЙ)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/big-mac-main.json — [{ country, price, date }].
 * Сборщик: scripts/collectors/collect-big-mac-main.mjs.
 *
 * Основной индекс Биг-Мака (по странам). Геокоординаты — встроенный справочник.
 *
 * ФОРМАТЫ: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?min=, ?max=, ?q=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'big-mac-main.json');

export const route  = '/api/layers/big-mac-main';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '🍔',
  color: '#ffaa00',
  vizType: 'choropleth',
  source: 'basket/big-mac-main.json',
  collector: 'collect-big-mac-main.mjs',
  cache: 300,
  description: 'Основной индекс Биг-Мака',
  unit: 'USD',
};

const COUNTRY_COORDS = {
  'США': [39.7, -98.8], 'USA': [39.7, -98.8],
  'Россия': [61.5, 105], 'Russia': [61.5, 105],
  'Китай': [34.9, 105.2], 'China': [34.9, 105.2],
  'Индия': [20.8, 78.5], 'India': [20.8, 78.5],
  'Бразилия': [-13.8, -51.9], 'Brazil': [-13.8, -51.9],
  'Великобритания': [55.3, -3.2], 'UK': [55.3, -3.2],
  'Германия': [50.6, 10.4], 'Germany': [50.6, 10.4],
  'Франция': [46.5, 2.3], 'France': [46.5, 2.3],
  'Япония': [36.3, 138.7], 'Japan': [36.3, 138.7],
  'Канада': [55.9, -106.5], 'Canada': [55.9, -106.5],
  'Австралия': [-25.5, 133.8], 'Australia': [-25.5, 133.8],
  'Швейцария': [46.8, 8.2], 'Switzerland': [46.8, 8.2],
  'Норвегия': [60.5, 8.5], 'Norway': [60.5, 8.5],
  'Швеция': [60.1, 18.6], 'Sweden': [60.1, 18.6],
  'Дания': [56.3, 9.5], 'Denmark': [56.3, 9.5],
  'Финляндия': [61.9, 25.7], 'Finland': [61.9, 25.7],
  'Ирландия': [53.4, -8.2], 'Ireland': [53.4, -8.2],
  'Португалия': [39.4, -8.2], 'Portugal': [39.4, -8.2],
  'Италия': [41.9, 12.6], 'Italy': [41.9, 12.6],
  'Испания': [40.5, -3.7], 'Spain': [40.5, -3.7],
  'Мексика': [23.6, -102.6], 'Mexico': [23.6, -102.6],
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-big-mac-main.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  if (!Array.isArray(parsed)) {
    const err = new Error('unrecognized_basket_format: ожидался массив [{country,price,date}]'); err.statusCode = 500; throw err;
  }
  return parsed.map((r, i) => ({
    name: r.country || r.name,
    value: Number(r.price ?? r.value),
    date: String(r.date || '').slice(0, 10) || null,
    unit: r.unit || '$',
  })).filter(r => r.name && Number.isFinite(r.value));
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) r = r.filter(x => String(x.name || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.q)       r = r.filter(x => String(x.name || '').toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.since)   r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.limit)   { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length === 0 ? null
    : sorted.length % 2 === 0 ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  return {
    count: rows.length,
    mean: values.length ? Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)) : null,
    median: median != null ? Number(median.toFixed(2)) : null,
    min: values.length ? Number(Math.min(...values).toFixed(2)) : null,
    max: values.length ? Number(Math.max(...values).toFixed(2)) : null,
    cheapest: rows.slice().sort((a,b)=>a.value-b.value)[0] || null,
    most_expensive: rows.slice().sort((a,b)=>b.value-a.value)[0] || null,
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => r.name && COUNTRY_COORDS[r.name])
    .map(r => {
      const [lat, lng] = COUNTRY_COORDS[r.name];
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          name: r.name, value: r.value, unit: r.unit || '$', date: r.date,
          category: meta.category, icon: meta.icon, color: meta.color,
        },
      };
    });
  return { type: 'FeatureCollection', features, meta: { total: rows.length, mapped: features.length } };
}

function toSeries(rows) { return rows.map(r => ({ name: r.name, value: r.value, date: r.date })); }

function toCSV(rows) {
  const lines = ['name,value,unit,date,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) {
    const c = COUNTRY_COORDS[r.name] || [null, null];
    lines.push([r.name, r.value, r.unit || '$', r.date, c[0], c[1]].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
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

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/big-mac-main/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const all = await loadData();
    const extra = {
      'X-Module': 'big-mac-main-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/featurecollection') return sendJSON(res, 200, toFeatureCollection(all), extra);
    if (sub === '/status') {
      const lastDate = all.map(r => r.date).filter(Boolean).sort().slice(-1)[0] || null;
      return sendJSON(res, 200, { status: 'online', count: all.length, lastUpdate: lastDate }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: all.length, returned_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      series: toSeries(rows),
      stats: computeStats(rows),
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
