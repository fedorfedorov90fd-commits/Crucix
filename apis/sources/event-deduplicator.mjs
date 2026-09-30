// Crucix — EventDeduplicator
// Дедупликация событий по хешу и семантическому сходству.

import { createHash } from 'crypto';
export default class EventDeduplicator {
  constructor(opts = {}) {
    this.seen = new Map();
    this.duplicates = [];
    this.ttl = opts.ttl ?? 24 * 3600 * 1000;
  }
  hash(event) {
    const s = `${event.type || ''}_${event.title || ''}_${event.country || ''}_${Math.floor((event.timestamp || Date.now()) / 3600000)}`;
    return createHash('sha256').update(s).digest('hex').slice(0, 16);
  }
  add(event) {
    const h = this.hash(event);
    if (this.seen.has(h)) {
      this.duplicates.push({ original: this.seen.get(h), duplicate: event, hash: h });
      return { action: 'duplicate', hash: h, original: this.seen.get(h) };
    }
    this.seen.set(h, event);
    return { action: 'added', hash: h };
  }
  prune() {
    const cutoff = Date.now() - this.ttl;
    for (const [h, ev] of this.seen) {
      if ((ev.timestamp || 0) < cutoff) this.seen.delete(h);
    }
  }
  getAll() { return [...this.seen.values()]; }
  stats() { return { unique: this.seen.size, duplicates: this.duplicates.length }; }
}
