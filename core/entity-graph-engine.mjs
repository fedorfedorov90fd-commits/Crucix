// ═══════════════════════════════════════════════════════════════
//  CRUCIX ENTITY GRAPH ENGINE v1.0.0
//  Универсальный граф сущностей. Ядро для карт Palantir и Osiris.
//  Читает данные только из data/basket/. Без fetch().
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ─── Типы узлов ────────────────────────────────────────────────
export const NODE_TYPES = Object.freeze({
  COUNTRY:       'country',
  ORGANIZATION:  'organization',
  PERSON:        'person',
  VESSEL:        'vessel',
  AIRCRAFT:      'aircraft',
  VEHICLE:       'vehicle',
  FACILITY:      'facility',
  INFRASTRUCTURE:'infrastructure',
  EVENT:         'event',
  LOCATION:      'location',
  SANCTION:      'sanction',
  CRYPTO_WALLET: 'crypto_wallet',
  IP_ADDRESS:    'ip_address',
  DOMAIN:        'domain',
  APT:           'apt',
  CVE:           'cve',
  MALWARE:       'malware',
  MEDIA:         'media',
  DOCUMENT:      'document',
  WEAPON:        'weapon',
  UNIT:          'unit',
  SATELLITE:     'satellite',
  SENSOR:        'sensor',
  OBSERVATION:   'observation',
});

// ─── Типы рёбер ────────────────────────────────────────────────
export const EDGE_TYPES = Object.freeze({
  OWNS:              'owns',
  CONTROLS:          'controls',
  OPERATES:          'operates',
  AFFILIATED_WITH:   'affiliated_with',
  MEMBER_OF:         'member_of',
  LOCATED_IN:        'located_in',
  NEAR:              'near',
  ROUTES_THROUGH:    'routes_through',
  TRADES_WITH:       'trades_with',
  SUPPLIES:          'supplies',
  SANCTIONS:         'sanctions',
  SANCTIONED_BY:     'sanctioned_by',
  ATTACKS:           'attacks',
  ATTACKED_BY:       'attacked_by',
  COMMUNICATES_WITH: 'communicates_with',
  TRANSFERRED_FUNDS: 'transferred_funds',
  ALLIED_WITH:       'allied_with',
  CONFLICTS_WITH:    'conflicts_with',
  PARENT_OF:         'parent_of',
  CHILD_OF:          'child_of',
  OBSERVED_AT:       'observed_at',
  MENTIONS:          'mentions',
  DERIVED_FROM:      'derived_from',
});

// ─── Внутренний класс узла ────────────────────────────────────
class GraphNode {
  constructor(data) {
    this.id          = data.id || `n_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.type        = data.type || NODE_TYPES.OBSERVATION;
    this.label       = data.label || data.name || this.id;
    this.aliases     = Array.isArray(data.aliases) ? data.aliases : [];
    this.description = data.description || '';
    this.lat         = Number.isFinite(data.lat) ? data.lat : (Number.isFinite(data.latitude) ? data.latitude : null);
    this.lon         = Number.isFinite(data.lon) ? data.lon : (Number.isFinite(data.longitude) ? data.longitude : null);
    this.country     = data.country || data.countryCode || null;
    this.properties  = data.properties && typeof data.properties === 'object' ? { ...data.properties } : {};
    this.sources     = Array.isArray(data.sources) ? data.sources : (data.source ? [data.source] : []);
    this.credibility = Number.isFinite(data.credibility) ? Math.max(0, Math.min(100, data.credibility)) : 50;
    this.riskScore   = Number.isFinite(data.riskScore) ? Math.max(0, Math.min(100, data.riskScore)) : 0;
    this.observations = Array.isArray(data.observations) ? data.observations : [];
    this.tags        = Array.isArray(data.tags) ? data.tags : [];
    this.createdAt   = data.createdAt || new Date().toISOString();
    this.updatedAt   = data.updatedAt || this.createdAt;
  }

  update(updates) {
    for (const [k, v] of Object.entries(updates)) {
      if (k === 'id') continue;
      if (k === 'properties' && v && typeof v === 'object') {
        this.properties = { ...this.properties, ...v };
      } else if (k === 'credibility' || k === 'riskScore') {
        this[k] = Math.max(0, Math.min(100, Number(v) || 0));
      } else {
        this[k] = v;
      }
    }
    this.updatedAt = new Date().toISOString();
    return this;
  }

  addObservation(obs) {
    if (!obs || typeof obs !== 'object') return null;
    const entry = {
      id:        obs.id || `o_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      timestamp: obs.timestamp || new Date().toISOString(),
      source:    obs.source || 'unknown',
      type:      obs.type || 'observation',
      lat:       Number.isFinite(obs.lat) ? obs.lat : null,
      lon:       Number.isFinite(obs.lon) ? obs.lon : null,
      data:      obs.data || {},
    };
    this.observations.push(entry);
    this.updatedAt = new Date().toISOString();
    return entry;
  }

  toJSON() {
    return {
      id: this.id, type: this.type, label: this.label,
      aliases: this.aliases, description: this.description,
      lat: this.lat, lon: this.lon, country: this.country,
      properties: this.properties, sources: this.sources,
      credibility: this.credibility, riskScore: this.riskScore,
      observations: this.observations, tags: this.tags,
      createdAt: this.createdAt, updatedAt: this.updatedAt,
    };
  }
}

// ─── Внутренний класс ребра ───────────────────────────────────
class GraphEdge {
  constructor(data) {
    this.id          = data.id || `e_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    this.from        = data.from;
    this.to          = data.to;
    this.type        = data.type || 'related_to';
    this.weight      = Number.isFinite(data.weight) ? data.weight : 1;
    this.credibility = Number.isFinite(data.credibility) ? Math.max(0, Math.min(100, data.credibility)) : 50;
    this.sources     = Array.isArray(data.sources) ? data.sources : (data.source ? [data.source] : []);
    this.properties  = data.properties && typeof data.properties === 'object' ? { ...data.properties } : {};
    this.createdAt   = data.createdAt || new Date().toISOString();
    this.updatedAt   = data.updatedAt || this.createdAt;
  }

  toJSON() {
    return {
      id: this.id, from: this.from, to: this.to, type: this.type,
      weight: this.weight, credibility: this.credibility,
      sources: this.sources, properties: this.properties,
      createdAt: this.createdAt, updatedAt: this.updatedAt,
    };
  }
}

// ─── Главный класс графа ──────────────────────────────────────
export class EntityGraph extends EventEmitter {
  constructor({ persistFile } = {}) {
    super();
    this.nodes = new Map();
    this.edges = new Map();
    this.outAdj = new Map();   // nodeId → Set<edgeId>
    this.inAdj  = new Map();   // nodeId → Set<edgeId>
    this.persistFile = persistFile || null;
    if (this.persistFile && existsSync(this.persistFile)) {
      this.load();
    }
  }

  // ── CRUD: узлы ──────────────────────────────────────────────
  addNode(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.id && this.nodes.has(data.id)) {
      return this.updateNode(data.id, data);
    }
    const node = new GraphNode(data);
    this.nodes.set(node.id, node);
    this.outAdj.set(node.id, new Set());
    this.inAdj.set(node.id, new Set());
    this.emit('node:added', node.toJSON());
    return node;
  }

  getNode(id) { return this.nodes.get(id) || null; }

  updateNode(id, updates) {
    const node = this.nodes.get(id);
    if (!node) return null;
    node.update(updates);
    this.emit('node:updated', node.toJSON());
    return node;
  }

  removeNode(id) {
    if (!this.nodes.has(id)) return false;
    const edgeIds = new Set([
      ...(this.outAdj.get(id) || []),
      ...(this.inAdj.get(id) || []),
    ]);
    for (const eid of edgeIds) this._removeEdgeInternal(eid);
    this.nodes.delete(id);
    this.outAdj.delete(id);
    this.inAdj.delete(id);
    this.emit('node:removed', id);
    return true;
  }

  // ── CRUD: рёбра ─────────────────────────────────────────────
  addEdge(data) {
    if (!data || typeof data !== 'object') return null;
    if (!data.from || !data.to) return null;
    if (!this.nodes.has(data.from) || !this.nodes.has(data.to)) return null;
    const edge = new GraphEdge(data);
    this.edges.set(edge.id, edge);
    this.outAdj.get(edge.from).add(edge.id);
    this.inAdj.get(edge.to).add(edge.id);
    this.emit('edge:added', edge.toJSON());
    return edge;
  }

  getEdge(id) { return this.edges.get(id) || null; }

  removeEdge(id) {
    if (!this.edges.has(id)) return false;
    return this._removeEdgeInternal(id);
  }

  _removeEdgeInternal(id) {
    const edge = this.edges.get(id);
    if (!edge) return false;
    this.edges.delete(id);
    this.outAdj.get(edge.from)?.delete(id);
    this.inAdj.get(edge.to)?.delete(id);
    this.emit('edge:removed', id);
    return true;
  }

  getEdgesOf(nodeId) {
    const ids = new Set([
      ...(this.outAdj.get(nodeId) || []),
      ...(this.inAdj.get(nodeId) || []),
    ]);
    return [...ids].map(id => this.edges.get(id)).filter(Boolean);
  }

  // ── Поиск ───────────────────────────────────────────────────
  search(query, { type = null, limit = 100 } = {}) {
    if (!query) return [];
    const q = String(query).toLowerCase().trim();
    if (!q) return [];
    const results = [];
    for (const node of this.nodes.values()) {
      if (type && node.type !== type) continue;
      if (node.label?.toLowerCase().includes(q)) { results.push(node); continue; }
      if (node.aliases.some(a => String(a).toLowerCase().includes(q))) { results.push(node); continue; }
      if (node.description?.toLowerCase().includes(q)) { results.push(node); continue; }
      if (node.id.toLowerCase().includes(q)) { results.push(node); continue; }
      if (node.country?.toLowerCase().includes(q)) { results.push(node); continue; }
      if (results.length >= limit) break;
    }
    return results.slice(0, limit);
  }

  // ── Обход в ширину ──────────────────────────────────────────
  getNeighbors(nodeId, depth = 1) {
    if (!this.nodes.has(nodeId)) return [];
    if (depth < 1) return [];
    const visited = new Set([nodeId]);
    const result = [];
    let frontier = [nodeId];
    for (let d = 1; d <= depth; d++) {
      const next = [];
      for (const nid of frontier) {
        const outIds = this.outAdj.get(nid) || new Set();
        for (const eid of outIds) {
          const edge = this.edges.get(eid);
          if (!edge || visited.has(edge.to)) continue;
          visited.add(edge.to);
          result.push({ node: this.nodes.get(edge.to)?.toJSON(), edge: edge.toJSON(), depth: d });
          next.push(edge.to);
        }
        const inIds = this.inAdj.get(nid) || new Set();
        for (const eid of inIds) {
          const edge = this.edges.get(eid);
          if (!edge || visited.has(edge.from)) continue;
          visited.add(edge.from);
          result.push({ node: this.nodes.get(edge.from)?.toJSON(), edge: edge.toJSON(), depth: d });
          next.push(edge.from);
        }
      }
      frontier = next;
      if (frontier.length === 0) break;
    }
    return result;
  }

  // ── Кратчайший путь (BFS) ───────────────────────────────────
  shortestPath(fromId, toId) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null;
    if (fromId === toId) return { path: [fromId], edges: [], hops: 0 };
    const parent = new Map([[fromId, null]]);
    const queue = [fromId];
    while (queue.length > 0) {
      const current = queue.shift();
      const ids = new Set([
        ...(this.outAdj.get(current) || []),
        ...(this.inAdj.get(current) || []),
      ]);
      for (const eid of ids) {
        const edge = this.edges.get(eid);
        if (!edge) continue;
        const next = edge.from === current ? edge.to : edge.from;
        if (parent.has(next)) continue;
        parent.set(next, { from: current, edgeId: eid });
        if (next === toId) {
          // Восстановление пути
          const path = [next];
          const edgePath = [];
          let cur = next;
          while (parent.get(cur) !== null) {
            const p = parent.get(cur);
            edgePath.unshift(this.edges.get(p.edgeId)?.toJSON());
            cur = p.from;
            path.unshift(cur);
          }
          return { path, edges: edgePath, hops: path.length - 1 };
        }
        queue.push(next);
      }
    }
    return null;
  }

  // ── Связные компоненты ──────────────────────────────────────
  connectedComponents() {
    const visited = new Set();
    const components = [];
    for (const nodeId of this.nodes.keys()) {
      if (visited.has(nodeId)) continue;
      const component = [];
      const stack = [nodeId];
      while (stack.length > 0) {
        const cur = stack.pop();
        if (visited.has(cur)) continue;
        visited.add(cur);
        component.push(cur);
        const ids = new Set([
          ...(this.outAdj.get(cur) || []),
          ...(this.inAdj.get(cur) || []),
        ]);
        for (const eid of ids) {
          const edge = this.edges.get(eid);
          if (!edge) continue;
          const next = edge.from === cur ? edge.to : edge.from;
          if (!visited.has(next)) stack.push(next);
        }
      }
      components.push({ size: component.length, nodes: component });
    }
    return components.sort((a, b) => b.size - a.size);
  }

  // ── Степени вершин ──────────────────────────────────────────
  getDegree(nodeId) {
    const out = this.outAdj.get(nodeId)?.size || 0;
    const inc = this.inAdj.get(nodeId)?.size || 0;
    return { out, in: inc, total: out + inc };
  }

  // ── Топ узлов ───────────────────────────────────────────────
  topNodes(limit = 20, by = 'degree') {
    const arr = [];
    for (const node of this.nodes.values()) {
      let score = 0;
      if (by === 'degree') score = this.getDegree(node.id).total;
      else if (by === 'risk') score = node.riskScore;
      else if (by === 'credibility') score = node.credibility;
      else score = this.getDegree(node.id).total;
      arr.push({ node, score });
    }
    arr.sort((a, b) => b.score - a.score);
    return arr.slice(0, limit).map(x => ({ ...x.node.toJSON(), score: x.score }));
  }

  // ── Агрегация достоверности (с учётом источников) ───────────
  aggregateCredibility(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    const edges = this.getEdgesOf(nodeId);
    const sourceWeights = new Map();
    const pushSource = (src, weight) => {
      if (!src) return;
      const prev = sourceWeights.get(src) || 0;
      sourceWeights.set(src, prev + weight);
    };
    for (const s of node.sources) pushSource(s, 1);
    for (const e of edges) {
      for (const s of e.sources) pushSource(s, e.credibility / 100);
    }
    const uniqueSources = sourceWeights.size;
    const multiSourceBonus = Math.min(20, Math.max(0, uniqueSources - 1) * 5);
    const base = node.credibility;
    const aggregated = Math.max(0, Math.min(100, base + multiSourceBonus));
    return {
      nodeId,
      base,
      aggregated,
      uniqueSources,
      sourceList: [...sourceWeights.keys()],
      multiSourceBonus,
    };
  }

  // ── Экспорт в формат карты (GeoJSON + links) ────────────────
  toMapFormat({ types = null, limit = 5000 } = {}) {
    const typeFilter = types ? new Set(types) : null;
    const features = [];
    let count = 0;
    for (const node of this.nodes.values()) {
      if (typeFilter && !typeFilter.has(node.type)) continue;
      if (!Number.isFinite(node.lat) || !Number.isFinite(node.lon)) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
        properties: {
          id: node.id,
          type: node.type,
          label: node.label,
          country: node.country,
          credibility: node.credibility,
          riskScore: node.riskScore,
          tags: node.tags,
        },
      });
      count++;
      if (count >= limit) break;
    }
    const links = [];
    for (const edge of this.edges.values()) {
      const fromNode = this.nodes.get(edge.from);
      const toNode   = this.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;
      if (!Number.isFinite(fromNode.lat) || !Number.isFinite(toNode.lat)) continue;
      links.push({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        type: edge.type,
        weight: edge.weight,
        credibility: edge.credibility,
      });
    }
    return { features, links, total: count };
  }

  // ── AI-контекст ─────────────────────────────────────────────
  toAIContext(nodeId = null, depth = 2, limit = 50) {
    if (!nodeId) {
      const nodes = [...this.nodes.values()].slice(0, limit).map(n => ({
        id: n.id, type: n.type, label: n.label,
        country: n.country, credibility: n.credibility, riskScore: n.riskScore,
      }));
      const edges = [...this.edges.values()].slice(0, limit * 2).map(e => ({
        from: e.from, to: e.to, type: e.type, credibility: e.credibility,
      }));
      return { focus: null, nodes, edges };
    }
    const focus = this.getNode(nodeId);
    if (!focus) return null;
    const neighbors = this.getNeighbors(nodeId, depth).slice(0, limit);
    return {
      focus: focus.toJSON(),
      neighbors,
      degree: this.getDegree(nodeId),
      aggregatedCredibility: this.aggregateCredibility(nodeId),
    };
  }

  // ── Импорт данных ──────────────────────────────────────────
  importData({ nodes = [], edges = [] } = {}) {
    let importedNodes = 0;
    let importedEdges = 0;
    for (const n of nodes) { if (this.addNode(n)) importedNodes++; }
    for (const e of edges) { if (this.addEdge(e)) importedEdges++; }
    this.emit('imported', { nodes: importedNodes, edges: importedEdges });
    return { nodes: importedNodes, edges: importedEdges };
  }

  // ── Автоимпорт из корзины ──────────────────────────────────
  autoImportFromBasket(basketDir) {
    let total = 0;
    const adapters = [
      {
        file: 'acled.json',
        type: NODE_TYPES.EVENT,
        labelField: 'eventType',
        idPrefix: 'acled',
      },
      {
        file: 'gdelt.json',
        type: NODE_TYPES.EVENT,
        labelField: 'title',
        idPrefix: 'gdelt',
      },
      {
        file: 'firms.json',
        type: NODE_TYPES.EVENT,
        labelField: 'title',
        idPrefix: 'firms',
      },
      {
        file: 'usgs.json',
        type: NODE_TYPES.EVENT,
        labelField: 'title',
        idPrefix: 'usgs',
      },
    ];
    for (const adapter of adapters) {
      const filePath = join(basketDir, adapter.file);
      if (!existsSync(filePath)) continue;
      let raw;
      try { raw = JSON.parse(readFileSync(filePath, 'utf-8')); }
      catch { continue; }
      const records = Array.isArray(raw) ? raw
                    : Array.isArray(raw.records) ? raw.records
                    : Array.isArray(raw.events) ? raw.events
                    : Array.isArray(raw.data) ? raw.data
                    : [];
      for (const r of records) {
        const id = `${adapter.idPrefix}_${r.id || randomUUID().replace(/-/g, '').slice(0, 10)}`;
        this.addNode({
          id,
          type: adapter.type,
          label: r[adapter.labelField] || r.title || r.name || 'unknown',
          lat: parseFloat(r.lat ?? r.latitude),
          lon: parseFloat(r.lon ?? r.longitude),
          country: r.country || r.countryCode || null,
          sources: [adapter.file],
          credibility: 60,
          properties: { raw: r },
        });
        total++;
      }
    }
    this.emit('auto-imported', { count: total });
    return total;
  }

  // ── Статистика ─────────────────────────────────────────────
  getStats() {
    const byType = {};
    const byEdgeType = {};
    for (const n of this.nodes.values()) {
      byType[n.type] = (byType[n.type] || 0) + 1;
    }
    for (const e of this.edges.values()) {
      byEdgeType[e.type] = (byEdgeType[e.type] || 0) + 1;
    }
    const comps = this.connectedComponents();
    return {
      nodes: this.nodes.size,
      edges: this.edges.size,
      byNodeType: byType,
      byEdgeType,
      components: comps.length,
      largestComponent: comps[0]?.size || 0,
    };
  }

  // ── Персистентность ────────────────────────────────────────
  save(filePath) {
    const target = filePath || this.persistFile;
    if (!target) return false;
    try {
      const dir = target.substring(0, target.lastIndexOf('/'));
      if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true });
      const data = {
        version: '1.0.0',
        savedAt: new Date().toISOString(),
        nodes: [...this.nodes.values()].map(n => n.toJSON()),
        edges: [...this.edges.values()].map(e => e.toJSON()),
      };
      writeFileSync(target, JSON.stringify(data, null, 2));
      this.persistFile = target;
      this.emit('saved', { file: target, nodes: this.nodes.size, edges: this.edges.size });
      return true;
    } catch (e) {
      this.emit('error', { type: 'save', error: e.message });
      return false;
    }
  }

  load(filePath) {
    const source = filePath || this.persistFile;
    if (!source || !existsSync(source)) return false;
    try {
      const raw = JSON.parse(readFileSync(source, 'utf-8'));
      for (const n of (raw.nodes || [])) {
        const node = new GraphNode(n);
        this.nodes.set(node.id, node);
        this.outAdj.set(node.id, new Set());
        this.inAdj.set(node.id, new Set());
      }
      for (const e of (raw.edges || [])) {
        const edge = new GraphEdge(e);
        if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) continue;
        this.edges.set(edge.id, edge);
        this.outAdj.get(edge.from).add(edge.id);
        this.inAdj.get(edge.to).add(edge.id);
      }
      this.emit('loaded', { file: source, nodes: this.nodes.size, edges: this.edges.size });
      return true;
    } catch (e) {
      this.emit('error', { type: 'load', error: e.message });
      return false;
    }
  }

  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.outAdj.clear();
    this.inAdj.clear();
    this.emit('cleared');
  }
}

// ─── Singleton-фабрика ────────────────────────────────────────
let _instance = null;

export function getEntityGraph({ persistFile, autoLoad = true } = {}) {
  if (!_instance) {
    _instance = new EntityGraph({ persistFile });
    if (autoLoad && persistFile && existsSync(persistFile)) {
      _instance.load(persistFile);
    }
  }
  return _instance;
}

export function resetEntityGraph() {
  _instance = null;
}
