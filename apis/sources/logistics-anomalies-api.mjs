/**
 * apis/sources/logistics-anomalies-api.mjs — API-МОДУЛЬ: ЛОГИСТИЧЕСКИЕ АНОМАЛИИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/logistics-anomalies.json.
 * Анализатор: scripts/analyzers/logistics-anomalies.mjs (v1.0.0).
 *
 * Логистические аномалии — накопление транспорта перед событием.
 * 6 источников: aviation, dark-ships, ships, military-exercises, notam, infrastructure.
 *
 * ЭНДПОИНТЫ:
 *   GET /                       — сводка
 *   GET /stats                  — только статистика
 *   GET /anomalies              — только аномалии (фильтры)
 *   GET /clusters               — только кластеры
 *   GET /by-type                — агрегация по типам
 *   GET /by-region              — агрегация по регионам
 *   GET /featurecollection      — GeoJSON для карты
 *   GET /top                    — топ-N аномалий (?n=10)
 *
 * ФИЛЬТРЫ (query):
 *   ?n=10            — количество
 *   ?minScore=2.0    — минимальный score
 *   ?type=dark-ship  — фильтр по типу
 *   ?region=Europe   — фильтр по региону
 *   ?level=critical  — фильтр по уровню (critical/high/medium/low)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'logistics-anomalies.json');

export const route  = '/api/layers/logistics-anomalies';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🚢',
  color: '#0891b2',
  vizType: 'marker',
  source: 'analytics/specialist/logistics-anomalies.json',
  collector: 'analyzer:logistics-anomalies',
  cache: 300,
  description: 'Логистические аномалии: накопление транспорта перед событием (6 источников)',
  unit: 'anomalies',
};

// ============================================================
//  ЦВЕТОВАЯ ШКАЛА
// ============================================================

function anomalyColor(score) {
  if (score >= 5) return { level: 'critical', color: '#7f1d1d', label: 'Критическая' };
  if (score >= 3) return { level: 'high',     color: '#dc2626', label: 'Высокая' };
  if (score >= 2) return { level: 'medium',   color: '#f97316', label: 'Средняя' };
  return               { level: 'low',      color: '#eab308', label: 'Низкая' };
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadData() {
  if (_cache && (Date.now() - _cacheTime) < CACHE_TTL_MS) return _cache;
  let raw;
  try {
    raw = await fs.readFile(ANALYTICS_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data');
      err.statusCode = 503;
      err.hint = 'run scripts/analyzers/logistics-anomalies.mjs';
      throw err;
    }
    throw e;
  }
  const data = JSON.parse(raw);
  if (!data || !data.data) {
    const err = new Error('malformed_data');
    err.statusCode = 500;
    throw err;
  }
  _cache = data;
  _cacheTime = Date.now();
  return data;
}

// ============================================================
//  УТИЛИТЫ
// ============================================================

function parseQuery(url) {
  const q = url.searchParams;
  return {
    n: q.has('n') ? Math.max(1, Math.min(parseInt(q.get('n'), 10) || 10, 1000)) : null,
    minScore: q.has('minScore') ? parseFloat(q.get('minScore')) : null,
    type: q.get('type') || null,
    region: q.get('region') || null,
    level: q.get('level') || null,
  };
}

function regionOf(lat, lon) {
  if (lat < -60) return 'Antarctica';
  if (lat >= 15 && lon >= -170 && lon <= -30) return 'Americas';
  if (lat >= 35 && lat <= 72 && lon >= -25 && lon <= 60) return 'Europe';
  if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) return 'Africa';
  if (lat >= -50 && lat <= 0 && lon >= 110 && lon <= 180) return 'Oceania';
  return 'Asia';
}

function applyFilters(items, filters) {
  let result = items;
  if (filters.minScore != null && !isNaN(filters.minScore)) {
    result = result.filter(h => h.score >= filters.minScore);
  }
  if (filters.type) {
    result = result.filter(h => h.dominantType === filters.type ||
      (h.types && Object.keys(h.types).includes(filters.type)));
  }
  if (filters.region) {
    result = result.filter(h => regionOf(h.lat, h.lon) === filters.region);
  }
  if (filters.level) {
    result = result.filter(h => h.level === filters.level);
  }
  if (filters.n != null) {
    result = result.slice(0, filters.n);
  }
  return result;
}

function enrichAnomaly(a) {
  const cm = anomalyColor(a.score);
  return {
    ...a,
    level: cm.level,
    levelLabel: cm.label,
    color: cm.color,
    region: regionOf(a.lat, a.lon),
  };
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

function sendJson(res, payload, status = 200) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function sendError(res, err) {
  const status = err.statusCode || 500;
  sendJson(res, { error: err.message, hint: err.hint || null }, status);
}

// ============================================================
//  ГЛАВНЫЙ ОБРАБОТЧИК
// ============================================================

export async function handler(req, res) {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    return sendError(res, e);
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname.replace(/\/+$/, '');
  const filters = parseQuery(url);

  // --- КОРЕНЬ ---
  if (pathname === route || pathname === route + '') {
    const enriched = (data.data.anomalies || []).map(enrichAnomaly);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      data: {
        anomalies: filtered,
        total: filtered.length,
        total_all: (data.data.anomalies || []).length,
        clusters: data.data.clusters || [],
        by_type: data.data.by_type || {},
        by_region: data.data.by_region || {},
        stats: data.data.stats || null,
        generated_at: data.data.generated_at,
      },
    });
  }

  // --- /stats ---
  if (pathname === route + '/stats') {
    return sendJson(res, { _meta: data._meta, stats: data.data.stats });
  }

  // --- /anomalies ---
  if (pathname === route + '/anomalies') {
    const enriched = (data.data.anomalies || []).map(enrichAnomaly);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      total: filtered.length,
      total_all: (data.data.anomalies || []).length,
      anomalies: filtered,
    });
  }

  // --- /clusters ---
  if (pathname === route + '/clusters') {
    let clusters = data.data.clusters || [];
    if (filters.n != null) clusters = clusters.slice(0, filters.n);
    return sendJson(res, {
      _meta: data._meta,
      total: clusters.length,
      clusters,
    });
  }

  // --- /by-type ---
  if (pathname === route + '/by-type') {
    return sendJson(res, { _meta: data._meta, by_type: data.data.by_type || {} });
  }

  // --- /by-region ---
  if (pathname === route + '/by-region') {
    return sendJson(res, { _meta: data._meta, by_region: data.data.by_region || {} });
  }

  // --- /top ---
  if (pathname === route + '/top') {
    const n = filters.n || 10;
    const enriched = (data.data.anomalies || []).map(enrichAnomaly);
    const top = enriched.slice(0, n);
    return sendJson(res, { _meta: data._meta, total: top.length, anomalies: top });
  }

  // --- /featurecollection ---
  if (pathname === route + '/featurecollection') {
    const enriched = (data.data.anomalies || []).map(enrichAnomaly);
    const filtered = applyFilters(enriched, filters);
    const features = filtered.map(a => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
      properties: {
        cellId: a.cellId,
        eventCount: a.eventCount,
        avgSeverity: a.avgSeverity,
        deviation: a.deviation,
        score: a.score,
        dominantType: a.dominantType,
        typeDiversity: a.typeDiversity,
        uniqueSources: a.uniqueSources,
        level: a.level,
        levelLabel: a.levelLabel,
        color: a.color,
        region: a.region,
        types: a.types,
      },
    }));
    return sendJson(res, {
      _meta: data._meta,
      type: 'FeatureCollection',
      features,
      total: features.length,
    });
  }

  // --- 404 ---
  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [
      route,
      route + '/stats',
      route + '/anomalies',
      route + '/clusters',
      route + '/by-type',
      route + '/by-region',
      route + '/top',
      route + '/featurecollection',
    ],
  }, 404);
}

