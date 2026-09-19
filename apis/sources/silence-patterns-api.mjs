/**
 * apis/sources/silence-patterns-api.mjs — API-МОДУЛЬ: АНОМАЛЬНОЕ МОЛЧАНИЕ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/silence-patterns.json.
 * Анализатор: scripts/analyzers/silence-patterns.mjs (v1.0.0).
 *
 * Аномальное молчание: тема исчезает из медиа-потока при обычной активности.
 * 7 источников: news, gdelt_news, interfax, ria, tass, bbc, google-trends.
 *
 * ЭНДПОИНТЫ:
 *   GET /                    — сводка
 *   GET /stats               — статистика
 *   GET /silences            — только молчания (фильтры)
 *   GET /by-topic            — агрегация по темам
 *   GET /top                 — топ-N (?n=10)
 *
 * ФИЛЬТРЫ:
 *   ?n=10            — количество
 *   ?minScore=1.5    — минимальный балл
 *   ?level=critical  — уровень
 *   ?topic=ukraine   — фильтр по теме
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'silence-patterns.json');

export const route  = '/api/layers/silence-patterns';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🤫',
  color: '#6366f1',
  vizType: 'marker',
  source: 'analytics/specialist/silence-patterns.json',
  collector: 'analyzer:silence-patterns',
  cache: 300,
  description: 'Аномальное молчание: тема исчезает из медиа-потока при обычной активности',
  unit: 'silences',
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
      err.hint = 'run scripts/analyzers/silence-patterns.mjs'; throw err;
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
    topic: q.get('topic') || null,
  };
}

function applyFilters(items, filters) {
  let result = items;
  if (filters.minScore != null && !isNaN(filters.minScore)) result = result.filter(x => x.silenceScore >= filters.minScore);
  if (filters.level) result = result.filter(x => x.level === filters.level);
  if (filters.topic) result = result.filter(x => x.topic.includes(filters.topic));
  if (filters.n != null) result = result.slice(0, filters.n);
  return result;
}

function levelColor(level) {
  if (level === 'critical') return '#7f1d1d';
  if (level === 'high') return '#dc2626';
  return '#f97316';
}

function enrich(s) {
  return { ...s, color: levelColor(s.level) };
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
    const enriched = (data.data.silences || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      data: {
        silences: filtered,
        total: filtered.length,
        total_all: (data.data.silences || []).length,
        by_topic: data.data.by_topic || {},
        stats: data.data.stats || null,
        generated_at: data.data.generated_at,
      },
    });
  }

  if (pathname === route + '/stats') {
    return sendJson(res, { _meta: data._meta, stats: data.data.stats });
  }

  if (pathname === route + '/silences') {
    const enriched = (data.data.silences || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, { _meta: data._meta, total: filtered.length, silences: filtered });
  }

  if (pathname === route + '/by-topic') {
    return sendJson(res, { _meta: data._meta, by_topic: data.data.by_topic || {} });
  }

  if (pathname === route + '/top') {
    const n = filters.n || 10;
    const enriched = (data.data.silences || []).map(enrich);
    return sendJson(res, { _meta: data._meta, total: Math.min(n, enriched.length), silences: enriched.slice(0, n) });
  }

  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [route, route + '/stats', route + '/silences', route + '/by-topic', route + '/top'],
  }, 404);
}

