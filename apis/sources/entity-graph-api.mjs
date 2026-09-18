/**
 * apis/sources/entity-graph-api.mjs — API-МОДУЛЬ: ГРАФ СУЩНОСТЕЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/persist/entity-graph.json — { nodes:[{id,label,aliases[],country,lat,lng,type}], edges:[{source,target,weight,type}], savedAt }. Файла пока нет — модуль отдаёт пустой граф.
 * Строится: scripts/analyzers/entity-extraction.mjs.
 *
 * Граф связей между сущностями (люди, организации, страны, события).
 * Отдаёт узлы и рёбра, статистику, поиск по узлам.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?country=, ?limit=, ?min_weight=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const PERSIST_FILE = join(PROJECT_ROOT, 'data', 'persist', 'entity-graph.json');

export const route  = '/api/layers/entity-graph';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '🕸️',
  color: '#a855f7',
  vizType: 'graph',
  source: 'persist/entity-graph.json',
  collector: 'scripts/analyzers/entity-extraction.mjs',
  cache: 120,
  description: 'Граф связей сущностей: узлы, рёбра, кластеры',
  unit: 'graph',
};

async function loadGraph() {
  let raw;
  try { raw = await fs.readFile(PERSIST_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') return { nodes: [], edges: [], savedAt: null, _missing: true };
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    savedAt: parsed.savedAt || null,
    _missing: false,
  };
}

function nodeMatches(node, q) {
  if (!q) return true;
  const s = String(q).toLowerCase();
  if (node.label && String(node.label).toLowerCase().includes(s)) return true;
  if (node.id && String(node.id).toLowerCase().includes(s)) return true;
  if (node.country && String(node.country).toLowerCase().includes(s)) return true;
  if (Array.isArray(node.aliases) && node.aliases.some(a => String(a).toLowerCase().includes(s))) return true;
  return false;
}

function applyNodeFilters(nodes, query) {
  let r = nodes.slice();
  if (query.q)       r = r.filter(n => nodeMatches(n, query.q));
  if (query.type)    r = r.filter(n => (n.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.country) r = r.filter(n => (n.country || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.limit)   { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function applyEdgeFilters(edges, query) {
  let r = edges.slice();
  if (query.min_weight != null) {
    const w = Number(query.min_weight);
    if (Number.isFinite(w)) r = r.filter(e => Number(e.weight ?? 0) >= w);
  }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(nodes, edges, doc) {
  const byType = {};
  const byCountry = {};
  for (const n of nodes) {
    const t = n.type || 'unknown';
    byType[t] = (byType[t] || 0) + 1;
    if (n.country) byCountry[n.country] = (byCountry[n.country] || 0) + 1;
  }
  const byEdgeType = {};
  for (const e of edges) {
    const t = e.type || 'unknown';
    byEdgeType[t] = (byEdgeType[t] || 0) + 1;
  }
  return {
    nodes: nodes.length,
    edges: edges.length,
    density: nodes.length > 1 ? Number((edges.length / (nodes.length * (nodes.length - 1))).toFixed(6)) : 0,
    by_node_type: byType,
    by_edge_type: byEdgeType,
    by_country: byCountry,
    saved_at: doc.savedAt || null,
    source_missing: !!doc._missing,
  };
}

function toFeatureCollection(nodes) {
  const features = nodes
    .filter(n => Number.isFinite(Number(n.lat)) && Number.isFinite(Number(n.lng)))
    .map(n => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(n.lng), Number(n.lat)] },
      properties: {
        id: n.id, label: n.label, type: n.type, country: n.country,
        aliases: n.aliases || [], degree: n.degree || 0,
        category: meta.category, icon: meta.icon, color: meta.color,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    meta: { total: nodes.length, mapped: features.length },
  };
}

function toSeries(nodes, edges) {
  return { nodes: nodes.map(n => ({ id: n.id, label: n.label, type: n.type, country: n.country })), edges };
}

function toCSVNodes(nodes) {
  const lines = ['id,label,type,country,lat,lng,aliases'];
  const esc = (v) => {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join('|') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const n of nodes) lines.push([n.id, n.label, n.type, n.country, n.lat, n.lng, n.aliases].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/entity-graph/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const graph = await loadGraph();
    const allNodes = graph.nodes;
    const allEdges = graph.edges;
    const extra = {
      'X-Module': 'entity-graph-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/nodes') {
      const nodes = applyNodeFilters(allNodes, query);
      return sendJSON(res, 200, { nodes, total: nodes.length }, extra);
    }
    if (sub === '/edges') {
      const edges = applyEdgeFilters(allEdges, query);
      return sendJSON(res, 200, { edges, total: edges.length }, extra);
    }
    if (sub === '/graph') {
      const nodes = applyNodeFilters(allNodes, query);
      const ids = new Set(nodes.map(n => n.id));
      const edges = allEdges.filter(e => ids.has(e.source) || ids.has(e.target));
      return sendJSON(res, 200, { nodes, edges, total_nodes: nodes.length, total_edges: edges.length }, extra);
    }
    if (sub === '/featurecollection') {
      const nodes = applyNodeFilters(allNodes, query);
      return sendJSON(res, 200, toFeatureCollection(nodes), extra);
    }
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(allNodes, allEdges, graph) }, extra);
    }

    const nodes = applyNodeFilters(allNodes, query);
    const edges = applyEdgeFilters(allEdges, query);

    if (format === 'csv')    return sendText(res, 200, toCSVNodes(nodes), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(nodes, edges) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: { nodes, edges, savedAt: graph.savedAt } }, extra);

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
        source_saved_at: graph.savedAt || null,
        source_missing: !!graph._missing,
      },
      features: fc.features,
      nodes,
      edges,
      stats: computeStats(nodes, edges, graph),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
