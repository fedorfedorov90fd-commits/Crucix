/**
 * apis/sources/dxy-api.mjs — API-МОДУЛЬ: ИНДЕКС ДОЛЛАРА DXY
 *
 * КОНТРАКТ CRUCIX v2:
 *   export const route  = '/api/layers/dxy';
 *   export const method = 'GET';
 *   export const meta   = { category, icon, color, vizType, source, collector, cache };
 *   export async function handler(req, res) { ... }
 *
 * ИСТОЧНИК ДАННЫХ:
 *   data/basket/dxy.json — временной ряд { date, value }.
 *   Собирается сборщиком scripts/collectors/collect-dxy.mjs.
 *
 * ФОРМАТЫ ОТВЕТА (через ?format=):
 *   json (по умолчанию) — { type: "FeatureCollection", meta, features, series, stats }
 *   csv                 — таблица date,value
 *   series              — только временной ряд
 *   stats               — только статистика
 *   raw                 — сырые данные из корзины
 *
 * ФИЛЬТРЫ (через query):
 *   ?since=YYYY-MM-DD  — от даты
 *   ?until=YYYY-MM-DD  — до даты
 *   ?limit=N           — последние N точек
 *   ?days=N            — последние N дней
 *
 * СТАТУСЫ:
 *   200 — данные есть
 *   503 — файла нет (сборщик не отработал)
 *   500 — данные битые или внутренняя ошибка
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'dxy.json');

// ============================================================
//  ЭКСПОРТ: КОНТРАКТ
// ============================================================

export const route  = '/api/layers/dxy';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '💵',
  color: '#00cc88',
  vizType: 'marker',
  source: 'basket/dxy.json',
  collector: 'collect-dxy.mjs',
  cache: 60,             // секунд: DXY обновляется раз в день, 60 сек — с запасом
  description: 'Индекс доллара США (DXY)',
  unit: 'index',
};

// ============================================================
//  КООРДИНАТЫ БИРЖ (для отображения точек на карте)
// ============================================================

const EXCHANGE_LOCATIONS = [
  { name: 'New York (ICE)',    lat: 40.7069, lng: -74.0113, weight: 0.576, currency: 'USD' },
  { name: 'Frankfurt (ECB)',   lat: 50.1109, lng:   8.6821, weight: 0.138, currency: 'EUR' },
  { name: 'Tokyo (BoJ)',       lat: 35.6762, lng: 139.6503, weight: 0.136, currency: 'JPY' },
  { name: 'London (BoE)',      lat: 51.5074, lng:  -0.1278, weight: 0.119, currency: 'GBP' },
  { name: 'Ottawa (BoC)',      lat: 45.4215, lng: -75.6972, weight: 0.091, currency: 'CAD' },
  { name: 'Stockholm (Riks)',  lat: 59.3293, lng:  18.0686, weight: 0.042, currency: 'SEK' },
  { name: 'Bern (SNB)',        lat: 46.9481, lng:   7.4474, weight: 0.036, currency: 'CHF' },
];

// ============================================================
//  ЧТЕНИЕ КОРЗИНЫ
// ============================================================

async function loadSeries() {
  let raw;
  try {
    raw = await fs.readFile(BASKET_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data');
      err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-dxy.mjs';
      throw err;
    }
    throw e;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const err = new Error('invalid_json_in_basket: ' + e.message);
    err.statusCode = 500;
    throw err;
  }

  // Поддерживаем несколько форм: массив, {data:[...]}, {values:[...]}, {series:[...]}
  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  else if (parsed && Array.isArray(parsed.values)) arr = parsed.values;
  else if (parsed && Array.isArray(parsed.series)) arr = parsed.series;

  if (!arr) {
    const err = new Error('unrecognized_basket_format');
    err.statusCode = 500;
    err.hint = 'ожидался массив {date,value} или {data:[...]}';
    throw err;
  }

  // Нормализация: { date, value }
  const clean = arr
    .map(r => {
      const date = r.date || r.timestamp || r.time;
      const value = Number(r.value ?? r.close ?? r.price ?? r.dxy);
      return (date && Number.isFinite(value)) ? { date: String(date).slice(0, 10), value } : null;
    })
    .filter(Boolean);

  if (clean.length === 0) {
    const err = new Error('empty_series_after_normalize');
    err.statusCode = 500;
    throw err;
  }

  // Сортировка по дате
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return clean;
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(series, query) {
  let result = series.slice();

  if (query.since) {
    const since = String(query.since).slice(0, 10);
    result = result.filter(r => r.date >= since);
  }
  if (query.until) {
    const until = String(query.until).slice(0, 10);
    result = result.filter(r => r.date <= until);
  }
  if (query.days) {
    const n = parseInt(query.days, 10);
    if (Number.isFinite(n) && n > 0) result = result.slice(-n);
  }
  if (query.limit) {
    const n = parseInt(query.limit, 10);
    if (Number.isFinite(n) && n > 0) result = result.slice(-n);
  }
  return result;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(series) {
  if (series.length === 0) return { count: 0 };
  const values = series.map(r => r.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const first = values[0];
  const last  = values[values.length - 1];
  const change = last - first;
  const changePct = first !== 0 ? (change / first) * 100 : 0;
  return {
    count: series.length,
    date_from: series[0].date,
    date_to: series[series.length - 1].date,
    min: +min.toFixed(4),
    max: +max.toFixed(4),
    avg: +avg.toFixed(4),
    first: +first.toFixed(4),
    last: +last.toFixed(4),
    change: +change.toFixed(4),
    changePct: +changePct.toFixed(2),
    trend: change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'flat',
  };
}

// ============================================================
//  ФОРМАТЫ ОТВЕТА
// ============================================================

function toFeatureCollection(series, stats) {
  const latest = series[series.length - 1];
  const prev   = series[series.length - 2] || latest;
  const delta  = latest.value - prev.value;

  // Для каждой биржи — точка с текущим значением DXY и весом валюты
  const features = EXCHANGE_LOCATIONS.map(loc => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [loc.lng, loc.lat] },
    properties: {
      name: loc.name,
      currency: loc.currency,
      weight: loc.weight,
      dxy: latest.value,
      dxyPrev: prev.value,
      delta: +delta.toFixed(4),
      direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
      date: latest.date,
      category: 'finance',
      icon: meta.icon,
      color: meta.color,
    },
  }));

  return { type: 'FeatureCollection', features };
}

function toSeriesPayload(series) {
  return { series };
}

function toCSVBody(series) {
  const lines = ['date,value'];
  for (const r of series) lines.push(`${r.date},${r.value}`);
  return lines.join('\n') + '\n';
}

function sendJSON(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': String(Buffer.byteLength(text)),
  });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const fullSeries = await loadSeries();
    const series = applyFilters(fullSeries, query);
    const stats  = computeStats(series);

    // Общие заголовки
    const extraHeaders = {
      'X-Module': 'dxy-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    // Формат CSV
    if (format === 'csv') {
      const csv = toCSVBody(series);
      return sendText(res, 200, csv, 'text/csv; charset=utf-8');
    }

    // Формат series
    if (format === 'series') {
      return sendJSON(res, 200, { ...toSeriesPayload(series), stats, meta: envelopeMeta(fullSeries, series) }, extraHeaders);
    }

    // Формат stats
    if (format === 'stats') {
      return sendJSON(res, 200, { stats, meta: envelopeMeta(fullSeries, series) }, extraHeaders);
    }

    // Формат raw (сырые данные из корзины)
    if (format === 'raw') {
      return sendJSON(res, 200, { data: series, meta: envelopeMeta(fullSeries, series) }, extraHeaders);
    }

    // Формат json (по умолчанию): FeatureCollection + series + stats
    const fc = toFeatureCollection(series, stats);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(fullSeries, series),
      features: fc.features,
      series,
      stats,
    }, extraHeaders);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = {
      error: status === 503 ? 'no_data' : 'handler_error',
      message: e.message,
    };
    if (e.hint) payload.hint = e.hint;
    try {
      sendJSON(res, status, payload);
    } catch {
      // заголовки уже отправлены — ничего не делаем
    }
  }
}

// ============================================================
//  ОБЁРТКА META
// ============================================================

function envelopeMeta(fullSeries, filteredSeries) {
  return {
    source: meta.source,
    collector: meta.collector,
    category: meta.category,
    unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_points: fullSeries.length,
    returned_points: filteredSeries.length,
    date_from: filteredSeries[0]?.date || null,
    date_to: filteredSeries[filteredSeries.length - 1]?.date || null,
  };
}
