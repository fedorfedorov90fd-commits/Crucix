/**
 * apis/sources/data-discrepancy-api.mjs — API-МОДУЛЬ: РАСХОЖДЕНИЕ ДАННЫХ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/data-discrepancy.json.
 * Анализатор: scripts/analyzers/data-discrepancy.mjs (v1.0.0).
 *
 * Расхождение официальных данных: сравнение источников по странам и показателям.
 * 6 источников: worldbank, rest-countries, fred, who, happiness, freedom.
 *
 * ЭНДПОИНТЫ:
 *   GET /                — сводка
 *   GET /stats           — статистика
 *   GET /discrepancies   — только расхождения (фильтры)
 *   GET /by-country      — агрегация по странам
 *   GET /by-indicator    — агрегация по показателям
 *   GET /top             — топ-N (?n=10)
 *
 * ФИЛЬТРЫ:
 *   ?n=10                  — количество
 *   ?minScore=1.5          — минимальный discrepancyScore
 *   ?level=critical        — уровень (critical/high/medium)
 *   ?country=USA           — фильтр по стране
 *   ?indicator=population  — фильтр по показателю
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'data-discrepancy.json');

export const route  = '/api/layers/data-discrepancy';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '⚖️',
  color: '#ca8a04',
  vizType: 'marker',
  source: 'analytics/specialist/data-discrepancy.json',
  collector: 'analyzer:data-discrepancy',
  cache: 300,
  description: 'Расхождение официальных данных: сравнение источников по странам и показателям',
  unit: 'discrepancies',
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
      err.hint = 'run scripts/analyzers/data-discrepancy.mjs'; throw err;
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
    indicator: q.get('indicator') ? q.get('indicator').toLowerCase() : null,
  };
}

function applyFilters(items, filters) {
  let result = items;
  if (filters.minScore != null && !isNaN(filters.minScore)) result = result.filter(x => x.discrepancyScore >= filters.minScore);
  if (filters.level) result = result.filter(x => x.level === filters.level);
  if (filters.country) result = result.filter(x => x.country === filters.country);
  if (filters.indicator) result = result.filter(x => x.indicator === filters.indicator);
  if (filters.n != null) result = result.slice(0, filters.n);
  return result;
}

function levelColor(level) {
  if (level === 'critical') return '#7f1d1d';
  if (level === 'high') return '#dc2626';
  return '#f97316';
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

  if (pathname === route || pathname === route + '') {
    const enriched = (data.data.discrepancies || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      data: {
        discrepancies: filtered,
        total: filtered.length,
        total_all: (data.data.discrepancies || []).length,
        by_country: data.data.by_country || {},
        stats: data.data.stats || null,
        generated_at: data.data.generated_at,
      },
    });
  }

  if (pathname === route + '/stats') {
    return sendJson(res, { _meta: data._meta, stats: data.data.stats });
  }

  if (pathname === route + '/discrepancies') {
    const enriched = (data.data.discrepancies || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, { _meta: data._meta, total: filtered.length, discrepancies: filtered });
  }

  if (pathname === route + '/by-country') {
    return sendJson(res, { _meta: data._meta, by_country: data.data.by_country || {} });
  }

  if (pathname === route + '/by-indicator') {
    const all = data.data.discrepancies || [];
    const byInd = {};
    for (const d of all) {
      if (!byInd[d.indicator]) byInd[d.indicator] = { count: 0, maxScore: 0, maxSpreadPct: 0, levels: {} };
      byInd[d.indicator].count++;
      if (d.discrepancyScore > byInd[d.indicator].maxScore) byInd[d.indicator].maxScore = d.discrepancyScore;
      if (d.spreadPct > byInd[d.indicator].maxSpreadPct) byInd[d.indicator].maxSpreadPct = d.spreadPct;
      byInd[d.indicator].levels[d.level] = (byInd[d.indicator].levels[d.level] || 0) + 1;
    }
    return sendJson(res, { _meta: data._meta, by_indicator: byInd });
  }

  if (pathname === route + '/top') {
    const n = filters.n || 10;
    const enriched = (data.data.discrepancies || []).map(enrich);
    return sendJson(res, { _meta: data._meta, total: Math.min(n, enriched.length), discrepancies: enriched.slice(0, n) });
  }

  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [route, route + '/stats', route + '/discrepancies', route + '/by-country', route + '/by-indicator', route + '/top'],
  }, 404);
}
