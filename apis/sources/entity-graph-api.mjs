/**
 * apis/sources/entity-graph-api.mjs — API-МОДУЛЬ: ГРАФ СУЩНОСТЕЙ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/graph/entity-graph.json
 * Строится: data/graph/build-graph.mjs (v4.1, с temporal-enricher.mjs).
 *
 * Граф связей между сущностями (люди, организации, страны, события).
 * Отдаёт узлы и рёбра, статистику, поиск, досье узла, соседей, timeline.
 *
 * НОРМАЛИЗАЦИЯ: свойства узлов из properties.* выносятся в плоский вид
 * (country, lat, lon), рёбра source/target → from/to — под UI graph-panel.js
 * и graph-view.js.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?country=, ?limit=, ?min_weight=, ?from=, ?to=
 * ПОДПУТИ: /, /nodes, /edges, /graph, /featurecollection, /stats,
 *          /node/{id}, /neighbors/{id}, /timeline/{id}
 *
 * @module entity-graph-api
 * @version 2.1.0
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const GRAPH_FILE = join(PROJECT_ROOT, 'data', 'graph', 'entity-graph.json');

export const route  = '/api/layers/entity-graph';
export const method = 'GET';

export const meta = {
  category: 'semantic',
  icon: '🕸️',
  color: '#a855f7',
  vizType: 'graph',
  source: 'data/graph/entity-graph.json',
  collector: 'data/graph/build-graph.mjs',
  cache: 60,
  description: 'Граф связей сущностей: узлы, рёбра, temporal, досье, соседи',
  unit: 'graph',
};

// ─────────────────────────────────────────────────────────────────────
//  ЗАГРУЗКА
// ─────────────────────────────────────────────────────────────────────

async function loadGraph() {
  let raw;
  try { raw = await fs.readFile(GRAPH_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') return { nodes: [], edges: [], meta: {}, _missing: true };
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return {
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
    edges: Array.isArray(parsed.edges) ? parsed.edges : [],
    meta: parsed.meta || {},
    _missing: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
//  НОРМАЛИЗАЦИЯ ПОД UI
// ─────────────────────────────────────────────────────────────────────

function normalizeNode(node, edgesRaw) {
  const props = node.properties || {};
  let degree = 0;
  for (const e of edgesRaw) {
    if (e.source === node.id) degree++;
    else if (e.target === node.id) degree++;
  }

  const lat = props.lat != null ? Number(props.lat) : null;
  const lon = props.lon != null ? Number(props.lon)
            : props.lng != null ? Number(props.lng)
            : null;

  return {
    id: node.id,
    type: node.type,
    label: node.label,
    aliases: node.aliases || [],
    country: props.country || null,
    region: props.region || null,
    lat,
    lon,
    properties: props,
    sources: node.sources || [],
    first_seen: node.first_seen || null,
    last_seen: node.last_seen || null,
    mention_count: node.mention_count || 1,
    active_from: node.active_from || node.first_seen || null,
    active_to: node.active_to || null,
    observed_at: node.observed_at || node.first_seen || null,
    degree,
  };
}

function normalizeEdge(edge) {
  return {
    id: edge.id || null,
    from: edge.source,
    to: edge.target,
    type: edge.type,
    weight: edge.weight || 1,
    valid_from: edge.valid_from || null,
    valid_to: edge.valid_to || null,
    observed_at: edge.observed_at || null,
    provenance_count: (edge.provenance || []).length,
    provenance: edge.provenance || [],
  };
}

// ─────────────────────────────────────────────────────────────────────
//  ФИЛЬТРЫ
// ─────────────────────────────────────────────────────────────────────

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
  if (query.from)    r = r.filter(n => !n.active_to || n.active_to >= query.from);
  if (query.to)      r = r.filter(n => !n.active_from || n.active_from <= query.to);
  return r;
}

function edgeOverlapsWindow(edge, from, to) {
  const ef = edge.valid_from;
  const et = edge.valid_to;
  if (ef && to && ef > to) return false;
  if (et && from && et < from) return false;
  return true;
}

function applyEdgeFilters(edges, query) {
  let r = edges.slice();
  if (query.min_weight != null) {
    const w = Number(query.min_weight);
    if (Number.isFinite(w)) r = r.filter(e => Number(e.weight || 0) >= w);
  }
  if (query.from || query.to) {
    r = r.filter(e => edgeOverlapsWindow(e, query.from, query.to));
  }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ─────────────────────────────────────────────────────────────────────
//  СТАТИСТИКА
// ─────────────────────────────────────────────────────────────────────

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
    saved_at: (doc.meta && doc.meta.generated_at) || null,
    temporal_enriched_at: (doc.meta && doc.meta.temporal_enriched_at) || null,
    source_missing: !!doc._missing,
  };
}

// ─────────────────────────────────────────────────────────────────────
//  ФОРМАТЫ
// ─────────────────────────────────────────────────────────────────────

function toFeatureCollection(nodes) {
  const features = [];
  for (const n of nodes) {
    if (!Number.isFinite(n.lat) || !Number.isFinite(n.lon)) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.lon, n.lat] },
      properties: {
        id: n.id, label: n.label, type: n.type, country: n.country,
        aliases: n.aliases || [], degree: n.degree || 0,
        active_from: n.active_from, active_to: n.active_to,
        category: meta.category, icon: meta.icon, color: meta.color,
      },
    });
  }
  return {
    type: 'FeatureCollection',
    features,
    meta: { total: nodes.length, mapped: features.length },
  };
}

function toSeries(nodes, edges) {
  const sn = [];
  for (const n of nodes) sn.push({ id: n.id, label: n.label, type: n.type, country: n.country });
  return { nodes: sn, edges };
}

function toCSVNodes(nodes) {
  const lines = ['id,label,type,country,lat,lon,aliases,degree'];
  const esc = function (v) {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join('|') : String(v);
    if (s.indexOf('"') >= 0 || s.indexOf(',') >= 0 || s.indexOf('\n') >= 0) {
      return '"' + s.split('"').join('""') + '"';
    }
    return s;
  };
  for (const n of nodes) {
    lines.push([n.id, n.label, n.type, n.country, n.lat, n.lon, n.aliases, n.degree].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function sendJSON(res, status, payload, extra) {
  const body = JSON.stringify(payload);
  const headers = Object.assign({
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
  }, extra || {});
  res.writeHead(status, headers);
  res.end(body);
}

function sendText(res, status, text, ct) {
  res.writeHead(status, {
    'Content-Type': ct || 'text/plain; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(text)),
  });
  res.end(text);
}

// ─────────────────────────────────────────────────────────────────────
//  HANDLER
// ─────────────────────────────────────────────────────────────────────

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/entity-graph/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const graph = await loadGraph();
    const allEdgesRaw = graph.edges;
    const allNodesRaw = graph.nodes;

    const allEdges = allEdgesRaw.map(normalizeEdge);
    const allNodes = allNodesRaw.map(function (n) { return normalizeNode(n, allEdgesRaw); });

    const extra = {
      'X-Module': 'entity-graph-api',
      'X-Module-Version': '2.1.0',
      'Cache-Control': 'public, max-age=' + meta.cache,
    };

    // /node/{id}
    const nodeMatch = sub.match(/^\/node\/(.+)$/);
    if (nodeMatch) {
      const id = decodeURIComponent(nodeMatch[1]);
      let node = null;
      for (const n of allNodes) { if (n.id === id) { node = n; break; } }
      if (!node) return sendJSON(res, 404, { error: 'node_not_found', id: id }, extra);
      const edges = [];
      for (const e of allEdges) { if (e.from === id || e.to === id) edges.push(e); }
      return sendJSON(res, 200, { node: node, edges: edges, total_edges: edges.length }, extra);
    }

    // /neighbors/{id}
    const nbMatch = sub.match(/^\/neighbors\/(.+)$/);
    if (nbMatch) {
      const id = decodeURIComponent(nbMatch[1]);
      const depth = parseInt(query.depth, 10) || 1;
      let node = null;
      for (const n of allNodes) { if (n.id === id) { node = n; break; } }
      if (!node) return sendJSON(res, 404, { error: 'node_not_found', id: id }, extra);

      const visited = new Set([id]);
      let frontier = [id];
      const collectedEdges = [];
      for (let d = 0; d < depth; d++) {
        const nextFrontier = [];
        for (const nodeId of frontier) {
          for (const e of allEdges) {
            if (e.from !== nodeId && e.to !== nodeId) continue;
            if ((query.from || query.to) && !edgeOverlapsWindow(e, query.from, query.to)) continue;
            const other = e.from === nodeId ? e.to : e.from;
            if (visited.has(other)) continue;
            visited.add(other);
            nextFrontier.push(other);
            collectedEdges.push(e);
          }
        }
        frontier = nextFrontier;
        if (!frontier.length) break;
      }
      const neighborNodes = [];
      for (const x of visited) {
        if (x === id) continue;
        for (const n of allNodes) { if (n.id === x) { neighborNodes.push(n); break; } }
      }
      return sendJSON(res, 200, {
        center: node,
        neighbors: neighborNodes,
        edges: collectedEdges,
        total_neighbors: neighborNodes.length,
        total_edges: collectedEdges.length,
      }, extra);
    }

    // /timeline/{id}
    const tlMatch = sub.match(/^\/timeline\/(.+)$/);
    if (tlMatch) {
      const id = decodeURIComponent(tlMatch[1]);
      let node = null;
      for (const n of allNodes) { if (n.id === id) { node = n; break; } }
      if (!node) return sendJSON(res, 404, { error: 'node_not_found', id: id }, extra);

      const events = [];
      for (const e of allEdges) {
        if (e.from !== id && e.to !== id) continue;
        if ((query.from || query.to) && !edgeOverlapsWindow(e, query.from, query.to)) continue;
        const direction = e.from === id ? 'out' : 'in';
        const otherId = e.from === id ? e.to : e.from;
        let other = null;
        for (const n of allNodes) { if (n.id === otherId) { other = n; break; } }
        events.push({
          direction: direction,
          relation: e.type,
          other: other ? { id: other.id, label: other.label, type: other.type } : { id: otherId },
          valid_from: e.valid_from,
          valid_to: e.valid_to,
          observed_at: e.observed_at,
          weight: e.weight,
        });
      }
      events.sort(function (a, b) {
        const da = a.valid_from ? new Date(a.valid_from).getTime() : 0;
        const db = b.valid_from ? new Date(b.valid_from).getTime() : 0;
        return da - db;
      });
      return sendJSON(res, 200, { entity: node, events: events, total_events: events.length }, extra);
    }

    // /nodes
    if (sub === '/nodes') {
      const nodes = applyNodeFilters(allNodes, query);
      return sendJSON(res, 200, { nodes: nodes, total: nodes.length }, extra);
    }

    // /edges
    if (sub === '/edges') {
      const edges = applyEdgeFilters(allEdges, query);
      return sendJSON(res, 200, { edges: edges, total: edges.length }, extra);
    }

    // /graph
    if (sub === '/graph') {
      const nodes = applyNodeFilters(allNodes, query);
      const ids = new Set();
      for (const n of nodes) ids.add(n.id);
      const edges = [];
      for (const e of allEdges) { if (ids.has(e.from) || ids.has(e.to)) edges.push(e); }
      return sendJSON(res, 200, { nodes: nodes, edges: edges, total_nodes: nodes.length, total_edges: edges.length }, extra);
    }

    // /featurecollection
    if (sub === '/featurecollection') {
      const nodes = applyNodeFilters(allNodes, query);
      return sendJSON(res, 200, toFeatureCollection(nodes), extra);
    }

    // /stats
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(allNodes, allEdges, graph) }, extra);
    }

    // DEFAULT /
    const nodes = applyNodeFilters(allNodes, query);
    const edges = applyEdgeFilters(allEdges, query);

    if (format === 'csv')    return sendText(res, 200, toCSVNodes(nodes), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(nodes, edges) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: { nodes: nodes, edges: edges, meta: graph.meta } }, extra);

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
        source_generated_at: (graph.meta && graph.meta.generated_at) || null,
        temporal_enriched_at: (graph.meta && graph.meta.temporal_enriched_at) || null,
        source_missing: !!graph._missing,
      },
      features: fc.features,
      nodes: nodes,
      edges: edges,
      stats: computeStats(nodes, edges, graph),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, null); } catch (err) { /* ignore */ }
  }
}
