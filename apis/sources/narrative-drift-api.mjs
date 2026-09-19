/**
 * apis/sources/narrative-drift-api.mjs — API-МОДУЛЬ: РАСХОЖДЕНИЕ СЛОВ И ДЕЙСТВИЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/narrative-drift.json.
 * Анализатор: scripts/analyzers/narrative-drift.mjs (v1.0.0).
 *
 * Расхождение между официальными заявлениями и фактическими действиями.
 * 10 источников: news, gdelt_news, interfax, ria, tass, bbc, acled,
 * military-exercises, notam, gps-jamming.
 *
 * ЭНДПОИНТЫ:
 *   GET /                    — сводка
 *   GET /stats               — только статистика
 *   GET /drifts              — расхождения (фильтры)
 *   GET /by-country          — агрегация по странам
 *   GET /top                 — топ-N стран по расхождению
 *   GET /featurecollection   — GeoJSON (если есть координаты)
 *
 * ФИЛЬТРЫ (query):
 *   ?n=10            — количество
 *   ?minScore=1.5    — минимальный балл
 *   ?level=critical  — уровень (critical/high/medium/low)
 *   ?country=USA     — фильтр по стране
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'narrative-drift.json');

export const route  = '/api/layers/narrative-drift';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🔍',
  color: '#9333ea',
  vizType: 'marker',
  source: 'analytics/specialist/narrative-drift.json',
  collector: 'analyzer:narrative-drift',
  cache: 300,
  description: 'Расхождение слов и действий: официальные заявления против физических данных',
  unit: 'drifts',
};

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadData() {
  if (_cache && (Date.now() - _cacheTime) < CACHE_TTL_MS) return _cache;
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/narrative-drift.mjs'; throw err;
    }
    throw e;
  }
  const data = JSON.parse(raw);
  if (!data || !data.data) { const err = new Error('malformed_data'); err.statusCode = 500; throw err; }
  _cache = data; _cacheTime = Date.now();
  return data;
}

function parseQuery(url) {
  const q = url.searchParams;
  return {
    n: q.has('n') ? Math.max(1, Math.min(parseInt(q.get('n'), 10) || 10, 1000)) : null,
    minScore: q.has('minScore') ? parseFloat(q.get('minScore')) : null,
    level: q.get('level') || null,
    country: q.get('country') ? q.get('country').toUpperCase() : null,
  };
}

function applyFilters(items, filters) {
  let result = items;
  if (filters.minScore != null && !isNaN(filters.minScore)) result = result.filter(x => x.driftScore >= filters.minScore);
  if (filters.level) result = result.filter(x => x.level === filters.level);
  if (filters.country) result = result.filter(x => x.country === filters.country);
  if (filters.n != null) result = result.slice(0, filters.n);
  return result;
}

function levelColor(level) {
  if (level === 'critical') return '#7f1d1d';
  if (level === 'high') return '#dc2626';
  if (level === 'medium') return '#f97316';
  return '#eab308';
}

function enrichDrift(d) {
  return { ...d, color: levelColor(d.level) };
}

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
  sendJson(res, { error: err.message, hint: err.hint || null }, err.statusCode || 500);
}

export async function handler(req, res) {
  let data;
  try { data = await loadData(); }
  catch (e) { return sendError(res, e); }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname.replace(/\/+$/, '');
  const filters = parseQuery(url);

  if (pathname === route || pathname === route + '') {
    const enriched = (data.data.drifts || []).map(enrichDrift);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      data: {
        drifts: filtered,
        total: filtered.length,
        total_all: (data.data.drifts || []).length,
        by_country: data.data.by_country || {},
        stats: data.data.stats || null,
        generated_at: data.data.generated_at,
      },
    });
  }

  if (pathname === route + '/stats') {
    return sendJson(res, { _meta: data._meta, stats: data.data.stats });
  }

  if (pathname === route + '/drifts') {
    const enriched = (data.data.drifts || []).map(enrichDrift);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, { _meta: data._meta, total: filtered.length, drifts: filtered });
  }

  if (pathname === route + '/by-country') {
    return sendJson(res, { _meta: data._meta, by_country: data.data.by_country || {} });
  }

  if (pathname === route + '/top') {
    const n = filters.n || 10;
    const enriched = (data.data.drifts || []).map(enrichDrift);
    return sendJson(res, { _meta: data._meta, total: Math.min(n, enriched.length), drifts: enriched.slice(0, n) });
  }

  if (pathname === route + '/featurecollection') {
    const enriched = (data.data.drifts || []).map(enrichDrift);
    const filtered = applyFilters(enriched, filters);
    const features = filtered.filter(d => d.lat != null && d.lon != null).map(d => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: {
        country: d.country,
        statements: d.statements,
        actions: d.actions,
        driftScore: d.driftScore,
        level: d.level,
        color: d.color,
      },
    }));
    return sendJson(res, { _meta: data._meta, type: 'FeatureCollection', features, total: features.length });
  }

  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [route, route + '/stats', route + '/drifts', route + '/by-country', route + '/top', route + '/featurecollection'],
  }, 404);
}

