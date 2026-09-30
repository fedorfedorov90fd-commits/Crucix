// Crucix — CrossStreamCorrelation (класс-вычислитель)
// Кросс-корреляция событий из разных потоков данных:
// новости, конфликты, рынки, инфраструктура, погода.
//
// Используется анализатором scripts/analyzers/cross-stream-correlation.mjs.

const STREAMS = ['news', 'conflict', 'market', 'infrastructure', 'weather', 'cyber'];

// Окна корреляции (в часах)
const WINDOW_HOURS = [6, 24, 72, 168];

const HOUR_MS = 3600 * 1000;

export default class CrossStreamCorrelation {
  constructor(opts = {}) {
    this.events = [];
    this.maxEvents = opts.maxEvents ?? 10000;
  }

  /**
   * Добавить событие в поток.
   * @param {Object} event
   * @param {string} event.id
   * @param {string} event.stream   — news | conflict | market | infrastructure | weather | cyber
   * @param {number} event.timestamp
   * @param {string} [event.region]
   * @param {string} [event.country]
   * @param {number} [event.severity]   — 0..1
   * @param {string[]} [event.entities]
   */
  add(event) {
    if (!STREAMS.includes(event.stream)) return false;
    this.events.push({
      ...event,
      timestamp: event.timestamp || Date.now(),
      severity: typeof event.severity === 'number' ? event.severity : 0.5,
    });
    if (this.events.length > this.maxEvents) this.events.shift();
    return true;
  }

  /**
   * Найти корреляции между потоками в заданном регионе.
   * @param {string} region
   * @param {Object} [opts] — { windowHours, minSeverity }
   * @returns {Object}
   */
  correlate(region, opts = {}) {
    const windowHours = opts.windowHours || 24;
    const minSeverity = opts.minSeverity ?? 0.3;
    const now = Date.now();
    const windowMs = windowHours * HOUR_MS;

    // Фильтруем события в окне + регионе + с достаточной severity
    const relevant = this.events.filter(e =>
      e.timestamp >= now - windowMs &&
      e.severity >= minSeverity &&
      (!region || e.region === region || e.country === region)
    );

    // Группируем по потокам
    const byStream = {};
    for (const s of STREAMS) byStream[s] = [];
    for (const e of relevant) byStream[e.stream].push(e);

    // Ищем пары потоков с корреляцией
    const correlations = [];
    for (let i = 0; i < STREAMS.length; i++) {
      for (let j = i + 1; j < STREAMS.length; j++) {
        const a = STREAMS[i], b = STREAMS[j];
        const eventsA = byStream[a], eventsB = byStream[b];
        if (eventsA.length === 0 || eventsB.length === 0) continue;

        // Простая корреляция по времени: считаем события в общем окне ±3 часа
        let matches = 0;
        for (const ea of eventsA) {
          for (const eb of eventsB) {
            if (Math.abs(ea.timestamp - eb.timestamp) <= 3 * HOUR_MS) {
              matches++;
              break;
            }
          }
        }
        const strength = matches / Math.max(eventsA.length, eventsB.length);

        if (strength > 0.2) {
          correlations.push({
            streams: [a, b],
            strength: Math.round(strength * 100) / 100,
            eventsA: eventsA.length,
            eventsB: eventsB.length,
            matches,
          });
        }
      }
    }

    correlations.sort((x, y) => y.strength - x.strength);

    // Общая конвергенция = средневзвешенная всех потоков
    const activeStreams = STREAMS.filter(s => byStream[s].length > 0);
    const convergence = activeStreams.length / STREAMS.length;

    return {
      region,
      windowHours,
      totalEvents: relevant.length,
      activeStreams: activeStreams.length,
      convergenceScore: Math.round(convergence * 100),
      convergenceLevel: convergence >= 0.75 ? 'critical'
                      : convergence >= 0.5  ? 'high'
                      : convergence >= 0.25 ? 'moderate' : 'low',
      byStream: Object.fromEntries(Object.entries(byStream).map(([k, v]) => [k, v.length])),
      correlations: correlations.slice(0, 10),
    };
  }

  /**
   * Топ регионов по конвергенции.
   */
  topConvergenceRegions(n = 10, opts = {}) {
    const regions = new Set(this.events.map(e => e.region).filter(Boolean));
    const results = [];
    for (const region of regions) {
      const r = this.correlate(region, opts);
      if (r.totalEvents > 0) results.push({ region, ...r });
    }
    return results.sort((a, b) => b.convergenceScore - a.convergenceScore).slice(0, n);
  }

  clear() { this.events = []; }
}
