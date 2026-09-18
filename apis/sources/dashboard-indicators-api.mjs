/**
 * apis/sources/dashboard-indicators-api.mjs — API-МОДУЛЬ: ИНДИКАТОРЫ ДАШБОРДА
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/dashboard-indicators.json — { _meta, data: { indicators:[{ key, value, metadata:{category,unit}, added }] } }.
 * Анализатор: scripts/analyzers/dashboard-indicators.mjs.
 *
 * Сводные индикаторы дашборда: композитные метрики рынка, стратегический риск, классификация угроз.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?key=, ?category=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'dashboard-indicators.json');

export const route  = '/api/layers/dashboard-indicators';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '📊',
  color: '#3b82f6',
  vizType: 'marker',
  source: 'analytics/specialist/dashboard-indicators.json',
  collector: 'scripts/analyzers/dashboard-indicators.mjs',
  cache: 60,
  description: 'Сводные индикаторы дашборда: рынок, риск, угрозы',
  unit: 'index',
};

const CATEGORY_COLORS = {
  market:   '#22c55e',
  risk:     '#dc2626',
  threats:  '#f97316',
  ecology:  '#16a34a',
  military: '#64748b',
  finance:  '#0ea5e9',
  social:   '#a855f7',
  other:    '#6b7280',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/dashboard-indicators.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function normalizeIndicators(doc) {
  const arr = doc.data?.indicators || [];
  return arr.map((it, i) => {
    const cat = it.metadata?.category || 'other';
    return {
      id: it.id || it.key || `indicator-${i}`,
      key: it.key || null,
      value: it.value,
      isArray: Array.isArray(it.value),
      arrayLength: Array.isArray(it.value) ? it.value.length : null,
      category: cat,
      color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.other,
      unit: it.metadata?.unit || null,
      added: it.added || null,
    };
  });
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.key)      r = r.filter(x => (x.key || '').toLowerCase().includes(String(query.key).toLowerCase()));
  if (query.category) r = r.filter(x => x.category === String(query.category).toLowerCase());
  if (query.search)   r = r.filter(x => JSON.stringify(x).toLowerCase().includes(String(query.search).toLowerCase()));
  if (query.limit)    { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const byCategory = {};
  for (const r of rows) byCategory[r.category] = (byCategory[r.category] || 0) + 1;
  const numeric = rows.filter(r => typeof r.value === 'number' && Number.isFinite(r.value));
  const values = numeric.map(r => r.value);
  return {
    count: rows.length,
    numeric_count: numeric.length,
    by_category: byCategory,
    sum: values.length ? Number(values.reduce((a, b) => a + b, 0).toFixed(2)) : null,
    mean: values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : null,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    generated_at: doc.data?.generated_at || doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms || null,
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    key: r.key,
    value: r.isArray ? r.arrayLength : r.value,
    category: r.category,
    unit: r.unit,
    isArray: r.isArray,
  }));
}

function toCSV(rows) {
  const lines = ['key,category,unit,isArray,arrayLength,value'];
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.key, r.category, r.unit, r.isArray, r.arrayLength, r.isArray ? null : r.value].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/dashboard-indicators/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = normalizeIndicators(doc);
    const extra = {
      'X-Module': 'dashboard-indicators-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/indicators') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { indicators: rows, total: rows.length }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc, meta: { indicators_returned: rows.length } }, extra);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_indicators: all.length,
        returned_indicators: rows.length,
        generated_at: new Date().toISOString(),
        source_updated_at: doc._meta?.updated_at || null,
      },
      legend: Object.entries(CATEGORY_COLORS).map(([key, color]) => ({ key, color })),
      series: toSeries(rows),
      stats: computeStats(rows, doc),
      indicators: rows,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
