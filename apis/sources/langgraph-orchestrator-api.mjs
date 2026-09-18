/**
 * apis/sources/langgraph-orchestrator-api.mjs — API-МОДУЛЬ: LANGGRAPH ОРКЕСТРАТОР
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/langgraph-orchestrator.json — { _meta: { stats:{nodes,edges} }, data: { nodes:[{id,label,status,lat?,lng?}], edges:[{source,target,type?}], executionResult } }.
 * Анализатор: scripts/analyzers/langgraph-orchestrator.mjs.
 *
 * Оркестратор графа выполнения LangGraph: узлы, рёбра, статусы шагов.
 *
 * ФОРМАТЫ: json (FeatureCollection + graph + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?status=, ?type=, ?q=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'langgraph-orchestrator.json');

export const route  = '/api/layers/langgraph-orchestrator';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🔀',
  color: '#6366f1',
  vizType: 'marker',
  source: 'analytics/specialist/langgraph-orchestrator.json',
  collector: 'scripts/analyzers/langgraph-orchestrator.mjs',
  cache: 60,
  description: 'Оркестратор LangGraph: узлы, рёбра, статусы шагов',
  unit: 'graph',
};

const STATUS_COLORS = {
  success:   '#22c55e',
  completed: '#22c55e',
  running:   '#3b82f6',
  pending:   '#eab308',
  failed:    '#dc2626',
  error:     '#dc2626',
  skipped:   '#64748b',
  unknown:   '#6b7280',
};

function statusColor(s) {
  return STATUS_COLORS[String(s || '').toLowerCase()] || STATUS_COLORS.unknown;
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/langgraph-orchestrator.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

function normalizeNodes(doc) {
  const arr = doc.data?.nodes || [];
  return arr.map((n, i) => ({
    id: n.id || `node-${i}`,
    label: n.label || n.name || n.id || `Node ${i}`,
    status: n.status || n.state || 'unknown',
    color: statusColor(n.status || n.state),
    type: n.type || null,
    lat: Number.isFinite(Number(n.lat)) ? Number(n.lat) : null,
    lng: Number.isFinite(Number(n.lng)) ? Number(n.lng) : null,
    duration_ms: n.duration_ms ?? n.durationMs ?? null,
  }));
}

function normalizeEdges(doc) {
  const arr = doc.data?.edges || [];
  return arr.map((e, i) => ({
    id: e.id || `edge-${i}`,
    source: e.source || e.from,
    target: e.target || e.to,
    type: e.type || 'default',
    weight: Number(e.weight ?? 1),
  }));
}

// ============================================================
//  ФИЛЬТРЫ И СТАТИСТИКА
// ============================================================

function applyFilters(nodes, edges, query) {
  let n = nodes.slice();
  if (query.status) n = n.filter(x => String(x.status).toLowerCase() === String(query.status).toLowerCase());
  if (query.type)   n = n.filter(x => (x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.q)      n = n.filter(x => (x.label || '').toLowerCase().includes(String(query.q).toLowerCase()) || (x.id || '').toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.limit)  { const k = parseInt(query.limit, 10); if (k > 0) n = n.slice(0, k); }
  const ids = new Set(n.map(x => x.id));
  const e = edges.filter(x => ids.has(x.source) || ids.has(x.target));
  return { nodes: n, edges: e };
}

function computeStats(nodes, edges, doc) {
  const byStatus = {};
  for (const n of nodes) byStatus[n.status] = (byStatus[n.status] || 0) + 1;
  const byEdgeType = {};
  for (const e of edges) byEdgeType[e.type] = (byEdgeType[e.type] || 0) + 1;
  return {
    nodes: nodes.length,
    edges: edges.length,
    by_status: byStatus,
    by_edge_type: byEdgeType,
    meta_nodes: doc._meta?.stats?.nodes ?? null,
    meta_edges: doc._meta?.stats?.edges ?? null,
    generated_at: doc._meta?.updated_at || null,
    duration_ms: doc._meta?.duration_ms ?? null,
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(nodes) {
  const features = nodes
    .filter(n => Number.isFinite(n.lat) && Number.isFinite(n.lng))
    .map(n => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.lng, n.lat] },
      properties: {
        id: n.id, label: n.label, status: n.status, type: n.type,
        color: n.color, duration_ms: n.duration_ms,
        category: meta.category, icon: meta.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    meta: { total: nodes.length, mapped: features.length, unmapped: nodes.length - features.length },
  };
}

function toSeries(nodes) {
  return nodes.map(n => ({ id: n.id, label: n.label, status: n.status, duration_ms: n.duration_ms }));
}

function toCSV(nodes) {
  const lines = ['id,label,status,type,lat,lng,duration_ms'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const n of nodes) lines.push([n.id, n.label, n.status, n.type, n.lat, n.lng, n.duration_ms].map(esc).join(','));
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

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/langgraph-orchestrator/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const allNodes = normalizeNodes(doc);
    const allEdges = normalizeEdges(doc);
    const extra = {
      'X-Module': 'langgraph-orchestrator-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(allNodes, allEdges, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/execution') return sendJSON(res, 200, { executionResult: doc.data?.executionResult || null }, extra);
    if (sub === '/nodes')     return sendJSON(res, 200, { nodes: allNodes, total: allNodes.length }, extra);
    if (sub === '/edges')     return sendJSON(res, 200, { edges: allEdges, total: allEdges.length }, extra);
    if (sub === '/graph') {
      const { nodes, edges } = applyFilters(allNodes, allEdges, query);
      return sendJSON(res, 200, { nodes, edges, total_nodes: nodes.length, total_edges: edges.length }, extra);
    }
    if (sub === '/featurecollection') {
      return sendJSON(res, 200, toFeatureCollection(allNodes), extra);
    }

    const { nodes, edges } = applyFilters(allNodes, allEdges, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(nodes), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(nodes), meta: { count: nodes.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc, meta: { nodes_returned: nodes.length } }, extra);

    const fc = toFeatureCollection(nodes);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_nodes: allNodes.length,
        total_edges: allEdges.length,
        returned_nodes: nodes.length,
        returned_edges: edges.length,
        generated_at: new Date().toISOString(),
        source_updated_at: doc._meta?.updated_at || null,
      },
      features: fc.features,
      nodes,
      edges,
      series: toSeries(nodes),
      stats: computeStats(nodes, edges, doc),
      executionResult: doc.data?.executionResult || null,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
