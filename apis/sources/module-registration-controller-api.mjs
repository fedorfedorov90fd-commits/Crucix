/**
 * apis/sources/module-registration-controller-api.mjs — API-МОДУЛЬ: КОНТРОЛЛЕР РЕГИСТРАЦИИ МОДУЛЕЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/module-registration-controller.json — { _meta: { stats:{total,active,...} }, data: { modules:[{id,name,version,dependencies[],status,...}] } }.
 * Анализатор: scripts/analyzers/module-registration-controller.mjs.
 *
 * Контроллер регистрации модулей: список, версии, зависимости. По умолчанию
 * отдаётся сжатая сводка; полный список — через ?limit= или ?format=raw.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?status=, ?q=, ?has_deps=, ?limit=, ?offset=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'module-registration-controller.json');

export const route  = '/api/layers/module-registration-controller';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🗂️',
  color: '#f59e0b',
  vizType: 'marker',
  source: 'analytics/specialist/module-registration-controller.json',
  collector: 'scripts/analyzers/module-registration-controller.mjs',
  cache: 60,
  description: 'Контроллер регистрации модулей: список, версии, зависимости',
  unit: 'modules',
};

const DEFAULT_LIMIT = 50;

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/module-registration-controller.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function normalizeModules(doc) {
  const arr = doc.data?.modules || [];
  return arr.map((m, i) => ({
    id: m.id || m.moduleId || m.name || `mod-${i}`,
    name: m.name || m.id || null,
    version: m.version || null,
    status: m.status || 'unknown',
    dependencies: Array.isArray(m.dependencies) ? m.dependencies : (Array.isArray(m.deps) ? m.deps : []),
    dependents: Array.isArray(m.dependents) ? m.dependents : [],
    hasDeps: Array.isArray(m.dependencies) ? m.dependencies.length > 0 : false,
    category: m.category || null,
  }));
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.status)   r = r.filter(x => String(x.status).toLowerCase() === String(query.status).toLowerCase());
  if (query.q)        r = r.filter(x => (x.id + ' ' + (x.name || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.has_deps === '1' || query.has_deps === 'true') r = r.filter(x => x.hasDeps);
  if (query.has_deps === '0' || query.has_deps === 'false') r = r.filter(x => !x.hasDeps);
  if (query.category) r = r.filter(x => String(x.category || '').toLowerCase() === String(query.category).toLowerCase());
  return r;
}

function paginate(rows, query) {
  const limit = parseInt(query.limit, 10);
  const offset = parseInt(query.offset, 10);
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  if (Number.isFinite(limit) && limit > 0) return { rows: rows.slice(start, start + limit), start, limit };
  return { rows: rows.slice(start, start + DEFAULT_LIMIT), start, limit: DEFAULT_LIMIT };
}

function computeStats(rows, doc) {
  const byStatus = {};
  const byCategory = {};
  let totalDeps = 0;
  for (const m of rows) {
    byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    if (m.category) byCategory[m.category] = (byCategory[m.category] || 0) + 1;
    totalDeps += m.dependencies.length;
  }
  return {
    total: rows.length,
    with_dependencies: rows.filter(r => r.hasDeps).length,
    total_dependencies: totalDeps,
    by_status: byStatus,
    by_category: byCategory,
    meta_total: doc._meta?.stats?.total ?? null,
    meta_active: doc._meta?.stats?.active ?? null,
    generated_at: doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms ?? null,
  };
}

function toSeries(rows) {
  return rows.map(r => ({ id: r.id, version: r.version, status: r.status, deps: r.dependencies.length }));
}

function toCSV(rows) {
  const lines = ['id,name,version,status,category,deps_count'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.id, r.name, r.version, r.status, r.category, r.dependencies.length].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/module-registration-controller/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = normalizeModules(doc);
    const extra = {
      'X-Module': 'module-registration-controller-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all, doc), meta: doc._meta || null }, extra);
    }

    const filtered = applyFilters(all, query);

    if (sub === '/dependencies') {
      const withDeps = filtered.filter(m => m.hasDeps);
      const paginated = paginate(withDeps, query);
      return sendJSON(res, 200, {
        modules: paginated.rows,
        total: withDeps.length,
        returned: paginated.rows.length,
        start: paginated.start,
        limit: paginated.limit,
      }, extra);
    }

    if (format === 'csv') {
      const paginated = paginate(filtered, query);
      return sendText(res, 200, toCSV(paginated.rows), 'text/csv; charset=utf-8');
    }
    if (format === 'series') {
      const paginated = paginate(filtered, query);
      return sendJSON(res, 200, { series: toSeries(paginated.rows), meta: { total: filtered.length, returned: paginated.rows.length } }, extra);
    }
    if (format === 'raw' || query.full === '1') {
      return sendJSON(res, 200, { data: doc, meta: { modules_returned: all.length } }, extra);
    }

    // JSON по умолчанию — пагинированный список
    const paginated = paginate(filtered, query);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_modules: all.length,
        filtered_modules: filtered.length,
        returned_modules: paginated.rows.length,
        start: paginated.start,
        limit: paginated.limit,
        generated_at: new Date().toISOString(),
        source_updated_at: doc._meta?.updated_at || null,
      },
      modules: paginated.rows,
      series: toSeries(paginated.rows),
      stats: computeStats(all, doc),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
