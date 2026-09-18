// Crucix — AdaptiveNewsClustering (класс-вычислитель)
// Кластеризация новостей по TF-IDF + cosine similarity с гео-привязкой.
//
// Используется анализатором scripts/analyzers/adaptive-news-clustering.mjs.

const HOUR_MS = 3600 * 1000;
const MIN_TOKENS = 3;

export default class AdaptiveNewsClustering {
  constructor(opts = {}) {
    this.simThreshold = opts.simThreshold ?? 0.35;
    this.clusterTTL = opts.clusterTTL ?? 24 * HOUR_MS;
    this.clusters = new Map();
    this.idfCache = new Map();
    this.totalDocs = 0;
    this.clusterCounter = 0;
  }

  add(input) {
    const now = Date.now();
    const text = (input.title || '') + ' ' + (input.text || '');
    const tokens = this._tokenize(text);
    if (tokens.length < MIN_TOKENS) {
      return { clusterId: null, action: 'skipped', clusterSize: 0, similarity: 0 };
    }

    this.totalDocs++;
    const tf = this._tf(tokens);
    for (const t of Object.keys(tf)) {
      this.idfCache.set(t, (this.idfCache.get(t) || 0) + 1);
    }
    const tfidf = this._tfidf(tf);

    let bestCluster = null, bestSim = 0;
    for (const cluster of this.clusters.values()) {
      const sim = this._cosine(tfidf, cluster.tfidf);
      if (sim > this.simThreshold && sim > bestSim) {
        bestSim = sim;
        bestCluster = cluster;
      }
    }

    if (bestCluster) {
      this._mergeInto(bestCluster, input, tfidf, tokens);
      return {
        clusterId: bestCluster.id,
        action: 'merged',
        clusterSize: bestCluster.items.length,
        similarity: +bestSim.toFixed(3),
      };
    }

    const cid = `cluster_${++this.clusterCounter}`;
    const cluster = {
      id: cid,
      items: [this._toItem(input)],
      tfidf,
      tokenCount: tokens.length,
      centroidLat: input.lat || null,
      centroidLon: input.lon || null,
      entities: new Set(input.entities || []),
      sources: new Set([input.source || 'unknown']),
      created: now,
      lastUpdate: now,
    };
    this.clusters.set(cid, cluster);
    return { clusterId: cid, action: 'created', clusterSize: 1, similarity: 0 };
  }

  _mergeInto(cluster, input, tfidf, tokens) {
    cluster.items.push(this._toItem(input));
    cluster.lastUpdate = input.timestamp || Date.now();
    cluster.sources.add(input.source || 'unknown');

    if (input.lat != null && input.lon != null) {
      const n = cluster.items.length;
      if (cluster.centroidLat == null) {
        cluster.centroidLat = input.lat;
        cluster.centroidLon = input.lon;
      } else {
        cluster.centroidLat = (cluster.centroidLat * (n - 1) + input.lat) / n;
        cluster.centroidLon = (cluster.centroidLon * (n - 1) + input.lon) / n;
      }
    }

    if (input.entities) {
      for (const e of input.entities) cluster.entities.add(e);
    }

    const newTokenCount = cluster.tokenCount + tokens.length;
    for (const [term, weight] of Object.entries(tfidf)) {
      cluster.tfidf[term] =
        (cluster.tfidf[term] || 0) * (cluster.tokenCount / newTokenCount) +
        weight * (tokens.length / newTokenCount);
    }
    cluster.tokenCount = newTokenCount;
  }

  _toItem(input) {
    return {
      id: input.id,
      title: input.title,
      source: input.source,
      timestamp: input.timestamp || Date.now(),
      lat: input.lat || null,
      lon: input.lon || null,
      countryCode: input.countryCode || null,
    };
  }

  topClusters(n = 20) {
    const now = Date.now();
    const result = [];
    for (const cluster of this.clusters.values()) {
      if (now - cluster.lastUpdate > this.clusterTTL) continue;
      const ageHours = (now - cluster.created) / HOUR_MS;
      result.push({
        id: cluster.id,
        size: cluster.items.length,
        sourceCount: cluster.sources.size,
        ageHours: +ageHours.toFixed(1),
        lastUpdate: cluster.lastUpdate,
        topTitle: cluster.items[0]?.title || '',
        centroidLat: cluster.centroidLat,
        centroidLon: cluster.centroidLon,
        entities: [...cluster.entities].slice(0, 10),
        diversityScore: +(cluster.sources.size / cluster.items.length).toFixed(2),
      });
    }
    return result
      .sort((a, b) => b.size * b.diversityScore - a.size * a.diversityScore)
      .slice(0, n);
  }

  getCluster(clusterId) { return this.clusters.get(clusterId) || null; }

  prune() {
    const now = Date.now();
    for (const [cid, cluster] of this.clusters) {
      if (now - cluster.lastUpdate > this.clusterTTL) this.clusters.delete(cid);
    }
  }

  _tokenize(text) {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/)
      .filter(w => w.length > 2 && w.length < 30);
  }
  _tf(tokens) {
    const tf = {};
    if (tokens.length < MIN_TOKENS) return tf;
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    const len = tokens.length;
    for (const t in tf) tf[t] /= len;
    return tf;
  }
  _tfidf(tf) {
    const result = {};
    for (const [term, freq] of Object.entries(tf)) {
      const df = this.idfCache.get(term) || 1;
      const idf = Math.log((this.totalDocs + 1) / df);
      result[term] = freq * idf;
    }
    return result;
  }
  _cosine(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (const [term, weight] of Object.entries(a)) {
      dot += weight * (b[term] || 0);
      normA += weight * weight;
    }
    for (const weight of Object.values(b)) normB += weight * weight;
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom > 0 ? dot / denom : 0;
  }
}
