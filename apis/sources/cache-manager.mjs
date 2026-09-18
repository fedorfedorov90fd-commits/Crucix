// Crucix — CacheManager
// Управление кэшем с TTL и LRU.

export default class CacheManager {
  constructor(opts = {}) {
    this.cache = new Map();
    this.maxSize = opts.maxSize ?? 1000;
    this.defaultTTL = opts.defaultTTL ?? 300000;
  }
  set(key, value, ttlMs = this.defaultTTL) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expires: Date.now() + ttlMs, added: Date.now() });
    return this;
  }
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }
  has(key) { return this.get(key) !== null; }
  delete(key) { return this.cache.delete(key); }
  clear() { this.cache.clear(); }
  prune() {
    const now = Date.now();
    for (const [k, e] of this.cache) if (now > e.expires) this.cache.delete(k);
  }
  stats() { return { size: this.cache.size, maxSize: this.maxSize }; }
}
