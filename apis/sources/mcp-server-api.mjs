/**
 * apis/sources/mcp-server-api.mjs — API-МОДУЛЬ: MCP СЕРВЕР
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/mcp-server.json — { _meta: { stats:{tools,resources,sessions} }, data: { tools:[], resources:[], sessions:[] } }.
 * Анализатор: scripts/analyzers/mcp-server.mjs.
 *
 * MCP сервер: реестр инструментов, ресурсов, сессий.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'mcp-server.json');

export const route  = '/api/layers/mcp-server';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🔌',
  color: '#14b8a6',
  vizType: 'marker',
  source: 'analytics/specialist/mcp-server.json',
  collector: 'scripts/analyzers/mcp-server.mjs',
  cache: 60,
  description: 'MCP сервер: инструменты, ресурсы, сессии',
  unit: 'tools',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/mcp-server.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function normalizeTools(doc) {
  const arr = doc.data?.tools || [];
  return arr.map((t, i) => ({
    id: t.id || t.name || `tool-${i}`,
    name: t.name || t.id || `Tool ${i}`,
    description: t.description || null,
    category: t.category || t.group || 'other',
    inputSchema: t.inputSchema || t.schema || null,
    annotations: t.annotations || null,
  }));
}

function normalizeResources(doc) {
  const arr = doc.data?.resources || [];
  return arr.map((r, i) => ({
    id: r.id || r.uri || `res-${i}`,
    uri: r.uri || null,
    name: r.name || null,
    mimeType: r.mimeType || null,
    description: r.description || null,
  }));
}

function normalizeSessions(doc) {
  const arr = doc.data?.sessions || [];
  return arr.map((s, i) => ({
    id: s.id || `session-${i}`,
    client: s.client || s.clientId || null,
    startedAt: s.startedAt || null,
    lastSeenAt: s.lastSeenAt || null,
    calls: Number(s.calls ?? 0),
    status: s.status || 'unknown',
  }));
}

function applyFilters(items, query) {
  let r = items.slice();
  if (query.q)     r = r.filter(x => JSON.stringify(x).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.type)  r = r.filter(x => (x.category || x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(tools, resources, sessions, doc) {
  const byCategory = {};
  for (const t of tools) byCategory[t.category] = (byCategory[t.category] || 0) + 1;
  return {
    tools: tools.length,
    resources: resources.length,
    sessions: sessions.length,
    by_tool_category: byCategory,
    meta_tools: doc._meta?.stats?.tools ?? null,
    meta_resources: doc._meta?.stats?.resources ?? null,
    meta_sessions: doc._meta?.stats?.sessions ?? null,
    generated_at: doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms ?? null,
  };
}

function toCSV(rows) {
  if (rows.length === 0) return '';
  const keys = new Set();
  for (const r of rows) Object.keys(r).forEach(k => keys.add(k));
  const cols = [...keys];
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return cols.join(',') + '\n' + rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n') + '\n';
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/mcp-server/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const tools = normalizeTools(doc);
    const resources = normalizeResources(doc);
    const sessions = normalizeSessions(doc);
    const extra = {
      'X-Module': 'mcp-server-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(tools, resources, sessions, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/tools')     return sendJSON(res, 200, { tools: applyFilters(tools, query), total: tools.length }, extra);
    if (sub === '/resources') return sendJSON(res, 200, { resources: applyFilters(resources, query), total: resources.length }, extra);
    if (sub === '/sessions')  return sendJSON(res, 200, { sessions: applyFilters(sessions, query), total: sessions.length }, extra);

    if (format === 'csv')    return sendText(res, 200, toCSV(tools), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: tools.map(t => ({ name: t.name, category: t.category })), meta: { count: tools.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_tools: tools.length,
        total_resources: resources.length,
        total_sessions: sessions.length,
        generated_at: new Date().toISOString(),
        source_updated_at: doc._meta?.updated_at || null,
      },
      tools,
      resources,
      sessions,
      stats: computeStats(tools, resources, sessions, doc),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
