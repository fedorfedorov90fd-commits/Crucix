// Crucix — RateLimiter
// Ограничение частоты обращений к внешним API.

export default class RateLimiter {
  constructor(opts = {}) {
    this.limits = new Map();
    this.defaultWindowMs = opts.defaultWindowMs ?? 60000;
    this.defaultMax = opts.defaultMax ?? 60;
  }
  setLimit(key, max, windowMs = this.defaultWindowMs) {
    this.limits.set(key, { key, max, windowMs, hits: [] });
    return this;
  }
  hit(key) {
    let l = this.limits.get(key);
    if (!l) l = this.setLimit(key, this.defaultMax, this.defaultWindowMs);
    const now = Date.now();
    l.hits = l.hits.filter(t => now - t < l.windowMs);
    if (l.hits.length >= l.max) {
      return { allowed: false, remaining: 0, retryAfterMs: l.windowMs - (now - l.hits[0]) };
    }
    l.hits.push(now);
    return { allowed: true, remaining: l.max - l.hits.length, resetIn: l.windowMs - (now - l.hits[0]) };
  }
  status(key) {
    const l = this.limits.get(key);
    if (!l) return null;
    const now = Date.now();
    const recent = l.hits.filter(t => now - t < l.windowMs);
    return { key, used: recent.length, max: l.max, remaining: l.max - recent.length };
  }
  getAll() { return [...this.limits.keys()].map(k => this.status(k)); }
}
