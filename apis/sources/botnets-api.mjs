/**
 * apis/sources/botnets-api.mjs — API-МОДУЛЬ: БОТНЕТЫ
 *
 * Версия 3.0.1. Принят 23.09.2026.
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/botnets.json — legacy-массив
 *           { id, name, lat, lng, severity, timestamp },
 *           читается через basket-loader v2.0.0 (правило 14.3).
 * Сборщик: scripts/collectors/collect-botnets.mjs.
 *
 * Изменения v3.0.1:
 *  - Перевод с прямого fs.readFile на loadWithFallback из ./lib/basket-loader.mjs.
 *  - extractArray распознаёт: v1-схему (schema=crucix.basket.v1 → points/series/regions),
 *    legacy-массив, {data:[...]}, {data:{features}}, {features}, {records}, {bots},
 *    {data:{data}} — 8 форм. Для botnets.json реальная форма — legacy-массив.
 *  - normalizeRow раздельно обрабатывает GeoJSON Feature, v1 point, плоские записи.
 *  - Диагностика source (basket-v1 | basket-legacy | fallback | corrupted | error)
 *    и shape в headers X-Basket-Source и X-Basket-Shape.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?severity=, ?malware=, ?country=, ?asn=, ?q=, ?limit=.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'botnets.json');
const COLLECTOR_HINT = 'run scripts/collectors/collect-botnets.mjs';

export const route  = '/api/layers/botnets';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '🤖',
  color: '#ff6600',
  vizType: 'marker',
  source: 'basket/botnets.json',
  collector: 'collect-botnets.mjs',
  cache: 300,
  description: 'Ботнеты и C2-инфраструктура',
  unit: 'bots',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

/**
 * Извлекает массив записей из любой формы basket-данных.
 *
 * ПОДДЕРЖИВАЕМЫЕ ФОРМЫ:
 *  1. v1-схема:           { schema:'crucix.basket.v1', points|series|regions } → points/series/regions
 *  2. Массив:             [ ... ]                                            → array
 *  3. records:            { records: [ ... ] }
 *  4. bots:               { bots: [ ... ] }
 *  5. FeatureCollection:  { type:'FeatureCollection', features: [ ... ] }
 *  6. Одноуровень:        { data: [ ... ] }
 *  7. FC в data:          { data: { features: [ ... ] } }
 *  8. Двойная обёртка:    { data: { data: [ ... ] } }
 *
 * Возвращает { rows, shape } — shape для диагностики.
 */
function extractArray(payload) {
  if (!payload) return { rows: null, shape: 'null' };

  // v1-схема — приоритет
  if (typeof payload === 'object' && payload.schema === 'crucix.basket.v1') {
    if (Array.isArray(payload.points) && payload.points.length > 0) return { rows: payload.points, shape: 'v1.points' };
    if (Array.isArray(payload.series) && payload.series.length > 0) return { rows: payload.series, shape: 'v1.series' };
    if (Array.isArray(payload.regions) && payload.regions.length > 0) return { rows: payload.regions, shape: 'v1.regions' };
    return { rows: [], shape: 'v1.empty' };
  }

  // Legacy-формы
  if (Array.isArray(payload)) return { rows: payload, shape: 'array' };
  if (Array.isArray(payload.records)) return { rows: payload.records, shape: 'records' };
  if (Array.isArray(payload.bots)) return { rows: payload.bots, shape: 'bots' };
  if (payload.type === 'FeatureCollection' && Array.isArray(payload.features)) return { rows: payload.features, shape: 'features' };
  if (Array.isArray(payload.features)) return { rows: payload.features, shape: 'features' };
  if (Array.isArray(payload.data)) return { rows: payload.data, shape: 'data.array' };
  if (payload.data && Array.isArray(payload.data.features)) return { rows: payload.data.features, shape: 'data.features' };
  if (payload.data && payload.data.data && Array.isArray(payload.data.data)) return { rows: payload.data.data, shape: 'data.data' };

  return { rows: null, shape: 'unknown' };
}

/**
 * Нормализация: Feature, v1 point и плоские записи → унифицированный объект.
 */
function normalizeRow(r) {
  if (!r) return null;

  // GeoJSON Feature
  if (r.type === 'Feature') {
    const coords = r.geometry?.coordinates || [0, 0];
    const p = r.properties || {};
    return {
      id: p.id || r.id || 'unknown',
      name: p.name || 'Unknown',
      ip: p.ip || p.address || null,
      asn: p.asn || null,
      malware: p.malware || p.family || null,
      severity: String(p.severity || 'info').toLowerCase(),
      lat: Number(coords[1]), lng: Number(coords[0]),
      country: p.country || null,
      port: p.port != null ? Number(p.port) : null,
      status: p.status || 'active',
      firstSeen: p.firstSeen || null,
      lastSeen: p.lastSeen || p.timestamp || null,
    };
  }

  // v1 region — нет координат, пропускаем
  if (r.region != null && r.lat == null && r.lon == null && r.lng == null) {
    return null;
  }

  // Плоская запись / v1 point
  return {
    id: r.id || 'unknown',
    name: r.name || 'Unknown',
    ip: r.ip || r.address || null,
    asn: r.asn || null,
    malware: r.malware || r.family || null,
    severity: String(r.severity || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude),
    lng: Number(r.lng ?? r.lon ?? r.longitude),
    country: r.country || null,
    port: r.port != null ? Number(r.port) : null,
    status: r.status || 'active',
    firstSeen: r.firstSeen || null,
    lastSeen: r.lastSeen || r.timestamp || null,
  };
}

/**
 * Загрузка ботнетов через basket-loader.
 * Возвращает { rows, source, shape, mtime }.
 */
async function loadBotnets() {
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
    err.hint = 'extractArray не распознал форму. Проверьте data/basket/botnets.json.';
    throw err;
  }

  const rows = arr.map(normalizeRow).filter(r => r && Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (rows.length === 0) {
    const err = new Error('empty_after_normalize');
    err.statusCode = 500;
    err.hint = 'basket есть, но после нормализации осталось 0 записей с координатами.';
    throw err;
  }

  return { rows, source: loaded.source, shape, mtime: loaded.mtime };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.malware) { const m = String(query.malware).toLowerCase(); r = r.filter(x => (x.malware || '').toLowerCase().includes(m)); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.asn) { const a = String(query.asn).toLowerCase(); r = r.filter(x => (x.asn || '').toLowerCase().includes(a)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q) || (x.ip || '').includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byMalware = {}, byCountry = {}, byAsn = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.malware) byMalware[r.malware] = (byMalware[r.malware] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    if (r.asn) byAsn[r.asn] = (byAsn[r.asn] || 0) + 1;
  }
  const top_malware = Object.entries(byMalware).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_asn = Object.entries(byAsn).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, by_severity: bySeverity, by_malware: byMalware, top_malware, top_countries, top_asn };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, ip: r.ip, asn: r.asn, malware: r.malware,
      severity: r.severity, country: r.country, port: r.port, status: r.status,
      firstSeen: r.firstSeen, lastSeen: r.lastSeen,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.info,
      category: 'cyber', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: Object.entries(SEVERITY_COLOR).map(([severity, color]) => ({ severity, color })),
    features,
  };
}

function envelopeMeta(full, filtered, sourceInfo) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_bots: full.length, returned_bots: filtered.length,
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
  const lines = ['id,name,ip,asn,malware,severity,country,port,status,lat,lng,lastSeen'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.ip || ''},${r.asn || ''},${r.malware || ''},${r.severity},${r.country || ''},${r.port ?? ''},${r.status},${r.lat},${r.lng},${r.lastSeen || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadBotnets();
    const full = loaded.rows;
    const sourceInfo = { source: loaded.source, shape: loaded.shape, mtime: loaded.mtime };
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = {
      'X-Module': 'botnets-api',
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
      legend: fc.legend,
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
