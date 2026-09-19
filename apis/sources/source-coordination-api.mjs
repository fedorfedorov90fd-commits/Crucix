/**
 * apis/sources/source-coordination-api.mjs — API-МОДУЛЬ: КООРДИНАЦИЯ ИСТОЧНИКОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/source-coordination.json.
 * Анализатор: scripts/analyzers/source-coordination.mjs (v1.0.0).
 *
 * Координированные публикации: N формально независимых источников
 * публикуют схожий по смыслу заголовок в узком временном окне.
 * 2 источника: news, gdelt_news.
 *
 * ЭНДПОИНТЫ:
 *   GET /                — сводка
 *   GET /stats           — статистика
 *   GET /clusters        — только кластеры (фильтры)
 *   GET /by-source       — агрегация по источникам
 *   GET /top             — топ-N (?n=10)
 *
 * ФИЛЬТРЫ:
 *   ?n=10                  — количество
 *   ?minScore=1.5          — минимальный coordinationScore
 *   ?level=critical        — уровень (critical/high/medium)
 *   ?source=interfax       — фильтр по источнику (входит в кластер)
 *   ?maxTimeSpanMin=60     — максимальный временной разброс
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'source-coordination.json');

export const route  = '/api/layers/source-coordination';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '📡',
  color: '#0891b2',
  vizType: 'marker',
  source: 'analytics/specialist/source-coordination.json',
  collector: 'analyzer:source-coordination',
  cache: 300,
  description: 'Координированные публикации: N источников, схожий смысл, узкое временное окно',
  unit: 'clusters',
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
      err.hint = 'run scripts/analyzers/source-coordination.mjs'; throw err;
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
    source: q.get('source') || null,
    maxTimeSpanMin: q.has('maxTimeSpanMin') ? parseFloat(q.get('maxTimeSpanMin')) : null,
  };
}

function applyFilters(clusters, filters) {
  let result = clusters;
  if (filters.minScore != null && !isNaN(filters.minScore)) result = result.filter(c => c.coordinationScore >= filters.minScore);
  if (filters.level) result = result.filter(c => c.level === filters.level);
  if (filters.source) result = result.filter(c => c.sources && c.sources.includes(filters.source));
  if (filters.maxTimeSpanMin != null && !isNaN(filters.maxTimeSpanMin)) result = result.filter(c => c.timeSpanMin <= filters.maxTimeSpanMin);
  if (filters.n != null) result = result.slice(0, filters.n);
  return result;
}

function levelColor(level) {
  if (level === 'critical') return '#7f1d1d';
  if (level === 'high') return '#dc2626';
  return '#f97316';
}

function enrich(c) {
  return { ...c, color: levelColor(c.level) };
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
    const enriched = (data.data.clusters || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      data: {
        clusters: filtered,
        total: filtered.length,
        total_all: (data.data.clusters || []).length,
        by_source: data.data.by_source || {},
        stats: data.data.stats || null,
        generated_at: data.data.generated_at,
      },
    });
  }

  if (pathname === route + '/stats') {
    return sendJson(res, { _meta: data._meta, stats: data.data.stats });
  }

  if (pathname === route + '/clusters') {
    const enriched = (data.data.clusters || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, { _meta: data._meta, total: filtered.length, clusters: filtered });
  }

  if (pathname === route + '/by-source') {
    return sendJson(res, { _meta: data._meta, by_source: data.data.by_source || {} });
  }

  if (pathname === route + '/top') {
    const n = filters.n || 10;
    const enriched = (data.data.clusters || []).map(enrich);
    return sendJson(res, { _meta: data._meta, total: Math.min(n, enriched.length), clusters: enriched.slice(0, n) });
  }

  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [route, route + '/stats', route + '/clusters', route + '/by-source', route + '/top'],
  }, 404);
}
