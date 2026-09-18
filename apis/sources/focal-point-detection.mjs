// Crucix — FocalPointDetection
// Определение фокусных точек — регионов с максимальной концентрацией сигналов.

export default class FocalPointDetection {
  constructor(opts = {}) {
    this.points = new Map();
    this.radiusKm = opts.radiusKm ?? 500;
    this.minSignals = opts.minSignals ?? 3;
  }

  ingest(signal) {
    if (signal.lat == null || signal.lon == null) return null;
    const key = this._cellKey(signal.lat, signal.lon);
    if (!this.points.has(key)) this.points.set(key, { key, lat: 0, lon: 0, count: 0, signals: [], streams: new Set() });
    const p = this.points.get(key);
    p.lat = (p.lat * p.count + signal.lat) / (p.count + 1);
    p.lon = (p.lon * p.count + signal.lon) / (p.count + 1);
    p.count++;
    p.signals.push({ id: signal.id, stream: signal.stream, severity: signal.severity || 0.5 });
    if (signal.stream) p.streams.add(signal.stream);
    return this._assess(p);
  }

  _cellKey(lat, lon) {
    const gridDeg = this.radiusKm / 111;
    return `${Math.floor(lat / gridDeg)}_${Math.floor(lon / gridDeg)}`;
  }

  _assess(p) {
    if (p.count < this.minSignals) return null;
    const avgSev = p.signals.reduce((s, x) => s + x.severity, 0) / p.count;
    return {
      id: p.key, lat: p.lat, lon: p.lon,
      signalCount: p.count,
      streamCount: p.streams.size,
      streams: [...p.streams],
      avgSeverity: Math.round(avgSev * 100) / 100,
      focalScore: Math.round(p.count * avgSev * p.streams.size * 100) / 100,
    };
  }

  topFocalPoints(n = 10) {
    const points = [...this.points.values()].map(p => this._assess(p)).filter(Boolean);
    return points.sort((a, b) => b.focalScore - a.focalScore).slice(0, n);
  }

  clear() { this.points = new Map(); }
}
