/**
 * apis/sources/geo-markers-api.mjs — API-МОДУЛЬ: АГРЕГАТОР ГЕОДАННЫХ
 *
 * КОНТРАКТ CRUCIX v2 (Layer, агрегатор).
 * ИСТОЧНИКИ:
 *   - data/basket/geo-markers.json     — маркеры (NOTAM, пожары, прочее).
 *   - data/geo/country-status.json     — статусы стран (SSI/CII).
 *   - data/geo/world.geojson           — границы стран мира.
 *   - data/geo/index-history.json      — история глобального индекса.
 * Сборщик: scripts/collectors/collect-geo-markers.mjs.
 *
 * Агрегатор геоданных для карты: объединяет маркеры событий, статусы стран,
 * границы и историю индекса под единым namespace. Корень отдаёт сводку,
 * подпути — отдельные типы данных.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET /                    — сводка (FC маркеров + stats + counts)
 *   GET /markers             — все маркеры (фильтры: status, layer, q, since, bbox, top, limit)
 *   GET /markers/:id         — конкретный маркер
 *   GET /layers              — группировка маркеров по слою (notam, fires, ...)
 *   GET /statuses            — группировка по статусам (critical/high/medium/low)
 *   GET /status              — статусы стран (совместимо с /api/geo/status)
 *   GET /countries           — топ стран по статусам
 *   GET /boundaries          — world.geojson (границы стран)
 *   GET /index               — история глобального индекса (совместимо с /api/geo/index)
 *   GET /stats               — расширенная статистика
 *   GET /health              — health-check подсистем
 *   GET /latest              — последние маркеры
 *   GET /featurecollection   — чистый GeoJSON маркеров
 *   GET /render              — рендер-конфиг (маркеры + choropleth + legend)
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw, geojson, markers.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const MARKERS_FILE = join(PROJECT_ROOT, 'data', 'basket', 'geo-markers.json');
const STATUS_FILE  = join(PROJECT_ROOT, 'data', 'geo', 'country-status.json');
const STATUS_FALLBACK = join(PROJECT_ROOT, 'data', 'geo', 'status.json');
const BOUNDARIES_FILE = join(PROJECT_ROOT, 'data', 'geo', 'world.geojson');
const INDEX_FILE = join(PROJECT_ROOT, 'data', 'geo', 'index-history.json');

export const route = '/api/layers/geo-markers';
export const method = 'GET';

export const meta = {
  category: 'infrastructure',
  icon: '📍',
  color: '#0891b2',
  vizType: 'marker',
  source: 'basket/geo-markers.json',
  collector: 'collect-geo-markers.mjs',
  cache: 300,
  description: 'Агрегатор геоданных: маркеры событий (NOTAM, пожары), статусы стран, границы мира, история индекса',
  unit: 'markers',
};

// ============================================================
//  СПРАВОЧНИКИ
// ============================================================

const STATUS_META = {
  critical: { color: '#dc2626', label: 'Критический', weight: 4 },
  high:     { color: '#f97316', label: 'Высокий',     weight: 3 },
  medium:   { color: '#eab308', label: 'Средний',     weight: 2 },
  low:      { color: '#84cc16', label: 'Низкий',      weight: 1 },
  info:     { color: '#64748b', label: 'Информация',  weight: 0 },
  unknown:  { color: '#94a3b8', label: 'Неизвестно',  weight: 0 },
};

const LAYER_META = {
  notam:    { color: '#3b82f6', label: 'NOTAM (воздушное пространство)', icon: '✈️' },
  fires:    { color: '#dc2626', label: 'Пожары',                          icon: '🔥' },
  acled:    { color: '#7c2d12', label: 'ACLED (конфликты)',               icon: '⚔️' },
  weather:  { color: '#0891b2', label: 'Погода',                          icon: '⛅' },
  thermal:  { color: '#e11d48', label: 'Тепловые аномалии',               icon: '🌡️' },
  flight:   { color: '#8b5cf6', label: 'Авиация',                         icon: '🛫' },
  ship:     { color: '#0ea5e9', label: 'Судоходство',                     icon: '🚢' },
  event:    { color: '#ec4899', label: 'События',                         icon: '📢' },
  other:    { color: '#64748b', label: 'Прочее',                          icon: '📍' },
};

function statusOf(s) {
  const k = String(s || '').toLowerCase();
  return STATUS_META[k] || STATUS_META.unknown;
}

function layerMetaOf(name) {
  const k = String(name || '').toLowerCase();
  return LAYER_META[k] || { color: '#64748b', label: name || 'Прочее', icon: '📍' };
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadMarkers() {
  let raw;
  try { raw = await fs.readFile(MARKERS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-geo-markers.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_markers: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.markers)) arr = parsed.markers;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  else if (parsed && Array.isArray(parsed.items)) arr = parsed.items;
  if (!arr) { const err = new Error('unrecognized_markers_format'); err.statusCode = 500; throw err; }
  return arr;
}

async function loadStatuses() {
  for (const file of [STATUS_FILE, STATUS_FALLBACK]) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      const parsed = JSON.parse(raw);
      return parsed;
    } catch { continue; }
  }
  return null;
}

async function loadBoundariesRaw() {
  try { return await fs.readFile(BOUNDARIES_FILE, 'utf8'); }
  catch { return null; }
}

async function loadIndex() {
  try {
    const raw = await fs.readFile(INDEX_FILE, 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeMarker(m, i) {
  const lat = Number(m.lat ?? m.latitude);
  const lng = Number(m.lng ?? m.lon ?? m.longitude);
  const status = String(m.status || 'unknown').toLowerCase();
  const layer = String(m.layer || m.type || 'other').toLowerCase();
  const st = statusOf(status);
  const ly = layerMetaOf(layer);

  return {
    id: String(m.id || `marker-${i}`),
    name: m.name || m.title || `Marker ${i}`,
    description: m.description || null,
    lat: Number.isFinite(lat) ? Number(lat.toFixed(4)) : null,
    lng: Number.isFinite(lng) ? Number(lng.toFixed(4)) : null,
    status,
    statusLabel: st.label,
    statusColor: st.color,
    statusWeight: st.weight,
    layer,
    layerLabel: ly.label,
    layerColor: ly.color,
    layerIcon: ly.icon,
    date: String(m.date || m.timestamp || '').slice(0, 10) || null,
    country: m.country || null,
    region: m.region || null,
    category: 'infrastructure',
    icon: meta.icon,
  };
}

function normalizeCountryStatus(c, i) {
  if (!c || typeof c !== 'object') return null;
  const name = c.country || c.name || c.id || `country-${i}`;
  const code = c.code || c.iso || c.iso2 || null;
  const ssi = Number(c.ssi ?? c.cii ?? c.index ?? c.score ?? 0);
  const level = c.level || c.status || null;
  const lv = level ? statusOf(level) : statusOf(ssi >= 70 ? 'critical' : ssi >= 50 ? 'high' : ssi >= 30 ? 'medium' : ssi >= 10 ? 'low' : 'info');
  return {
    id: String(code || name).toLowerCase(),
    name: String(name),
    code,
    ssi: Number.isFinite(ssi) ? Number(ssi.toFixed(2)) : null,
    level: lv.label,
    levelColor: lv.color,
    lat: Number(c.lat) || null,
    lng: Number(c.lng ?? c.lon) || null,
    region: c.region || null,
    updated: c.updated || c.date || null,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyMarkerFilters(rows, query) {
  let r = rows.slice();
  if (query.status) r = r.filter(x => x.status === String(query.status).toLowerCase());
  if (query.layer)  r = r.filter(x => x.layer === String(query.layer).toLowerCase());
  if (query.country) r = r.filter(x => String(x.country || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.q) {
    const s = String(query.q).toLowerCase();
    r = r.filter(x => (x.name + ' ' + (x.description || '')).toLowerCase().includes(s));
  }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.bbox) {
    const [w, s, e, n] = String(query.bbox).split(',').map(Number);
    if ([w, s, e, n].every(Number.isFinite)) {
      r = r.filter(x => x.lat != null && x.lng != null && x.lat >= s && x.lat <= n && x.lng >= w && x.lng <= e);
    }
  }
  const sortKey = query.sort;
  if (sortKey === 'status') r.sort((a, b) => b.statusWeight - a.statusWeight);
  else if (sortKey === 'name') r.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortKey === 'layer') r.sort((a, b) => a.layer.localeCompare(b.layer));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeMarkerStats(rows) {
  const byStatus = {};
  const byLayer = {};
  const byCountry = {};
  const dates = [];
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byLayer[r.layer] = (byLayer[r.layer] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    if (r.date) dates.push(r.date);
  }
  const top = (obj, n = 10) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    with_position: rows.filter(r => r.lat != null && r.lng != null).length,
    by_status: byStatus,
    by_layer: byLayer,
    top_countries: top(byCountry, 10),
    date_from: dates.sort()[0] || null,
    date_to: dates.sort().slice(-1)[0] || null,
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, description: r.description,
        status: r.status, statusLabel: r.statusLabel, statusColor: r.statusColor,
        layer: r.layer, layerLabel: r.layerLabel, layerColor: r.layerColor, layerIcon: r.layerIcon,
        date: r.date, country: r.country, region: r.region,
        category: r.category, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      statuses: Object.entries(STATUS_META).map(([key, def]) => ({ key, ...def })),
      layers: Object.entries(LAYER_META).map(([key, def]) => ({ key, ...def })),
    },
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    id: r.id, name: r.name, status: r.status, layer: r.layer,
    lat: r.lat, lng: r.lng, date: r.date, country: r.country,
  }));
}

function toCSV(rows) {
  const lines = ['id,name,status,layer,lat,lng,country,region,date,description'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const r of rows) {
    lines.push([r.id, r.name, r.status, r.layer, r.lat, r.lng, r.country, r.region, r.date, r.description].map(esc).join(','));
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

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/geo-markers/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const extra = {
      'X-Module': 'geo-markers-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    // ============================================================
    //  /boundaries — отдаём geojson как есть (большой файл)
    // ============================================================
    if (sub === '/boundaries') {
      const raw = await loadBoundariesRaw();
      if (!raw) return sendJSON(res, 503, { error: 'no_data', message: 'world.geojson missing', hint: 'check data/geo/world.geojson' }, extra);
      return sendText(res, 200, raw, 'application/geo+json; charset=utf-8');
    }

    // ============================================================
    //  /index — совместимость с /api/geo/index
    // ============================================================
    if (sub === '/index') {
      const idx = await loadIndex();
      if (!idx) return sendJSON(res, 503, { error: 'no_data', message: 'index-history.json missing' }, extra);
      return sendJSON(res, 200, { success: true, index: idx }, extra);
    }

    // ============================================================
    //  /status — статусы стран (совместимо с /api/geo/status)
    // ============================================================
    if (sub === '/status') {
      const statuses = await loadStatuses();
      if (!statuses) return sendJSON(res, 503, { error: 'no_data', message: 'country-status.json missing' }, extra);
      return sendJSON(res, 200, { success: true, status: statuses }, extra);
    }

    // ============================================================
    //  Загружаем маркеры для остальных эндпоинтов
    // ============================================================
    let rawMarkers = [];
    let markersError = null;
    try { rawMarkers = await loadMarkers(); }
    catch (e) { markersError = e; }

    if (markersError && !['/', '/status', '/health', '/stats'].includes(sub)) {
      const status = markersError.statusCode || 500;
      return sendJSON(res, status, { error: status === 503 ? 'no_data' : 'handler_error', message: markersError.message, hint: markersError.hint }, extra);
    }

    const all = (rawMarkers || []).map(normalizeMarker);

    // ============================================================
    //  /markers
    // ============================================================
    if (sub === '/markers') {
      const rows = applyMarkerFilters(all, query);
      if (format === 'csv') return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
      if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
      if (format === 'raw') return sendJSON(res, 200, { data: rows, total: all.length }, extra);
      if (format === 'geojson') return sendJSON(res, 200, toFeatureCollection(rows), extra);
      return sendJSON(res, 200, { markers: rows, count: rows.length, total: all.length }, extra);
    }

    if (sub.startsWith('/markers/')) {
      const id = decodeURIComponent(sub.slice('/markers/'.length));
      const m = all.find(x => x.id === id);
      if (!m) return sendJSON(res, 404, { error: 'marker_not_found', id }, extra);
      return sendJSON(res, 200, { marker: m }, extra);
    }

    // ============================================================
    //  /layers — группировка по слою
    // ============================================================
    if (sub === '/layers') {
      const byLayer = {};
      for (const r of all) {
        if (!byLayer[r.layer]) byLayer[r.layer] = { name: r.layer, label: r.layerLabel, color: r.layerColor, icon: r.layerIcon, count: 0, by_status: {} };
        byLayer[r.layer].count++;
        byLayer[r.layer].by_status[r.status] = (byLayer[r.layer].by_status[r.status] || 0) + 1;
      }
      const layers = Object.values(byLayer).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { layers, total: layers.length }, extra);
    }

    // ============================================================
    //  /statuses — группировка по статусам
    // ============================================================
    if (sub === '/statuses') {
      const byStatus = {};
      for (const r of all) {
        if (!byStatus[r.status]) byStatus[r.status] = { name: r.status, label: r.statusLabel, color: r.statusColor, weight: r.statusWeight, count: 0, by_layer: {} };
        byStatus[r.status].count++;
        byStatus[r.status].by_layer[r.layer] = (byStatus[r.status].by_layer[r.layer] || 0) + 1;
      }
      const statuses = Object.values(byStatus).sort((a, b) => b.weight - a.weight);
      return sendJSON(res, 200, { statuses, total: statuses.length }, extra);
    }

    // ============================================================
    //  /countries — топ стран по маркерам + статусы
    // ============================================================
    if (sub === '/countries') {
      const byCountry = {};
      for (const r of all) {
        if (!r.country) continue;
        if (!byCountry[r.country]) byCountry[r.country] = { name: r.country, count: 0, by_status: {} };
        byCountry[r.country].count++;
        byCountry[r.country].by_status[r.status] = (byCountry[r.country].by_status[r.status] || 0) + 1;
      }
      const statuses = await loadStatuses();
      let statusRows = [];
      if (statuses) {
        const list = Array.isArray(statuses) ? statuses : (statuses.countries || statuses.data || Object.values(statuses));
        statusRows = list.map(normalizeCountryStatus).filter(Boolean);
      }
      return sendJSON(res, 200, {
        countries: Object.values(byCountry).sort((a, b) => b.count - a.count),
        total_countries: Object.keys(byCountry).length,
        country_statuses: statusRows.slice(0, 50),
      }, extra);
    }

    // ============================================================
    //  /stats
    // ============================================================
    if (sub === '/stats' || format === 'stats') {
      const stats = computeMarkerStats(all);
      const statuses = await loadStatuses();
      const hasStatuses = !!statuses;
      const hasBoundaries = (await loadBoundariesRaw()) !== null;
      const hasIndex = (await loadIndex()) !== null;
      return sendJSON(res, 200, {
        markers_stats: stats,
        sources: {
          markers: rawMarkers.length > 0,
          statuses: hasStatuses,
          boundaries: hasBoundaries,
          index_history: hasIndex,
        },
      }, extra);
    }

    // ============================================================
    //  /health — health-check
    // ============================================================
    if (sub === '/health') {
      const statuses = await loadStatuses();
      const hasBoundaries = (await loadBoundariesRaw()) !== null;
      const hasIndex = (await loadIndex()) !== null;
      const checks = {
        markers: { ok: !markersError, count: all.length, error: markersError ? markersError.message : null },
        statuses: { ok: !!statuses },
        boundaries: { ok: hasBoundaries },
        index_history: { ok: hasIndex },
      };
      const failed = Object.values(checks).filter(c => !c.ok).length;
      return sendJSON(res, 200, { ok: failed === 0, checks_count: Object.keys(checks).length, failed_count: failed, checks, timestamp: new Date().toISOString() }, extra);
    }

    // ============================================================
    //  /latest — последние маркеры
    // ============================================================
    if (sub === '/latest') {
      const latest = all.slice().sort((a, b) => b.statusWeight - a.statusWeight).slice(0, 20);
      return sendJSON(res, 200, { latest, count: latest.length }, extra);
    }

    // ============================================================
    //  /featurecollection — чистый GeoJSON
    // ============================================================
    if (sub === '/featurecollection') {
      const rows = applyMarkerFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    // ============================================================
    //  /render — рендер-конфиг для карты
    // ============================================================
    if (sub === '/render') {
      const rows = applyMarkerFilters(all, query);
      const stats = computeMarkerStats(rows);
      const markers = rows
        .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
        .map(r => ({
          id: r.id, lat: r.lat, lng: r.lng,
          color: r.statusColor, icon: r.layerIcon,
          popup: { name: r.name, status: r.statusLabel, layer: r.layerLabel, description: r.description, date: r.date },
        }));
      return sendJSON(res, 200, {
        render: {
          markers,
          legend: {
            statuses: Object.entries(STATUS_META).map(([key, def]) => ({ key, ...def })),
            layers: Object.entries(LAYER_META).map(([key, def]) => ({ key, ...def })),
          },
          stats,
          totals: { markers: markers.length },
        },
      }, extra);
    }

    // ============================================================
    //  Корень — сводка
    // ============================================================
    const rows = applyMarkerFilters(all, query);

    if (format === 'csv')     return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series')  return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'geojson') return sendJSON(res, 200, toFeatureCollection(rows), extra);
    if (format === 'markers') return sendJSON(res, 200, { markers: rows, count: rows.length, total: all.length }, extra);
    if (format === 'raw')     return sendJSON(res, 200, { data: rows, total: all.length, sources: { markers: rawMarkers.length } }, extra);

    const stats = computeMarkerStats(rows);
    const statuses = await loadStatuses();
    const hasBoundaries = (await loadBoundariesRaw()) !== null;
    const hasIndex = (await loadIndex()) !== null;
    const fc = toFeatureCollection(rows);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_markers: all.length, returned_markers: rows.length,
        generated_at: new Date().toISOString(),
        sources: {
          markers: rawMarkers.length > 0,
          statuses: !!statuses,
          boundaries: hasBoundaries,
          index_history: hasIndex,
        },
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats,
      markers_count: rows.length,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
