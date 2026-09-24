/**
 * apis/sources/bdi-api.mjs — API-МОДУЛЬ: BALTIC DRY INDEX
 *
 * Версия 3.0.1. Принят 23.09.2026.
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/bdi.json — v1-схема, series[{date,value}],
 *           читается через basket-loader v2.0.0 (правило 14.3).
 * Сборщик: scripts/collectors/collect-bdi.mjs.
 *
 * BDI — индекс стоимости морских грузоперевозок. Ключевой индикатор глобальной торговли.
 *
 * Изменения v3.0.1:
 *  - Перевод с прямого fs.readFile на loadWithFallback.
 *  - extractArray: для v1-схемы приоритет series (временной ряд), потом points/regions.
 *    Для legacy — array/data/series/data.array.
 *  - normalizeRow: {date, value} из серии.
 *  - Диагностика source (basket-v1 | basket-legacy | fallback | corrupted | error)
 *    и shape в headers X-Basket-Source и X-Basket-Shape.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?limit=, ?days=.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'bdi.json');
const COLLECTOR_HINT = 'run scripts/collectors/collect-bdi.mjs';

export const route  = '/api/layers/bdi';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📊',
  color: '#0066ff',
  vizType: 'marker',
  source: 'basket/bdi.json',
  collector: 'collect-bdi.mjs',
  cache: 300,
  description: 'Baltic Dry Index — индекс стоимости морских грузоперевозок',
  unit: 'index',
};

// Уровни рынка перевозок
function marketLevel(value) {
  if (value < 1000) return { level: 'depression', color: '#1e40af', label: 'Депрессия' };
  if (value < 1500) return { level: 'weak',       color: '#3b82f6', label: 'Слабый' };
  if (value < 2000) return { level: 'normal',     color: '#22c55e', label: 'Норма' };
  if (value < 3000) return { level: 'strong',     color: '#eab308', label: 'Сильный' };
  return                   { level: 'boom',       color: '#dc2626', label: 'Бум' };
}

// Ключевые морские узлы (условные точки)
const SHIPPING_HUBS = [
  { name: 'Baltic Exchange (London)', lat: 51.5074, lng: -0.1278 },
  { name: 'Port of Rotterdam',        lat: 51.9244, lng:  4.4777 },
  { name: 'Port of Shanghai',         lat: 31.2304, lng: 121.4737 },
  { name: 'Port of Singapore',        lat:  1.3521, lng: 103.8198 },
  { name: 'Port of Panama',           lat:  8.9824, lng: -79.5199 },
];

/**
 * Извлекает массив записей из любой формы basket-данных.
 * Для v1-схемы bdi приоритет — series (временной ряд).
 */
function extractArray(payload) {
  if (!payload) return { rows: null, shape: 'null' };

  // v1-схема — приоритет series (временной ряд)
  if (typeof payload === 'object' && payload.schema === 'crucix.basket.v1') {
    if (Array.isArray(payload.series) && payload.series.length > 0) return { rows: payload.series, shape: 'v1.series' };
    if (Array.isArray(payload.points) && payload.points.length > 0) return { rows: payload.points, shape: 'v1.points' };
    if (Array.isArray(payload.regions) && payload.regions.length > 0) return { rows: payload.regions, shape: 'v1.regions' };
    return { rows: [], shape: 'v1.empty' };
  }

  // Legacy-формы
  if (Array.isArray(payload)) return { rows: payload, shape: 'array' };
  if (Array.isArray(payload.series)) return { rows: payload.series, shape: 'series' };
  if (Array.isArray(payload.data)) return { rows: payload.data, shape: 'data.array' };
  if (payload.data && Array.isArray(payload.data.series)) return { rows: payload.data.series, shape: 'data.series' };
  if (payload.data && payload.data.data && Array.isArray(payload.data.data)) return { rows: payload.data.data, shape: 'data.data' };

  return { rows: null, shape: 'unknown' };
}

/**
 * Нормализация точки временного ряда → { date, value }.
 */
function normalizeRow(r) {
  if (!r) return null;
  const date = r.date || r.timestamp;
  const value = Number(r.value ?? r.close ?? r.bdi);
  return (date && Number.isFinite(value)) ? { date: String(date).slice(0, 10), value } : null;
}

async function loadSeries() {
  const loaded = await loadWithFallback({
    basketFile: BASKET_FILE,
    fallbackData: null,
    hint: COLLECTOR_HINT,
  });

  if (loaded.source === 'fallback') {
    const err = new Error('no_data');
    err.statusCode = 503;
    err.hint = COLLECTOR_HINT;
    throw err;
  }
  if (loaded.source === 'corrupted') {
    const err = new Error('invalid_json_in_basket: ' + (loaded.error || 'CORRUPTED_JSON'));
    err.statusCode = 500;
    throw err;
  }
  if (loaded.source === 'error') {
    const err = new Error('basket_read_error: ' + (loaded.error || 'UNKNOWN'));
    err.statusCode = 500;
    throw err;
  }

  const payload = loaded.legacy || loaded.data;
  const { rows: arr, shape } = extractArray(payload);

  if (!arr) {
    const err = new Error('unrecognized_basket_format');
    err.statusCode = 500;
    err.hint = 'extractArray не распознал форму. Проверьте data/basket/bdi.json.';
    throw err;
  }

  const clean = arr.map(normalizeRow).filter(Boolean);

  if (clean.length === 0) {
    const err = new Error('empty_series_after_normalize');
    err.statusCode = 500;
    err.hint = 'basket есть, но после нормализации осталось 0 точек с date+value.';
    throw err;
  }

  clean.sort((a, b) => a.date.localeCompare(b.date));
  return { rows: clean, source: loaded.source, shape, mtime: loaded.mtime };
}

function applyFilters(series, query) {
  let r = series.slice();
  if (query.since) r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.days)  { const n = parseInt(query.days, 10);  if (n > 0) r = r.slice(-n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function computeStats(series) {
  if (series.length === 0) return { count: 0 };
  const v = series.map(r => r.value);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const first = v[0], last = v[v.length - 1];
  const change = last - first;
  const changePct = first !== 0 ? (change / first) * 100 : 0;
  const current = marketLevel(last);
  return {
    count: series.length,
    date_from: series[0].date,
    date_to: series[series.length - 1].date,
    min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2),
    first: +first.toFixed(2), last: +last.toFixed(2),
    change: +change.toFixed(2), changePct: +changePct.toFixed(2),
    trend: change > 20 ? 'up' : change < -20 ? 'down' : 'flat',
    market_level: current.level,
    market_label: current.label,
    market_color: current.color,
  };
}

function toFeatureCollection(series, stats) {
  const latest = series[series.length - 1];
  const prev   = series[series.length - 2] || latest;
  const delta  = latest.value - prev.value;
  const lvl = marketLevel(latest.value);

  const features = SHIPPING_HUBS.map(hub => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [hub.lng, hub.lat] },
    properties: {
      name: hub.name,
      bdi: latest.value,
      bdiPrev: prev.value,
      delta: +delta.toFixed(2),
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      marketLevel: lvl.level,
      marketLabel: lvl.label,
      date: latest.date,
      category: 'finance',
      icon: meta.icon,
      color: lvl.color,
    },
  }));
  return { type: 'FeatureCollection', features };
}

function envelopeMeta(full, filtered, sourceInfo) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_points: full.length, returned_points: filtered.length,
    date_from: filtered[0]?.date || null,
    date_to: filtered[filtered.length - 1]?.date || null,
    basket_source: sourceInfo.source,
    basket_shape: sourceInfo.shape,
    basket_mtime: sourceInfo.mtime || null,
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
function toCSVBody(series) {
  const lines = ['date,value,market_level'];
  for (const r of series) { const lv = marketLevel(r.value); lines.push(`${r.date},${r.value},${lv.level}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadSeries();
    const fullSeries = loaded.rows;
    const sourceInfo = { source: loaded.source, shape: loaded.shape, mtime: loaded.mtime };
    const series = applyFilters(fullSeries, query);
    const stats  = computeStats(series);
    const extra = {
      'X-Module': 'bdi-api',
      'X-Module-Version': '3.0.1',
      'X-Basket-Source': loaded.source,
      'X-Basket-Shape': loaded.shape,
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (format === 'csv') return sendText(res, 200, toCSVBody(series), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series, stats, meta: envelopeMeta(fullSeries, series, sourceInfo) }, extra);
    if (format === 'stats')  return sendJSON(res, 200, { stats, meta: envelopeMeta(fullSeries, series, sourceInfo) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: series, meta: envelopeMeta(fullSeries, series, sourceInfo) }, extra);

    const fc = toFeatureCollection(series, stats);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(fullSeries, series, sourceInfo),
      features: fc.features,
      series,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
