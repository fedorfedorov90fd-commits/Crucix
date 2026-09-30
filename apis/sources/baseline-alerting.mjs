// Crucix — BaselineAlerting (класс-вычислитель)
// Пороговые уведомления: сравнение текущих значений с baseline.

export default class BaselineAlerting {
  constructor(opts = {}) {
    this.baselines = new Map();
    this.alerts = [];
    this.thresholds = opts.thresholds || { warn: 1.5, alert: 2.0, critical: 3.0 };
  }

  setBaseline(key, stats) {
    // stats = { mean, stddev, samples }
    this.baselines.set(key, { ...stats, updated: Date.now() });
  }

  check(key, currentValue) {
    const b = this.baselines.get(key);
    if (!b || b.stddev === 0) return null;
    const zScore = (currentValue - b.mean) / b.stddev;
    const absZ = Math.abs(zScore);

    let level = null;
    if (absZ >= this.thresholds.critical) level = 'critical';
    else if (absZ >= this.thresholds.alert) level = 'alert';
    else if (absZ >= this.thresholds.warn) level = 'warn';

    if (!level) return null;

    const alert = {
      key,
      currentValue,
      baselineMean: b.mean,
      baselineStddev: b.stddev,
      zScore: Math.round(zScore * 100) / 100,
      absZScore: Math.round(absZ * 100) / 100,
      direction: zScore > 0 ? 'above' : 'below',
      level,
      timestamp: Date.now(),
    };
    this.alerts.push(alert);
    return alert;
  }

  getAllAlerts() { return [...this.alerts]; }
  getAlertsByLevel(level) { return this.alerts.filter(a => a.level === level); }
  recentAlerts(n = 20) { return this.alerts.slice(-n).reverse(); }
  clear() { this.alerts = []; }
}
