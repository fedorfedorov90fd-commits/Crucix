/**
 * apis/sources/convergence-engine-api.mjs — API-МОДУЛЬ: ДВИЖОК СХОЖДЕНИЯ СИГНАЛОВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/convergence-engine.json.
 * Анализатор: scripts/analyzers/convergence-engine.mjs (v1.0.0).
 * Класс: apis/sources/convergence-engine.mjs.
 *
 * УНИКАЛЬНОЕ ПРЕИМУЩЕСТВО: у World Monitor convergence по RSS,
 * у Crucix — по всем 8 категориям (59 анализаторов × 30 наук).
 *
 * ЭНДПОИНТЫ:
 *   GET /                     — сводка
 *   GET /stats                — статистика
 *   GET /convergences         — все схождения (фильтры)
 *   GET /top                  — топ-N (?n=10)
 *   GET /by-region/:region    — детали по региону
 *   GET /by-category/:cat     — все схождения с этой категорией
 *   GET /modules              — список модулей с их сигналами
 *   GET /featurecollection    — GeoJSON (регионы как точки, если есть координаты)
 *
 * ФИЛЬТРЫ:
 *   ?n=10                — количество
 *   ?minScore=1.5        — минимальный convergenceScore
 *   ?minCategories=4     — минимум уникальных категорий
 *   ?level=critical      — уровень (critical/high/medium/low)
 *   ?category=detector   — фильтр по категории в схождении
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'convergence-engine.json');

export const route  = '/api/layers/convergence-engine';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🌀',
  color: '#7c3aed',
  vizType: 'choropleth',
  source: 'analytics/specialist/convergence-engine.json',
  collector: 'analyzer:convergence-engine',
  cache: 300,
  description: 'Универсальный движок схождения сигналов: пересечение 8 категорий анализаторов (уникально над RSS-based convergence)',
  unit: 'convergences',
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
      err.hint = 'run scripts/analyzers/convergence-engine.mjs'; throw err;
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
    minCategories: q.has('minCategories') ? parseInt(q.get('minCategories'), 10) : null,
    level: q.get('level') || null,
    category: q.get('category') || null,
  };
}

function applyFilters(items, filters) {
  let result = items;
  if (filters.minScore != null && !isNaN(filters.minScore)) result = result.filter(x => x.convergenceScore >= filters.minScore);
  if (filters.minCategories != null && !isNaN(filters.minCategories)) result = result.filter(x => x.categories >= filters.minCategories);
  if (filters.level) result = result.filter(x => x.level === filters.level);
  if (filters.category) result = result.filter(x => x.categorySignals && x.categorySignals[filters.category] != null);
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

  // /by-region/:region
  const regMatch = pathname.match(/\/by-region\/([A-Z][A-Z0-9 _-]{1,40})$/i);
  if (regMatch) {
    const reg = decodeURIComponent(regMatch[1]).toUpperCase();
    const found = (data.data.convergences || []).find(c => c.region === reg);
    if (!found) return sendJson(res, { error: 'region_not_found', region: reg }, 404);
    return sendJson(res, { _meta: data._meta, convergence: enrich(found) });
  }

  // /by-category/:cat
  const catMatch = pathname.match(/\/by-category\/([a-z]+)$/i);
  if (catMatch) {
    const cat = catMatch[1].toLowerCase();
    const filtered = (data.data.convergences || []).filter(c => c.categorySignals && c.categorySignals[cat] != null);
    return sendJson(res, { _meta: data._meta, category: cat, total: filtered.length, convergences: filtered.map(enrich) });
  }

  if (pathname === route || pathname === route + '') {
    const enriched = (data.data.convergences || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      data: {
        convergences: filtered,
        total: filtered.length,
        total_all: (data.data.convergences || []).length,
        stats: data._meta.stats || null,
        generated_at: data.data.generated_at,
      },
    });
  }

  if (pathname === route + '/stats') {
    return sendJson(res, { _meta: data._meta, stats: data._meta.stats });
  }

  if (pathname === route + '/convergences') {
    const enriched = (data.data.convergences || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, { _meta: data._meta, total: filtered.length, convergences: filtered });
  }

  if (pathname === route + '/top') {
    const n = filters.n || 10;
    const enriched = (data.data.convergences || []).map(enrich);
    return sendJson(res, { _meta: data._meta, total: Math.min(n, enriched.length), convergences: enriched.slice(0, n) });
  }

  if (pathname === route + '/modules') {
    return sendJson(res, { _meta: data._meta, modules: data.data.modules_summary || [] });
  }

  if (pathname === route + '/featurecollection') {
    // Регионы без координат — используем центроиды из справочника (если будет).
    // Сейчас — пустой FeatureCollection с готовой структурой.
    const enriched = (data.data.convergences || []).map(enrich);
    const filtered = applyFilters(enriched, filters);
    return sendJson(res, {
      _meta: data._meta,
      type: 'FeatureCollection',
      features: [],
      total: filtered.length,
      note: 'Regions have no coordinates in current data; use /top for values',
    });
  }

  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [
      route,
      route + '/stats',
      route + '/convergences',
      route + '/top',
      route + '/by-region/:region',
      route + '/by-category/:cat',
      route + '/modules',
      route + '/featurecollection',
    ],
  }, 404);
}
