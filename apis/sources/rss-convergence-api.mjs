/**
 * apis/sources/rss-convergence-api.mjs — API-МОДУЛЬ: RSS-CONVERGENCE
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/semantic/rss-convergence.json.
 * Анализатор: scripts/analyzers/rss-convergence.mjs (v1.0.0).
 * Класс: apis/sources/rss-convergence.mjs.
 *
 * Обнаружение convergent stories: темы, которые независимо подхватили
 * 5+ источников в окне 6 часов (rss-latest, rss, newsapi-latest, newsapi-real).
 *
 * ОТЛИЧИЕ ОТ source-coordination:
 *   source-coordination — координация (2+ источника в окне ±30 минут, sim>0.7).
 *   rss-convergence — массовость (5+ источников в окне 6 часов, sim>0.5).
 *
 * ЭНДПОИНТЫ:
 *   GET /                — сводка
 *   GET /stats           — статистика
 *   GET /stories         — все convergent stories (фильтры)
 *   GET /top             — топ-N (?n=10)
 *   GET /by-source       — агрегация по источникам
 *   GET /story/:id       — детали конкретной истории
 *   GET /features        — GeoJSON (без координат, пустой)
 *
 * ФИЛЬТРЫ:
 *   ?n=10                — количество
 *   ?minScore=3          — минимальный convergenceScore
 *   ?minSources=10       — минимум источников
 *   ?level=critical      — уровень (critical/high/medium/low)
 *   ?source=tass         — источник входит в story
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'semantic', 'rss-convergence.json');

export const route  = '/api/layers/rss-convergence';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '📰',
  color: '#0ea5e9',
  vizType: 'marker',
  source: 'analytics/semantic/rss-convergence.json',
  collector: 'analyzer:rss-convergence',
  cache: 300,
  description: 'RSS-convergence: convergent stories (5+ источников в окне 6 часов)',
  unit: 'stories',
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
      err.hint = 'run scripts/analyzers/rss-convergence.mjs'; throw err;
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
    minSources: q.has('minSources') ? parseInt(q.get('minSources'), 10) : null,
    level: q.get('level') || null,
    source: q.get('source') || null,
  };
}

function applyFilters(items, filters) {
  let result = items;
  if (filters.minScore != null && isNaN(filters.minScore) === false) result = result.filter(x => x.convergenceScore >= filters.minScore);
  if (filters.minSources != null && isNaN(filters.minSources) === false) result = result.filter(x => x.sourceCount >= filters.minSources);
  if (filters.level) result = result.filter(x => x.level === filters.level);
  if (filters.source) result = result.filter(x => x.sources && x.sources.includes(filters.source));
  if (filters.n != null) result = result.slice(0, filters.n);
  return result;
}

function levelColor(level) {
  if (level === 'critical') return '#7f1d1d';
  if (level === 'high') return '#dc2626';
  if (level === 'medium') return '#f97316';
  return '#22c55e';
}

function enrich(x) {
  return { ...x, color: levelColor(x.level) };
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

  // /story/:id
  const storyMatch = pathname.match(/\/story\/(story_[0-9]+)$/);
  if (storyMatch) {
    const id = storyMatch[1];
    const found = (data.data.stories || []).find(s => s.storyId === id);
    if (!found) return sendJson(res, { error: 'story_not_found', storyId: id }, 404);
    return sendJson(res, { _meta: data._meta, story: enrich(found) });
  }

  if (pathname === route || pathname === route + '') {
    const enriched = (data.data.stories || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      data: {
        stories: filtered,
        total: filtered.length,
        total_all: (data.data.stories || []).length,
        by_source: data.data.by_source || {},
        stats: data._meta.stats || null,
        generated_at: data.data.generated_at,
      },
    });
  }

  if (pathname === route + '/stats') {
    return sendJson(res, { _meta: data._meta, stats: data._meta.stats });
  }

  if (pathname === route + '/stories') {
    const enriched = (data.data.stories || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, { _meta: data._meta, total: filtered.length, stories: filtered });
  }

  if (pathname === route + '/top') {
    const n = filters.n || 10;
    const enriched = (data.data.stories || []).map(enrich);
    return sendJson(res, { _meta: data._meta, total: Math.min(n, enriched.length), stories: enriched.slice(0, n) });
  }

  if (pathname === route + '/by-source') {
    return sendJson(res, { _meta: data._meta, by_source: data.data.by_source || {} });
  }

  if (pathname === route + '/features') {
    return sendJson(res, {
      _meta: data._meta,
      type: 'FeatureCollection',
      features: [],
      note: 'Convergent stories have no geo coordinates in current data',
    });
  }

  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [
      route,
      route + '/stats',
      route + '/stories',
      route + '/top',
      route + '/by-source',
      route + '/story/:id',
      route + '/features',
    ],
  }, 404);
}
