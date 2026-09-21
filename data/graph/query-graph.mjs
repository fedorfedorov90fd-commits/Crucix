#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  query-graph.mjs — Query Layer for Knowledge Graph
//  Crucix / data/graph/  ·  v1.1
//
//  Читает entity-graph.json → строит adjacency → отвечает на запросы.
//  Не трогает entity-resolution.mjs (RULES.txt №19).
//  Поддерживает temporal (active_from/active_to, valid_from/valid_to).
//
//  Методы:
//    getNode(id)                          — узел по ID
//    neighbors(id, {depth, types, ...})   — соседи с фильтром
//    paths(srcId, tgtId, maxDepth)         — все простые пути (DFS)
//    findByLabel(label, type)              — поиск по имени/алиасу
//    timeline(entityId, from, to)          — темпоральный срез
//    subgraph(centerId, depth)             — подграф вокруг узла
//    stats()                                — статистика графа
//    toGeoJSON()                            — узлы с координатами как FeatureCollection
//
//  Исправления относительно черновика v1.0:
//    - FIX 1: fileURLToPath вместо file://${argv[1]} (кириллица в пути)
//    - FIX 2: timeline — правильная проверка пересечения интервалов
//    - FIX 3: neighbors — убрано else if (d === 0)
//    - FIX 4: paths — DFS вместо BFS (все простые пути, не только кратчайшие)
//    - FIX 5: paths — только направленный обход (граф ориентированный)
//
//  CLI:
//    node query-graph.mjs --node <id>
//    node query-graph.mjs --neighbors <id> --depth 2
//    node query-graph.mjs --paths <srcId> <tgtId>
//    node query-graph.mjs --search "Hezbollah"
//    node query-graph.mjs --timeline <id> --from 2024-01-01 --to 2024-12-31
//    node query-graph.mjs --subgraph <id> --depth 2
//    node query-graph.mjs --stats
//    node query-graph.mjs --geojson
// ═══════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPH_FILE = path.join(__dirname, 'entity-graph.json');

// ─────────────────────────────────────────────────────────────────────
//  УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────

function normalizeLabel(s) {
  if (!s || typeof s !== 'string') return '';
  return s.trim().toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDate(d) {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

// FIX 2: правильная проверка пересечения интервалов [edgeFrom, edgeTo] ∩ [from, to]
// Правило: ребро активно в окне [from, to], если edgeFrom <= to И edgeTo >= from.
// null в edgeTo означает "действует до сих пор" (бесконечность вправо).
// null в from/to означает "открытая граница" (без ограничения).
function edgeOverlapsWindow(edgeFrom, edgeTo, from, to) {
  const ef = parseDate(edgeFrom);
  const et = parseDate(edgeTo);
  const f = parseDate(from);
  const t = parseDate(to);

  // Если у ребра нет начала — считаем "неизвестно", пропускаем при фильтре
  if (!ef && (f || t)) return true; // не блокируем, если нет данных

  // ef > t → ребро началось после конца окна
  if (ef && t && ef > t) return false;

  // et < f → ребро кончилось до начала окна (et=null — действует, не блокирует)
  if (et && f && et < f) return false;

  return true;
}

// ─────────────────────────────────────────────────────────────────────
//  GRAPH QUERY
// ─────────────────────────────────────────────────────────────────────

class GraphQuery {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.adjacency = new Map();   // id → Set<edgeIndex> (исходящие)
    this.reverseAdj = new Map();  // id → Set<edgeIndex> (входящие)
    this.labelIndex = new Map();  // normalizedLabel → Set<nodeId>
    this.typeIndex = new Map();   // type → Set<nodeId>
    this.meta = {};
    this.loaded = false;
  }

  async load(filePath = GRAPH_FILE) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Graph file not found: ${filePath}`);
    }
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    this.meta = raw.meta || {};

    // Загрузка узлов
    for (const node of raw.nodes || []) {
      this.nodes.set(node.id, node);

      const norm = normalizeLabel(node.label);
      if (norm) {
        if (!this.labelIndex.has(norm)) this.labelIndex.set(norm, new Set());
        this.labelIndex.get(norm).add(node.id);
      }
      if (node.aliases) {
        for (const alias of node.aliases) {
          const aliasNorm = normalizeLabel(alias);
          if (aliasNorm && aliasNorm !== norm) {
            if (!this.labelIndex.has(aliasNorm)) this.labelIndex.set(aliasNorm, new Set());
            this.labelIndex.get(aliasNorm).add(node.id);
          }
        }
      }
      const type = node.type || 'Unknown';
      if (!this.typeIndex.has(type)) this.typeIndex.set(type, new Set());
      this.typeIndex.get(type).add(node.id);
    }

    // Загрузка рёбер
    this.edges = raw.edges || [];
    for (let i = 0; i < this.edges.length; i++) {
      const edge = this.edges[i];
      if (!this.adjacency.has(edge.source)) this.adjacency.set(edge.source, new Set());
      this.adjacency.get(edge.source).add(i);
      if (!this.reverseAdj.has(edge.target)) this.reverseAdj.set(edge.target, new Set());
      this.reverseAdj.get(edge.target).add(i);
    }

    this.loaded = true;
    return this;
  }

  // ═══ getNode ═══
  getNode(id) {
    return this.nodes.get(id) || null;
  }

  // ═══ neighbors ═══
  // FIX 3: убрано else if (d === 0) — дублировало рёбра без узлов.
  // FIX 2: фильтр temporal через edgeOverlapsWindow.
  neighbors(id, { depth = 1, types = [], direction = 'both', from = null, to = null } = {}) {
    const result = { nodes: [], edges: [] };
    if (!this.nodes.has(id)) return result;

    const visited = new Set([id]);
    const typeSet = types.length > 0 ? new Set(types) : null;

    let frontier = [id];

    for (let d = 0; d < depth; d++) {
      const nextFrontier = [];

      for (const nodeId of frontier) {
        // Исходящие рёбра
        if (direction === 'both' || direction === 'out') {
          const outEdges = this.adjacency.get(nodeId) || new Set();
          for (const edgeIdx of outEdges) {
            const edge = this.edges[edgeIdx];
            if ((from || to) && !edgeOverlapsWindow(edge.valid_from, edge.valid_to, from, to)) continue;
            if (visited.has(edge.target)) continue;
            const targetNode = this.nodes.get(edge.target);
            if (!targetNode) continue;
            if (typeSet && !typeSet.has(targetNode.type)) continue;
            result.nodes.push(targetNode);
            result.edges.push(edge);
            visited.add(edge.target);
            nextFrontier.push(edge.target);
          }
        }

        // Входящие рёбра
        if (direction === 'both' || direction === 'in') {
          const inEdges = this.reverseAdj.get(nodeId) || new Set();
          for (const edgeIdx of inEdges) {
            const edge = this.edges[edgeIdx];
            if ((from || to) && !edgeOverlapsWindow(edge.valid_from, edge.valid_to, from, to)) continue;
            if (visited.has(edge.source)) continue;
            const sourceNode = this.nodes.get(edge.source);
            if (!sourceNode) continue;
            if (typeSet && !typeSet.has(sourceNode.type)) continue;
            result.nodes.push(sourceNode);
            result.edges.push(edge);
            visited.add(edge.source);
            nextFrontier.push(edge.source);
          }
        }
      }

      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }

    return result;
  }

  // ═══ paths ═══
  // FIX 4: DFS вместо BFS — все простые пути, не только кратчайшие.
  // FIX 5: только направленный обход (adjacency), убран reverseAdj — граф ориентированный.
  paths(srcId, tgtId, maxDepth = 4) {
    if (!this.nodes.has(srcId) || !this.nodes.has(tgtId)) return [];
    if (srcId === tgtId) return [[srcId]];

    const allPaths = [];
    const visited = new Set([srcId]);

    const dfs = (current, pathSoFar) => {
      if (pathSoFar.length > maxDepth + 1) return;

      const outEdges = this.adjacency.get(current) || new Set();
      for (const edgeIdx of outEdges) {
        const edge = this.edges[edgeIdx];
        if (visited.has(edge.target)) continue;

        const newPath = [...pathSoFar, edge.target];
        if (edge.target === tgtId) {
          allPaths.push(newPath);
          continue;
        }
        if (newPath.length - 1 < maxDepth) {
          visited.add(edge.target);
          dfs(edge.target, newPath);
          visited.delete(edge.target);
        }
      }
    };

    dfs(srcId, [srcId]);
    return allPaths;
  }

  // ═══ findByLabel ═══
  findByLabel(label, type = null) {
    const norm = normalizeLabel(label);
    if (!norm) return [];

    const exact = this.labelIndex.get(norm);
    if (exact) {
      const results = [];
      for (const id of exact) {
        const node = this.nodes.get(id);
        if (!type || node.type === type) {
          results.push({ node, matchType: 'exact', score: 1.0 });
        }
      }
      if (results.length > 0) return results;
    }

    const partial = [];
    for (const [labelKey, nodeIds] of this.labelIndex) {
      if (labelKey.includes(norm) || norm.includes(labelKey)) {
        for (const id of nodeIds) {
          const node = this.nodes.get(id);
          if (!type || node.type === type) {
            const score = Math.min(labelKey.length, norm.length) /
                          Math.max(labelKey.length, norm.length);
            partial.push({ node, matchType: 'partial', score: Math.round(score * 100) / 100 });
          }
        }
      }
    }

    partial.sort((a, b) => b.score - a.score);
    return partial;
  }

  // ═══ timeline ═══
  // FIX 2: используем edgeOverlapsWindow для корректного пересечения интервалов.
  timeline(entityId, from = null, to = null) {
    if (!this.nodes.has(entityId)) return { entity: null, events: [] };

    const entity = this.nodes.get(entityId);
    const events = [];

    // Исходящие рёбра
    const outEdges = this.adjacency.get(entityId) || new Set();
    for (const edgeIdx of outEdges) {
      const edge = this.edges[edgeIdx];
      const vf = edge.valid_from || edge.provenance?.[0]?.fetched_at || null;
      const vt = edge.valid_to;
      if ((from || to) && !edgeOverlapsWindow(vf, vt, from, to)) continue;

      const targetNode = this.nodes.get(edge.target);
      events.push({
        direction: 'out',
        relation: edge.type,
        target: { id: edge.target, label: targetNode?.label, type: targetNode?.type },
        valid_from: vf,
        valid_to: vt,
        weight: edge.weight,
        observed_at: edge.observed_at || edge.provenance?.[0]?.fetched_at || null,
      });
    }

    // Входящие рёбра
    const inEdges = this.reverseAdj.get(entityId) || new Set();
    for (const edgeIdx of inEdges) {
      const edge = this.edges[edgeIdx];
      const vf = edge.valid_from || edge.provenance?.[0]?.fetched_at || null;
      const vt = edge.valid_to;
      if ((from || to) && !edgeOverlapsWindow(vf, vt, from, to)) continue;

      const sourceNode = this.nodes.get(edge.source);
      events.push({
        direction: 'in',
        relation: edge.type,
        source: { id: edge.source, label: sourceNode?.label, type: sourceNode?.type },
        valid_from: vf,
        valid_to: vt,
        weight: edge.weight,
        observed_at: edge.observed_at || edge.provenance?.[0]?.fetched_at || null,
      });
    }

    // Сортировка по дате (от ранней к поздней)
    events.sort((a, b) => {
      const da = parseDate(a.valid_from || a.observed_at)?.getTime() || 0;
      const db = parseDate(b.valid_from || b.observed_at)?.getTime() || 0;
      return da - db;
    });

    return { entity, events };
  }

  // ═══ subgraph ═══
  subgraph(centerId, depth = 2) {
    const neighborsResult = this.neighbors(centerId, { depth });
    const nodeIds = new Set([centerId]);
    for (const n of neighborsResult.nodes) nodeIds.add(n.id);

    const subNodes = [...nodeIds].map(id => this.nodes.get(id)).filter(Boolean);
    const subEdges = neighborsResult.edges.filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    return {
      meta: {
        center: centerId,
        depth,
        node_count: subNodes.length,
        edge_count: subEdges.length,
      },
      nodes: subNodes,
      edges: subEdges,
    };
  }

  // ═══ stats ═══
  stats() {
    const typeCounts = {};
    for (const [type, ids] of this.typeIndex) {
      typeCounts[type] = ids.size;
    }

    const edgeTypeCounts = {};
    for (const edge of this.edges) {
      edgeTypeCounts[edge.type] = (edgeTypeCounts[edge.type] || 0) + 1;
    }

    const degreeMap = new Map();
    for (const edge of this.edges) {
      degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
      degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);
    }
    const topNodes = [...degreeMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, deg]) => ({
        id,
        label: this.nodes.get(id)?.label,
        type: this.nodes.get(id)?.type,
        degree: deg,
      }));

    return {
      meta: this.meta,
      node_count: this.nodes.size,
      edge_count: this.edges.length,
      types: typeCounts,
      edge_types: edgeTypeCounts,
      top_nodes_by_degree: topNodes,
    };
  }

  // ═══ toGeoJSON ═══
  // Узлы с координатами → FeatureCollection + links
  toGeoJSON() {
    const features = [];

    for (const node of this.nodes.values()) {
      const lat = node.properties?.lat;
      const lon = node.properties?.lon;
      if (lat == null || lon == null) continue;

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(lon), Number(lat)],
        },
        properties: {
          id: node.id,
          label: node.label,
          type: node.type,
          sources: node.sources,
          mention_count: node.mention_count,
          active_from: node.active_from,
          active_to: node.active_to,
        },
      });
    }

    const links = [];
    for (const edge of this.edges) {
      const sNode = this.nodes.get(edge.source);
      const tNode = this.nodes.get(edge.target);
      if (!sNode || !tNode) continue;
      const sLat = sNode.properties?.lat;
      const sLon = sNode.properties?.lon;
      const tLat = tNode.properties?.lat;
      const tLon = tNode.properties?.lon;
      if (sLat == null || sLon == null || tLat == null || tLon == null) continue;

      links.push({
        source: edge.source,
        target: edge.target,
        type: edge.type,
        weight: edge.weight,
        valid_from: edge.valid_from,
        valid_to: edge.valid_to,
      });
    }

    return {
      type: 'FeatureCollection',
      features,
      links,
      meta: {
        node_count: features.length,
        link_count: links.length,
        generated_at: new Date().toISOString(),
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
//  CLI
// ─────────────────────────────────────────────────────────────────────

async function cli() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(`Usage:
  node query-graph.mjs --node <id>
  node query-graph.mjs --neighbors <id> [--depth N] [--types Type1,Type2]
  node query-graph.mjs --paths <srcId> <tgtId> [--maxDepth N]
  node query-graph.mjs --search "label" [--type Type]
  node query-graph.mjs --timeline <id> [--from YYYY-MM-DD] [--to YYYY-MM-DD]
  node query-graph.mjs --subgraph <id> [--depth N]
  node query-graph.mjs --stats
  node query-graph.mjs --geojson
`);
    process.exit(0);
  }

  const gq = new GraphQuery();
  await gq.load();

  const cmd = args[0];

  switch (cmd) {
    case '--node': {
      const id = args[1];
      const node = gq.getNode(id);
      if (!node) { console.log(`Not found: ${id}`); process.exit(1); }
      console.log(JSON.stringify(node, null, 2));
      break;
    }

    case '--neighbors': {
      const id = args[1];
      const depthIdx = args.indexOf('--depth');
      const depth = depthIdx >= 0 ? parseInt(args[depthIdx + 1]) : 1;
      const typesIdx = args.indexOf('--types');
      const types = typesIdx >= 0 ? args[typesIdx + 1].split(',') : [];
      const result = gq.neighbors(id, { depth, types });
      console.log(`Nodes (${result.nodes.length}):`);
      for (const n of result.nodes) console.log(`  ${n.id}  [${n.type}]  ${n.label}`);
      console.log(`\nEdges (${result.edges.length}):`);
      for (const e of result.edges)
        console.log(`  ${e.source} → ${e.target}  [${e.type}]  w=${e.weight}`);
      break;
    }

    case '--paths': {
      const srcId = args[1];
      const tgtId = args[2];
      const maxDepthIdx = args.indexOf('--maxDepth');
      const maxDepth = maxDepthIdx >= 0 ? parseInt(args[maxDepthIdx + 1]) : 4;
      const allPaths = gq.paths(srcId, tgtId, maxDepth);
      console.log(`Paths (${allPaths.length}, maxDepth=${maxDepth}):`);
      for (let i = 0; i < allPaths.length; i++) {
        const pathStr = allPaths[i].map(id => {
          const n = gq.getNode(id);
          return n ? `${n.label}(${n.type})` : id;
        }).join(' → ');
        console.log(`  [${i + 1}] ${pathStr}`);
      }
      break;
    }

    case '--search': {
      const label = args[1];
      const typeIdx = args.indexOf('--type');
      const type = typeIdx >= 0 ? args[typeIdx + 1] : null;
      const results = gq.findByLabel(label, type);
      console.log(`Results (${results.length}):`);
      for (const r of results) {
        console.log(`  [${r.matchType}] score=${r.score}  ${r.node.id}  [${r.node.type}]  ${r.node.label}`);
        if (r.node.aliases?.length) console.log(`    aliases: ${r.node.aliases.join(', ')}`);
      }
      break;
    }

    case '--timeline': {
      const id = args[1];
      const fromIdx = args.indexOf('--from');
      const toIdx = args.indexOf('--to');
      const from = fromIdx >= 0 ? args[fromIdx + 1] : null;
      const to = toIdx >= 0 ? args[toIdx + 1] : null;
      const tl = gq.timeline(id, from, to);
      console.log(`Entity: ${tl.entity?.label} [${tl.entity?.type}]`);
      console.log(`Events (${tl.events.length}):`);
      for (const ev of tl.events) {
        const dir = ev.direction === 'out' ? '→' : '←';
        const other = ev.direction === 'out' ? ev.target : ev.source;
        console.log(`  ${ev.valid_from || ev.observed_at || '?'}  ${dir}  ${other.label} [${other.type}]  ${ev.relation}  w=${ev.weight}`);
      }
      break;
    }

    case '--subgraph': {
      const id = args[1];
      const depthIdx = args.indexOf('--depth');
      const depth = depthIdx >= 0 ? parseInt(args[depthIdx + 1]) : 2;
      const sg = gq.subgraph(id, depth);
      console.log(`Subgraph: ${sg.meta.node_count} nodes, ${sg.meta.edge_count} edges (depth=${depth})`);
      console.log(JSON.stringify(sg, null, 2));
      break;
    }

    case '--stats': {
      const s = gq.stats();
      console.log(JSON.stringify(s, null, 2));
      break;
    }

    case '--geojson': {
      const gj = gq.toGeoJSON();
      console.log(JSON.stringify(gj, null, 2));
      break;
    }

    default:
      console.log(`Unknown command: ${cmd}`);
      process.exit(1);
  }
}

export { GraphQuery };
export default GraphQuery;

// FIX 1: через fileURLToPath — работает с кириллицей в пути.
// Проверка: этот файл вызван напрямую (node query-graph.mjs ...)?
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const invokedFile = path.resolve(process.argv[1]);
    return thisFile === invokedFile;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  cli().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
