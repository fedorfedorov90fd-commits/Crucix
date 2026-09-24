/**
 * apis/sources/aviation-api.mjs — API-МОДУЛЬ: АВИАЦИОННЫЙ МОНИТОРИНГ
 *
 * Версия 3.0.1. Принят 23.09.2026.
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/aviation.json — читается через basket-loader v2.0.0.
 * Сборщик: scripts/collectors/collect-aviation.mjs.
 *
 * Изменения v3.0.1 (после smoke-fail 23.09.2026):
 *  - extractArray дополнен: понимает v1-схему (points/series/regions) — раньше видел
 *    только legacy-формы (Array, {data}, {data.features}, {features}), из-за чего
 *    data/basket/aviation.json (schema=crucix.basket.v1) давал unrecognized_basket_format.
 *  - normalizeRow обрабатывает точку из v1-схемы: {lat, lon, timestamp} — минимальные
 *    поля, плюс любые дополнительные (aircraft, airline, flights), если адаптер их сохранит.
 *  - Задокументировано: кладовщик (адаптер points v2.2.1) сейчас усекает daily[] до
 *    {lat, lon, timestamp}. Расширение адаптера — отдельная задача warehouse.
 *
 * Изменения v3.0.0:
 *  - Перевод с прямого fs.readFile на loadWithFallback из ./lib/basket-loader.mjs
 *    (правило 14.3: потребитель не читает raw, только basket через basket-loader).
 *  - Диагностика source (basket-v1 | basket-legacy | fallback | corrupted | error).
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?type=, ?severity=, ?aircraft=, ?min_altitude=, ?max_altitude=, ?limit=.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'aviation.json');
const COLLECTOR_HINT = 'run scripts/collectors/collect-aviation.mjs';

export const route  = '/api/layers/aviation';
export const method = 'GET';

export const meta = {
  category: 'transport',
  icon: '✈️',
  color: '#f97316',
  vizType: 'marker',
  source: 'basket/aviation.json',
  collector: 'collect-aviation.mjs',
  cache: 60,
  description: 'Авиационный мониторинг — рейсы, высоты, типы ВС',
  unit: 'flights',
};

// Классификация высоты
function altitudeBand(alt) {
  if (alt <= 1000)  return { level: 'ground',    color: '#64748b', label: 'Земля' };
  if (alt <= 5000)  return { level: 'low',       color: '#22c55e', label: 'Низкая' };
  if (alt <= 10000) return { level: 'medium',    color: '#eab308', label: 'Средняя' };
  if (alt <= 13000) return { level: 'high',      color: '#f97316', label: 'Высокая' };
  return { level: 'very_high', color: '#dc2626', label: 'Очень высокая' };
}

const SEVERITY_COLOR = { low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#dc2626' };

/**
 * Извлекает массив записей из любой формы basket-данных.
 *
 * ПОДДЕРЖИВАЕМЫЕ ФОРМЫ:
 *  1. v1-схема:    { schema, meta, series, points, regions, ... }   → points || series
 *  2. Массив:      [ ... ]
 *  3. Одноуровень: { data: [ ... ] }
 *  4. FeatureColl: { data: { features: [ ... ] } }
 *  5. FeatureColl: { features: [ ... ] }
 *  6. Вложенный:   { data: { data: [ ... ] } } (двойная обёртка от wrapLegacy)
 *
 * Возвращает { rows, shape } — shape для диагностики.
 */
function extractArray(payload) {
  if (!payload) return { rows: null, shape: 'null' };

  // v1-схема — приоритет: если есть schema 'crucix.basket.v1', берём points/series
  if (typeof payload === 'object' && payload.schema === 'crucix.basket.v1') {
    if (Array.isArray(payload.points) && payload.points.length > 0) return { rows: payload.points, shape: 'v1.points' };
    if (Array.isArray(payload.series) && payload.series.length > 0) return { rows: payload.series, shape: 'v1.series' };
    if (Array.isArray(payload.regions) && payload.regions.length > 0) return { rows: payload.regions, shape: 'v1.regions' };
    return { rows: [], shape: 'v1.empty' };
  }

  // Legacy и прочие формы
  if (Array.isArray(payload)) return { rows: payload, shape: 'array' };
  if (Array.isArray(payload.data)) return { rows: payload.data, shape: 'data.array' };
  if (payload.data && Array.isArray(payload.data.features)) return { rows: payload.data.features, shape: 'data.features' };
  if (Array.isArray(payload.features)) return { rows: payload.features, shape: 'features' };
  if (payload.data && payload.data.data && Array.isArray(payload.data.data)) return { rows: payload.data.data, shape: 'data.data' };

  return { rows: null, shape: 'unknown' };
}

/**
 * Нормализация: превращает любую запись (Feature, точку v1, плоскую) в унифицированный
 * объект { flight, aircraft, altitude, lat, lng, type, severity, speed, heading, ... }.
 *
 * Поддерживаемые входы:
 *  - GeoJSON Feature: { type: 'Feature', geometry: { coordinates: [lng, lat] }, properties: {...} }
 *  - v1 point:        { lat, lon, timestamp, [aircraft, airline, flights, ...] }
 *  - v1 region:       { region, value, count, aggregation, extra }
 *  - Плоская запись:  { flight/callsign, aircraft, altitude, lat, lng, type, severity, ... }
 */
function normalizeRow(r) {
  if (!r) return null;

  // GeoJSON Feature
  if (r.type === 'Feature') {
    const coords = r.geometry?.coordinates || [0, 0];
    const p = r.properties || {};
    return {
      flight: p.flight || p.callsign || 'Unknown',
      aircraft: p.aircraft || p.model || null,
      altitude: Number(p.altitude ?? p.alt ?? 0),
      lat: Number(coords[1]), lng: Number(coords[0]),
      type: p.type || 'unknown',
      severity: p.severity || 'low',
      speed: p.speed != null ? Number(p.speed) : null,
      heading: p.heading != null ? Number(p.heading) : null,
      country: p.country || null,
      origin: p.origin || null,
      destination: p.destination || null,
    };
  }

  // v1 region (нет lat/lon — пропускаем через Number.isFinite в фильтре)
  if (r.region != null && r.lat == null && r.lon == null) {
    return null;
  }

  // v1 point: { lat, lon, timestamp, ... } или плоская запись
  const lat = Number(r.lat);
  const lng = Number(r.lon ?? r.lng);
  return {
    flight: r.flight || r.callsign || r.aircraft || 'Unknown',
    aircraft: r.aircraft || r.model || null,
    altitude: Number(r.altitude ?? r.alt ?? 0),
    lat, lng,
    type: r.type || 'unknown',
    severity: r.severity || 'low',
    speed: r.speed != null ? Number(r.speed) : null,
    heading: r.heading != null ? Number(r.heading) : null,
    country: r.country || null,
    origin: r.origin || null,
    destination: r.destination || null,
    timestamp: r.timestamp || r.date || null,
  };
}

/**
 * Загрузка рейсов через basket-loader.
 * Возвращает { rows, source, shape, mtime } — source и shape для отладки.
 */
async function loadFlights() {
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
    err.hint = 'extractArray не распознал форму. Проверьте data/basket/aviation.json.';
    throw err;
  }

  const rows = arr.map(normalizeRow).filter(r => r && Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (rows.length === 0) {
    const err = new Error('empty_after_normalize');
    err.statusCode = 500;
    err.hint = 'basket есть, но после нормализации осталось 0 записей с координатами. Проверьте адаптер points в кладовщике.';
    throw err;
  }

  return { rows, source: loaded.source, shape, mtime: loaded.mtime };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type)     r = r.filter(x => x.type.toLowerCase() === String(query.type).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity.toLowerCase() === String(query.severity).toLowerCase());
  if (query.aircraft) r = r.filter(x => (x.aircraft || '').toLowerCase().includes(String(query.aircraft).toLowerCase()));
  if (query.min_altitude != null) {
    const n = parseFloat(query.min_altitude);
    if (Number.isFinite(n)) r = r.filter(x => x.altitude >= n);
  }
  if (query.max_altitude != null) {
    const n = parseFloat(query.max_altitude);
    if (Number.isFinite(n)) r = r.filter(x => x.altitude <= n);
  }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const alt = rows.map(r => r.altitude);
  const min = Math.min(...alt), max = Math.max(...alt);
  const avg = alt.reduce((a, b) => a + b, 0) / alt.length;
  const byType = {}, bySeverity = {}, byBand = {};
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    const b = altitudeBand(r.altitude).level;
    byBand[b] = (byBand[b] || 0) + 1;
  }
  const highest = rows.slice().sort((a, b) => b.altitude - a.altitude).slice(0, 5)
    .map(r => ({ flight: r.flight, altitude: r.altitude }));
  return {
    count: rows.length,
    min_altitude: min, max_altitude: max, avg_altitude: +avg.toFixed(0),
    by_type: byType, by_severity: bySeverity, by_band: byBand,
    highest,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const b = altitudeBand(r.altitude);
    const sevColor = SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.low;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        flight: r.flight, aircraft: r.aircraft,
        altitude: r.altitude, altitudeBand: b.level, altitudeLabel: b.label,
        speed: r.speed, heading: r.heading,
        type: r.type, severity: r.severity, severityColor: sevColor,
        country: r.country, origin: r.origin, destination: r.destination,
        timestamp: r.timestamp,
        color: sevColor,
        category: 'transport',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'ground',    label: 'Земля',           color: '#64748b' },
      { level: 'low',       label: 'Низкая',          color: '#22c55e' },
      { level: 'medium',    label: 'Средняя',         color: '#eab308' },
      { level: 'high',      label: 'Высокая',         color: '#f97316' },
      { level: 'very_high', label: 'Очень высокая',   color: '#dc2626' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered, sourceInfo) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_flights: full.length, returned_flights: filtered.length,
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
function toCSVBody(rows) {
  const lines = ['flight,aircraft,type,severity,altitude,lat,lng,speed,heading'];
  for (const r of rows) lines.push(`${r.flight},${r.aircraft || ''},${r.type},${r.severity},${r.altitude},${r.lat},${r.lng},${r.speed ?? ''},${r.heading ?? ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadFlights();
    const full = loaded.rows;
    const sourceInfo = { source: loaded.source, shape: loaded.shape, mtime: loaded.mtime };
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = {
      'X-Module': 'aviation-api',
      'X-Module-Version': '3.0.1',
      'X-Basket-Source': loaded.source,
      'X-Basket-Shape': loaded.shape,
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows, sourceInfo) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows, sourceInfo) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows, sourceInfo),
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
