// Crucix — SurgeDetection
// Обнаружение всплесков активности (аномальные значения).

export default class SurgeDetection {
  constructor(opts = {}) {
    this.series = new Map();
    this.windowSize = opts.windowSize ?? 20;
    this.threshold = opts.threshold ?? 2.5;
  }
  add(key, value, timestamp = Date.now()) {
    if (!this.series.has(key)) this.series.set(key, []);
    const arr = this.series.get(key);
    arr.push({ value, timestamp });
    if (arr.length > 1000) arr.shift();
    return this.detect(key);
  }
  detect(key) {
    const arr = this.series.get(key);
    if (!arr || arr.length < this.windowSize + 1) return null;
    const recent = arr.slice(-1)[0].value;
    const baseline = arr.slice(-this.windowSize - 1, -1).map(x => x.value);
    const mean = baseline.reduce((s, x) => s + x, 0) / baseline.length;
    const variance = baseline.reduce((s, x) => s + (x - mean) ** 2, 0) / baseline.length;
    const stddev = Math.sqrt(variance);
    if (stddev === 0) return null;
    const z = (recent - mean) / stddev;
    if (Math.abs(z) < this.threshold) return null;
    return {
      key,
      currentValue: recent,
      baselineMean: mean,
      baselineStddev: stddev,
      zScore: Math.round(z * 100) / 100,
      direction: z > 0 ? 'surge' : 'drop',
      severity: Math.abs(z) >= 4 ? 'critical' : Math.abs(z) >= 3 ? 'high' : 'moderate',
      timestamp: arr.slice(-1)[0].timestamp,
    };
  }
  getAllDetections() {
    const detections = [];
    for (const key of this.series.keys()) {
      const d = this.detect(key);
      if (d) detections.push(d);
    }
    return detections.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
  }
}
