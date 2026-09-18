/**
 * apis/sources/fred-api.mjs — API-МОДУЛЬ: ЭКОНОМИЧЕСКИЕ ИНДИКАТОРЫ FRED
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/fred.json — { source, updated, indicators: { key: { value, period, source } } }.
 * Резервный: data/basket/fred-latest.json.
 * Сборщик: scripts/collectors/collect-fred-real.mjs (заменён на открытые источники, FRED требует ключ).
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?indicator=, ?min=, ?max=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE = join(PROJECT_ROOT, 'data', 'basket', 'fred.json');
const BASKET_ALT  = join(PROJECT_ROOT, 'data', 'basket', 'fred-latest.json');

export const route  = '/api/layers/fred';
export const method = 'GET';

export const meta = {
  category: 'economics',
  icon: '📊',
  color: '#0088ff',
  vizType: 'marker',
  source: 'basket/fred.json',
  collector: 'collect-fred-real.mjs',
  cache: 3600,
  description: 'Ключевые экономические индикаторы (FRED-замена: ECB + Treasury + открытые)',
  unit: 'mixed',
};

// Геопривязка индикаторов (к какому региону относится показатель)
const INDICATOR_COORDS = {
  'usd_eur':         { name: 'USD/EUR (ECB Frankfurt)',    lat: 50.1109, lng: 8.6821, country: 'Germany' },
  'us_national_debt':{ name: 'US National Debt (Washington)', lat: 38.8977, lng: -77.0365, country: 'United States' },
  'us_gdp':          { name: 'US GDP (BEA)',               lat: 38.8977, lng: -77.0365, country: 'United States' },
  'gdp':             { name: 'GDP',                        lat: 38.8977, lng: -77.0365, country: 'United States' },
  'unemployment':    { name: 'Unemployment (BLS)',         lat: 38.8977, lng: -77.0365, country: 'United States' },
  'inflation':       { name: 'Inflation (BLS)',            lat: 38.8977, lng: -77.0365, country: 'United States' },
  'fed_funds':       { name: 'Fed Funds Rate',             lat: 38.8977, lng: -77.0365, country: 'United States' },
  'm2':              { name: 'M2 Money Supply',            lat: 38.8977, lng: -77.0365, country: 'United States' },
};

async function loadIndicators() {
  let raw = null, fileUsed = null, parsed = null;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); fileUsed = 'fred.json'; }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (!raw) {
    try { raw = await fs.readFile(BASKET_ALT, 'utf8'); fileUsed = 'fred-latest.json'; } catch {}
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-fred-real.mjs'; throw err;
  }
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  const ind = parsed.indicators || {};
  const entries = Object.entries(ind).map(([key, v]) => {
    const value = Number(v.value ?? v);
    const coords = INDICATOR_COORDS[key] || null;
    return {
      key,
      name: (v && v.name) || (coords && coords.name) || key,
      value,
      unit: (v && v.unit) || '',
      period: (v && v.period) || null,
      source: (v && v.source) || null,
      coords: coords || null,
      file: fileUsed,
    };
  }).filter(r => Number.isFinite(r.value));

  if (entries.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return { entries, rawMeta: { source: parsed.source || null, updated: parsed.updated || null, note: parsed.note || null } };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.indicator) r = r.filter(x => x.key.toLowerCase().includes(String(query.indicator).toLowerCase()));
  if (query.min != null) { const n = parseFloat(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = parseFloat(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const v = rows.map(r => r.value);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const byKey = {};
  for (const r of rows) byKey[r.key] = r.value;
  return { count: rows.length, min, max, avg: +avg.toFixed(2), by_key: byKey };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => r.coords && Number.isFinite(r.coords.lat) && Number.isFinite(r.coords.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.coords.lng, r.coords.lat] },
      properties: {
        key: r.key,
        name: r.name,
        value: r.value,
        unit: r.unit,
        period: r.period,
        source: r.source,
        country: r.coords.country,
        color: meta.color,
        category: 'economics',
        icon: meta.icon,
      },
    }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(full, filtered, rawMeta) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_source: rawMeta.source,
    basket_updated: rawMeta.updated,
    note: rawMeta.note,
    total_indicators: full.length, returned_indicators: filtered.length,
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
  const lines = ['key,name,value,unit,period,source'];
  for (const r of rows) lines.push(`${r.key},${r.name},${r.value},${r.unit},${r.period || ''},${r.source || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadIndicators();
    const rows = applyFilters(loaded.entries, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'fred-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.entries, rows, loaded.rawMeta) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.entries, rows, loaded.rawMeta) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.entries, rows, loaded.rawMeta),
      features: fc.features,
      indicators: rows,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
