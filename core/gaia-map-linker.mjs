// ═══════════════════════════════════════════════════════════════
//  CRUCIX GAIA MAP LINKER v1.0.0
//  Связь объектов карты с сущностями графа.
//  Spatial neighbors, overlay, highlight, контекст для AI.
//  Работает поверх EntityGraph. Без fetch().
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export class GaiaMapLinker extends EventEmitter {
  constructor(graph, options = {}) {
    super();
    if (!graph) throw new Error('GaiaMapLinker требует EntityGraph');
    this.graph = graph;
    this.gridCellDeg = Number.isFinite(options.gridCellDeg) ? options.gridCellDeg : 1;
    this.spatialGrid = new Map();  // 'latBucket:lonBucket' → Set<nodeId>
    this.nodeBuckets = new Map();  // nodeId → bucketKey
    this.overlays = new Map();     // layerId → Set<nodeId>
    this.highlighted = new Set();

    this._wire();
    this.reindex();
  }

  _wire() {
    this.graph.on('node:added',   (n) => this._indexNode(n.id));
    this.graph.on('node:updated', (n) => this._reindexNode(n.id));
    this.graph.on('node:removed', (id) => this._unindexNode(id));
    this.graph.on('cleared',      () => this._clearIndex());
  }

  _bucketKey(lat, lon) {
    const latB = Math.floor(lat / this.gridCellDeg);
    const lonB = Math.floor(lon / this.gridCellDeg);
    return `${latB}:${lonB}`;
  }

  _addToBucket(nodeId, key) {
    if (!this.spatialGrid.has(key)) this.spatialGrid.set(key, new Set());
    this.spatialGrid.get(key).add(nodeId);
    this.nodeBuckets.set(nodeId, key);
  }

  _removeFromBucket(nodeId) {
    const key = this.nodeBuckets.get(nodeId);
    if (!key) return;
    const set = this.spatialGrid.get(key);
    if (set) {
      set.delete(nodeId);
      if (set.size === 0) this.spatialGrid.delete(key);
    }
    this.nodeBuckets.delete(nodeId);
  }

  _indexNode(nodeId) {
    const n = this.graph.getNode(nodeId);
    if (!n || !Number.isFinite(n.lat) || !Number.isFinite(n.lon)) return;
    this._removeFromBucket(nodeId);
    this._addToBucket(nodeId, this._bucketKey(n.lat, n.lon));
  }

  _reindexNode(nodeId) { this._indexNode(nodeId); }

  _unindexNode(nodeId) {
    this._removeFromBucket(nodeId);
    this.highlighted.delete(nodeId);
  }

  _clearIndex() {
    this.spatialGrid.clear();
    this.nodeBuckets.clear();
    this.highlighted.clear();
  }

  reindex() {
    this._clearIndex();
    for (const id of this.graph.nodes.keys()) this._indexNode(id);
    this.emit('reindexed', { count: this.nodeBuckets.size });
    return this.nodeBuckets.size;
  }

  // ── Spatial neighbors ──────────────────────────────────────
  findNeighbors(lat, lon, radiusKm = 100, nodeType = null) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    const cellKm = this.gridCellDeg * 111;
    const searchCells = Math.ceil(radiusKm / cellKm) + 1;
    const latB = Math.floor(lat / this.gridCellDeg);
    const lonB = Math.floor(lon / this.gridCellDeg);
    const candidates = new Set();

    for (let dLat = -searchCells; dLat <= searchCells; dLat++) {
      for (let dLon = -searchCells; dLon <= searchCells; dLon++) {
        const key = `${latB + dLat}:${lonB + dLon}`;
        const bucket = this.spatialGrid.get(key);
        if (bucket) for (const id of bucket) candidates.add(id);
      }
    }

    const result = [];
    for (const id of candidates) {
      const n = this.graph.getNode(id);
      if (!n || !Number.isFinite(n.lat) || !Number.isFinite(n.lon)) continue;
      if (nodeType && n.type !== nodeType) continue;
      const d = haversineKm(lat, lon, n.lat, n.lon);
      if (d <= radiusKm) {
        result.push({ nodeId: id, type: n.type, label: n.label, lat: n.lat, lon: n.lon,
                       distanceKm: Number(d.toFixed(3)), credibility: n.credibility, riskScore: n.riskScore });
      }
    }
    result.sort((a, b) => a.distanceKm - b.distanceKm);
    return result;
  }

  // ── Bounding box ───────────────────────────────────────────
  findInBBox({ north, south, east, west }, nodeType = null) {
    const result = [];
    for (const [id, node] of this.graph.nodes) {
      if (!Number.isFinite(node.lat) || !Number.isFinite(node.lon)) continue;
      if (nodeType && node.type !== nodeType) continue;
      if (node.lat >= south && node.lat <= north && node.lon >= west && node.lon <= east) {
        result.push({ nodeId: id, type: node.type, label: node.label, lat: node.lat, lon: node.lon,
                       credibility: node.credibility, riskScore: node.riskScore });
      }
    }
    return result;
  }

  // ── Overlays ──────────────────────────────────────────────
  linkOverlay(layerId, nodeIds) {
    this.overlays.set(layerId, new Set(nodeIds));
    this.emit('overlay:linked', { layerId, count: nodeIds.length });
    return this.overlays.get(layerId).size;
  }

  unlinkOverlay(layerId) {
    const removed = this.overlays.delete(layerId);
    if (removed) this.emit('overlay:unlinked', { layerId });
    return removed;
  }

  getOverlayNodes(layerId) {
    const ids = this.overlays.get(layerId);
    if (!ids) return [];
    const result = [];
    for (const id of ids) {
      const n = this.graph.getNode(id);
      if (n) result.push(n.toJSON ? n.toJSON() : n);
    }
    return result;
  }

  listOverlays() {
    return [...this.overlays.entries()].map(([id, set]) => ({ layerId: id, count: set.size }));
  }

  // ── Highlight ─────────────────────────────────────────────
  highlight(nodeId, { depth = 1 } = {}) {
    this.highlighted.clear();
    this.highlighted.add(nodeId);
    if (this.graph.getNeighbors && depth > 0) {
      const neighbors = this.graph.getNeighbors(nodeId, depth);
      for (const n of neighbors) if (n.node) this.highlighted.add(n.node.id);
    }
    this.emit('highlight', { nodeId, nodes: [...this.highlighted], depth });
    return [...this.highlighted];
  }

  clearHighlight() {
    const had = this.highlighted.size > 0;
    this.highlighted.clear();
    if (had) this.emit('highlight:cleared');
    return had;
  }

  isHighlighted(nodeId) { return this.highlighted.has(nodeId); }

  getHighlighted() { return [...this.highlighted]; }

  // ── Map context для AI ────────────────────────────────────
  buildMapContext({ viewport = null, activeLayers = [], center = null, radiusKm = null, limit = 50 } = {}) {
    let nodes = [];
    if (viewport) {
      nodes = this.findInBBox(viewport).map(r => this.graph.getNode(r.nodeId));
    } else if (center && radiusKm) {
      nodes = this.findNeighbors(center.lat, center.lon, radiusKm).map(r => this.graph.getNode(r.nodeId));
    } else {
      nodes = [...this.graph.nodes.values()];
    }
    nodes = nodes.filter(Boolean).slice(0, limit);

    const entities = nodes.map(n => ({
      id: n.id, type: n.type, label: n.label,
      lat: n.lat, lon: n.lon, country: n.country,
      credibility: n.credibility, riskScore: n.riskScore,
    }));

    const relationships = [];
    for (const n of nodes) {
      const edges = this.graph.getEdgesOf ? this.graph.getEdgesOf(n.id) : [];
      for (const e of edges.slice(0, 5)) {
        relationships.push({ from: e.from, to: e.to, type: e.type, credibility: e.credibility });
      }
    }

    return {
      viewport, activeLayers, center,
      entities,
      relationships: relationships.slice(0, 80),
      totals: { entities: entities.length, relationships: relationships.length },
    };
  }

  // ── Экспорт для карты ─────────────────────────────────────
  toMapFormat({ nodeType = null, limit = 5000 } = {}) {
    const features = [];
    for (const n of this.graph.nodes.values()) {
      if (nodeType && n.type !== nodeType) continue;
      if (!Number.isFinite(n.lat) || !Number.isFinite(n.lon)) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [n.lon, n.lat] },
        properties: { id: n.id, type: n.type, label: n.label, country: n.country,
                      credibility: n.credibility, riskScore: n.riskScore,
                      highlighted: this.highlighted.has(n.id) },
      });
      if (features.length >= limit) break;
    }
    return { type: 'FeatureCollection', features, total: features.length };
  }

  // ── Статистика ────────────────────────────────────────────
  getStats() {
    const buckets = this.spatialGrid.size;
    const indexed = this.nodeBuckets.size;
    return {
      indexedNodes: indexed,
      totalNodes: this.graph.nodes.size,
      gridCells: buckets,
      gridCellDeg: this.gridCellDeg,
      overlays: this.overlays.size,
      highlighted: this.highlighted.size,
    };
  }
}

let _instance = null;
export function getGaiaMapLinker(graph, options) {
  if (!_instance) {
    if (!graph) throw new Error('Первый вызов getGaiaMapLinker требует EntityGraph');
    _instance = new GaiaMapLinker(graph, options);
  }
  return _instance;
}
export function resetGaiaMapLinker() { _instance = null; }
