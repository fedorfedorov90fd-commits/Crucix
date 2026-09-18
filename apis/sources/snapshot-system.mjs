// Crucix — SnapshotSystem
// Сохранение и сравнение снимков состояния мира на разные моменты.

export default class SnapshotSystem {
  constructor(opts = {}) {
    this.snapshots = new Map();
    this.maxSnapshots = opts.maxSnapshots ?? 100;
  }

  take(id, data) {
    const snap = {
      id,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data)),
      checksum: this._hash(JSON.stringify(data)),
    };
    this.snapshots.set(id, snap);
    if (this.snapshots.size > this.maxSnapshots) {
      const oldest = [...this.snapshots.keys()][0];
      this.snapshots.delete(oldest);
    }
    return snap;
  }

  diff(oldId, newId) {
    const oldSnap = this.snapshots.get(oldId);
    const newSnap = this.snapshots.get(newId);
    if (!oldSnap || !newSnap) return null;
    const changes = [];
    const allKeys = new Set([...Object.keys(oldSnap.data), ...Object.keys(newSnap.data)]);
    for (const key of allKeys) {
      const oldVal = oldSnap.data[key];
      const newVal = newSnap.data[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ key, oldValue: oldVal, newValue: newVal });
      }
    }
    return {
      fromId: oldId, toId: newId,
      fromTimestamp: oldSnap.timestamp, toTimestamp: newSnap.timestamp,
      timeDeltaMs: newSnap.timestamp - oldSnap.timestamp,
      changesCount: changes.length,
      changes,
    };
  }

  list() { return [...this.snapshots.values()].map(s => ({ id: s.id, timestamp: s.timestamp, checksum: s.checksum })); }
  get(id) { return this.snapshots.get(id) || null; }
  _hash(str) { let h = 0; for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0; return h.toString(16); }
}
