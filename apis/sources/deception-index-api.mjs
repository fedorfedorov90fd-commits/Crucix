/**
 * apis/sources/deception-index-api.mjs — API-МОДУЛЬ: СВОДНЫЙ ИНДЕКС ДОСТОВЕРНОСТИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/deception-index.json.
 * Анализатор: scripts/analyzers/deception-index.mjs (v1.0.0).
 *
 * Сводный индекс достоверности: композит из 5 измерений
 * (narrative-drift, data-discrepancy, logistics-anomalies,
 * source-coordination, silence-patterns).
 *
 * ЭНДПОИНТЫ:
 *   GET /                — сводка
 *   GET /stats           — статистика
 *   GET /countries       — все страны (фильтры)
 *   GET /top             — топ-N (?n=10)
 *   GET /bottom          — низ-N (наименьший индекс)
 *   GET /by-level        — группировка по уровню
 *   GET /detail/:code    — детали по стране
 *
 * ФИЛЬТРЫ:
 *   ?n=10              — количество
 *   ?minIndex=0.4      — минимальный индекс
 *   ?maxIndex=1.0      — максимальный индекс
 *   ?level=critical    — уровень (critical/high/medium/low)
 *   ?minComponents=3   — минимум активных компонентов
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'deception-index.json');

export const route  = '/api/layers/deception-index';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🎭',
  color: '#7c3aed',
  vizType: 'choropleth',
  source: 'analytics/specialist/deception-index.json',
  collector: 'analyzer:deception-index',
  cache: 300,
  description: 'Сводный индекс достоверности: композит из 5 измерений по странам',
  unit: 'index',
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
      err.hint = 'run scripts/analyzers/deception-index.mjs'; throw err;
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
    minIndex: q.has('minIndex') ? parseFloat(q.get('minIndex')) : null,
    maxIndex: q.has('maxIndex') ? parseFloat(q.get('maxIndex')) : null,
    level: q.get('level') || null,
    minComponents: q.has('minComponents') ? parseInt(q.get('minComponents'), 10) : null,
  };
}

function applyFilters(items, filters) {
  let result = items;
  if (filters.minIndex != null && !isNaN(filters.minIndex)) result = result.filter(x => x.deceptionIndex >= filters.minIndex);
  if (filters.maxIndex != null && !isNaN(filters.maxIndex)) result = result.filter(x => x.deceptionIndex <= filters.maxIndex);
  if (filters.level) result = result.filter(x => x.level === filters.level);
  if (filters.minComponents != null && !isNaN(filters.minComponents)) result = result.filter(x => x.componentsPresent >= filters.minComponents);
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

  // /detail/:code
  const detailMatch = pathname.match(/\/detail\/([A-Z]{2,3})$/i);
  if (detailMatch) {
    const code = detailMatch[1].toUpperCase();
    const found = (data.data.countries || []).find(c => c.country === code);
    if (!found) return sendJson(res, { error: 'country_not_found', country: code }, 404);
    return sendJson(res, { _meta: data._meta, country: enrich(found) });
  }

  if (pathname === route || pathname === route + '') {
    const enriched = (data.data.countries || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      data: {
        countries: filtered,
        total: filtered.length,
        total_all: (data.data.countries || []).length,
        stats: data.data.stats || null,
        generated_at: data.data.generated_at,
      },
    });
  }

  if (pathname === route + '/stats') {
    return sendJson(res, { _meta: data._meta, stats: data.data.stats });
  }

  if (pathname === route + '/countries') {
    const enriched = (data.data.countries || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, { _meta: data._meta, total: filtered.length, countries: filtered });
  }

  if (pathname === route + '/top') {
    const n = filters.n || 10;
    const enriched = (data.data.countries || []).map(enrich);
    return sendJson(res, { _meta: data._meta, total: Math.min(n, enriched.length), countries: enriched.slice(0, n) });
  }

  if (pathname === route + '/bottom') {
    const n = filters.n || 10;
    const enriched = (data.data.countries || []).map(enrich);
    const sorted = [...enriched].sort((a, b) => a.deceptionIndex - b.deceptionIndex);
    return sendJson(res, { _meta: data._meta, total: Math.min(n, sorted.length), countries: sorted.slice(0, n) });
  }

  if (pathname === route + '/by-level') {
    const byLevel = { critical: [], high: [], medium: [], low: [] };
    for (const c of (data.data.countries || [])) {
      const lvl = c.level || 'low';
      if (!byLevel[lvl]) byLevel[lvl] = [];
      byLevel[lvl].push(enrich(c));
    }
    return sendJson(res, { _meta: data._meta, by_level: byLevel });
  }

  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [
      route,
      route + '/stats',
      route + '/countries',
      route + '/top',
      route + '/bottom',
      route + '/by-level',
      route + '/detail/:code',
    ],
  }, 404);
}
