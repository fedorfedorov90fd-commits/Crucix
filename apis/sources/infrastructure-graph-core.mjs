// infrastructure-graph-core.mjs
// Crucix Infrastructure — Layer 1: Graph Core
// Адаптировано под data/infrastructure/objects.json

const EARTH_RADIUS_KM = 6371;

export function haversine(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function normalizeObject(raw) {
  const coords = raw.coordinates || {};
  return {
    id: raw.id,
    name: raw.name || raw.id,
    type: raw.type || 'unknown',
    layer: raw.layer || null,
    country: raw.country || null,
    lat: coords.lat ?? null,
    lng: coords.lng ?? null,
    capacity: raw.capacity ?? null,
    unit: raw.unit || null,
    owner: raw.owner || null,
    status: raw.status || 'unknown',
    operational: raw.operational ?? null,
    vulnerability: raw.vulnerability ?? null,
    vulnerabilityNormalized: raw.vulnerability != null ? Math.min(raw.vulnerability / 10, 1) : null,
    risks: raw.risks || [],
    cascade: raw.cascade || [],
    sanctions: raw.sanctions || false,
    statusReason: raw.statusReason || null,
    lastUpdate: raw.lastUpdate || null,
  };
}

export class InfrastructureGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this._adjacency = new Map();
  }

  addNode(node) {
    if (!node.id) throw new Error('Node requires id');
    const normalized = normalizeObject(node);
    this.nodes.set(normalized.id, normalized);
    if (!this._adjacency.has(normalized.id)) {
      this._adjacency.set(normalized.id, new Map());
    }
    return this;
  }

  removeNode(id) {
    this.nodes.delete(id);
    this.edges.forEach((edge, key) => {
      if (edge.source === id || edge.target === id) {
        this.edges.delete(key);
      }
    });
    this._adjacency.delete(id);
    this._adjacency.forEach((neighbors) => neighbors.delete(id));
    return this;
  }

  addEdge(source, target, weight = 1, properties = {}) {
    if (!this.nodes.has(source)) throw new Error(`Node ${source} not found`);
    if (!this.nodes.has(target)) throw new Error(`Node ${target} not found`);
    const key = `${source}->${target}`;
    this.edges.set(key, { source, target, weight, properties });
    const srcAdj = this._adjacency.get(source) || new Map();
    srcAdj.set(target, weight);
    this._adjacency.set(source, srcAdj);
    return this;
  }

  addBidirectionalEdge(source, target, weight = 1, properties = {}) {
    this.addEdge(source, target, weight, properties);
    this.addEdge(target, source, weight, properties);
    return this;
  }

  removeEdge(source, target) {
    const key = `${source}->${target}`;
    this.edges.delete(key);
    const adj = this._adjacency.get(source);
    if (adj) adj.delete(target);
    return this;
  }

  getNode(id) {
    return this.nodes.get(id) || null;
  }

  getNeighbors(id) {
    const adj = this._adjacency.get(id);
    if (!adj) return [];
    return Array.from(adj.entries()).map(([target, weight]) => ({
      node: this.nodes.get(target),
      weight,
    }));
  }

  getDegree(id) {
    const adj = this._adjacency.get(id);
    return adj ? adj.size : 0;
  }

  getInDegree(id) {
    let count = 0;
    this.edges.forEach((edge) => {
      if (edge.target === id) count++;
    });
    return count;
  }

  getOutDegree(id) {
    const adj = this._adjacency.get(id);
    return adj ? adj.size : 0;
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getAllEdges() {
    return Array.from(this.edges.values());
  }

  size() {
    return { nodes: this.nodes.size, edges: this.edges.size };
  }

  getSubgraph(nodeIds) {
    const sub = new InfrastructureGraph();
    nodeIds.forEach((id) => {
      const node = this.nodes.get(id);
      if (node) sub.addNode({ ...node });
    });
    this.edges.forEach((edge) => {
      if (sub.nodes.has(edge.source) && sub.nodes.has(edge.target)) {
        sub.addEdge(edge.source, edge.target, edge.weight, edge.properties);
      }
    });
    return sub;
  }

  buildFromData(data) {
    const objects = Array.isArray(data) ? data : (data.objects || []);
    objects.forEach((obj) => this.addNode(obj));
    objects.forEach((obj) => {
      const cascadeIds = obj.cascade || [];
      cascadeIds.forEach((depId) => {
        if (this.nodes.has(depId)) {
          this.addEdge(obj.id, depId, 1, { type: 'cascade' });
        }
      });
    });
    return this;
  }

  findNearby(lat, lng, radiusKm) {
    return this.getAllNodes().filter((node) => {
      if (node.lat == null || node.lng == null) return false;
      return haversine(lat, lng, node.lat, node.lng) <= radiusKm;
    });
  }

  toJSON() {
    return {
      nodes: this.getAllNodes(),
      edges: this.getAllEdges(),
    };
  }

  static fromJSON(data) {
    const graph = new InfrastructureGraph();
    data.nodes.forEach((n) => graph.addNode(n));
    data.edges.forEach((e) => graph.addEdge(e.source, e.target, e.weight, e.properties));
    return graph;
  }
}
