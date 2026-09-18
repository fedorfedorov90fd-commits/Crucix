/**
 * apis/sources/watchdog-api.mjs — API-МОДУЛЬ: WATCHDOG
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/watchdog.json — { _meta:{stats:{total}}, data:{items:[], extra:{}, generated_at} }.
 * Анализатор: scripts/analyzers/watchdog.mjs.
 *
 * Watchdog: мониторинг здоровья подсистем Crucix, алерты, отчёт.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?status=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'watchdog.json');

export const route  = '/api/layers/watchdog';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🐕',
  color: '#0ea5e9',
  vizType: 'marker',
  source: 'analytics/specialist/watchdog.json',
  collector: 'scripts/analyzers/watchdog.mjs',
  cache: 60,
  description: 'Watchdog: мониторинг здоровья подсистем, алерты, отчёт',
  unit: 'checks',
};

const STATUS_COLORS = {
  ok:       '#22c55e',
  healthy:  '#22c55e',
  warn:     '#eab308',
  warning:  '#eab308',
  fail:     '#dc2626',
  error:    '#dc2626',
  unknown:  '#64748b',
};

function statusColor(s) {
  const k = String(s || '').toLowerCase();
  return STATUS_COLORS[k] || STATUS_COLORS.unknown;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/watchdog.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function normalizeItems(doc) {
  const arr = Array.isArray(doc.data?.items) ? doc.data.items
    : Array.isArray(doc.data?.checks) ? doc.data.checks
    : Array.isArray(doc.data?.alerts) ? doc.data.alerts : [];
  return arr.map((it, i) => ({
    id: it.id || it.key || `check-${i}`,
    name: it.name || it.label || it.id || `Check ${i}`,
    type: it.type || it.kind || null,
    status: it.status || it.state || 'unknown',
    color: statusColor(it.status || it.state),
    message: it.message || null,
    value: it.value != null ? Number(it.value) : null,
  }));
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.q)      r = r.filter(x => (x.name + ' ' + (x.message || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.type)   r = r.filter(x => String(x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.status) r = r.filter(x => String(x.status || '').toLowerCase() === String(query.status).toLowerCase());
  if (query.limit)  { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const byStatus = {};
  const byType = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.type) byType[r.type] = (byType[r.type] || 0) + 1;
  }
  return {
    count: rows.length,
    by_status: byStatus,
    by_type: byType,
    meta_total: doc._meta?.stats?.total ?? null,
    extra_keys: doc.data?.extra ? Object.keys(doc.data.extra) : [],
    generated_at: doc.data?.generated_at || doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms ?? null,
  };
}

function toCSV(rows) {
  const lines = ['id,name,type,status,value,message'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.type, r.status, r.value, r.message].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}
function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/watchdog/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = normalizeItems(doc);
    const extra = {
      'X-Module': 'watchdog-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all, doc), meta: doc._meta || null, extra: doc.data?.extra || {} }, extra);
    }
    if (sub === '/items')  return sendJSON(res, 200, { items: applyFilters(all, query), total: all.length }, extra);
    if (sub === '/extra')  return sendJSON(res, 200, { extra: doc.data?.extra || {} }, extra);

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: rows.map(r => ({ id: r.id, status: r.status, value: r.value })) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_items: all.length, returned_items: rows.length,
        generated_at: new Date().toISOString(), source_updated_at: doc._meta?.updated_at || null,
      },
      items: rows,
      extra: doc.data?.extra || {},
      stats: computeStats(rows, doc),
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}

