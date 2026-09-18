/**
 * apis/sources/scenario-simulation-engine-api.mjs — API-МОДУЛЬ: ДВИЖОК СИМУЛЯЦИИ СЦЕНАРИЕВ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/scenario-simulation-engine.json — { _meta:{stats}, data:{ issues?, tools?, commands?, health?, dashboard?, results? } }.
 * Анализатор: scripts/analyzers/scenario-simulation-engine.mjs.
 *
 * Движок симуляции сценариев: запуски, результаты, инструменты, здоровье.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?status=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'scenario-simulation-engine.json');

export const route  = '/api/layers/scenario-simulation-engine';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🎯',
  color: '#8b5cf6',
  vizType: 'marker',
  source: 'analytics/specialist/scenario-simulation-engine.json',
  collector: 'scripts/analyzers/scenario-simulation-engine.mjs',
  cache: 60,
  description: 'Движок симуляции сценариев: запуски, результаты, инструменты',
  unit: 'scenarios',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/scenario-simulation-engine.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function extractItems(doc) {
  const d = doc.data || {};
  const arr = Array.isArray(d.results) ? d.results
    : Array.isArray(d.items) ? d.items
    : Array.isArray(d.scenarios) ? d.scenarios
    : Array.isArray(d.top) ? d.top : [];
  return arr.map((it, i) => ({
    id: it.id || it.key || `scenario-${i}`,
    name: it.name || it.title || it.label || `Scenario ${i}`,
    type: it.type || it.kind || null,
    status: it.status || it.state || null,
    value: it.value != null ? Number(it.value) : (it.score != null ? Number(it.score) : null),
    description: it.description || null,
  }));
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.q)      r = r.filter(x => (x.name + ' ' + (x.description || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.type)   r = r.filter(x => String(x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.status) r = r.filter(x => String(x.status || '').toLowerCase() === String(query.status).toLowerCase());
  if (query.limit)  { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const byStatus = {};
  const byType = {};
  for (const r of rows) {
    if (r.status) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.type)   byType[r.type]     = (byType[r.type] || 0) + 1;
  }
  const issues = Array.isArray(doc.data?.issues) ? doc.data.issues : [];
  return {
    count: rows.length,
    issues: issues.length,
    by_status: byStatus,
    by_type: byType,
    has_health: !!doc.data?.health,
    has_dashboard: !!doc.data?.dashboard,
    tools: Array.isArray(doc.data?.tools) ? doc.data.tools.length : 0,
    commands: Array.isArray(doc.data?.commands) ? doc.data.commands.length : 0,
    meta: doc._meta?.stats || null,
    generated_at: doc._meta?.updated_at || null,
  };
}

function toCSV(rows) {
  const lines = ['id,name,type,status,value'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.type, r.status, r.value].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/scenario-simulation-engine/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractItems(doc);
    const extra = {
      'X-Module': 'scenario-simulation-engine-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/issues')    return sendJSON(res, 200, { issues: doc.data?.issues || [], total: (doc.data?.issues || []).length }, extra);
    if (sub === '/tools')     return sendJSON(res, 200, { tools: doc.data?.tools || [] }, extra);
    if (sub === '/commands')  return sendJSON(res, 200, { commands: doc.data?.commands || [] }, extra);
    if (sub === '/health')    return sendJSON(res, 200, { health: doc.data?.health || null }, extra);
    if (sub === '/dashboard') return sendJSON(res, 200, { dashboard: doc.data?.dashboard || null }, extra);
    if (sub === '/run')       return sendJSON(res, 200, { results: doc.data?.results || [] }, extra);

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: rows }, extra);
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
      stats: computeStats(rows, doc),
      issues: doc.data?.issues || [],
      tools: doc.data?.tools || [],
      health: doc.data?.health || null,
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
