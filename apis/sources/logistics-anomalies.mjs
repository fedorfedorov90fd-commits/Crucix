// Crucix — LogisticsAnomalies (класс-вычислитель)
// Обнаружение накопления логистики перед событием.
//
// Версия: 1.0.0
// Используется анализатором scripts/analyzers/logistics-anomalies.mjs.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Логистика — физический процесс. Перемещение войск, судов, авиации
//   невозможно скрыть на уровне источника. Даже если страна зачистила
//   медиа-поле, физические данные (ADS-B, AIS, NOTAM) остаются.
//   Аномалия = рост активности на 2+ стандартных отклонения от базовой
//   линии, либо новый узел в логистической сети, либо смещение
//   маршрутов в одну точку.
//
// АЛГОРИТМ (3 слоя):
//   1. Базовая линия: считаем медиану и MAD (median absolute deviation)
//      по числу событий в ячейке сетки. Устойчиво к выбросам.
//   2. Z-score робастный: (count - median) / (1.4826 * MAD).
//      Порог по умолчанию 1.5 (умеренная аномалия), 3.0 (сильная).
//   3. Кластеризация аномалий: аномальные ячейки с координатами
//      объединяются в кластеры через haversine (радиус 200 км).

const EARTH_R = 6371;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLon / 2) ** 2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function median(arr) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mad(arr, med) {
  if (arr.length === 0) return 0;
  const devs = arr.map(v => Math.abs(v - med));
  return median(devs);
}

export default class LogisticsAnomalies {
  constructor(opts = {}) {
    this.windowHours = opts.windowHours ?? 168;
    this.minAnomalyScore = opts.minAnomalyScore ?? 1.5;
    this.gridSizeKm = opts.gridSizeKm ?? 150;
    this.clusterRadiusKm = opts.clusterRadiusKm ?? 200;
    this.now = opts.now ?? Date.now();
    this.events = [];
  }

  add(event) {
    if (event == null || event.lat == null || event.lon == null) return false;
    this.events.push({
      lat: Number(event.lat),
      lon: Number(event.lon),
      type: event.type || 'unknown',
      severity: event.severity ?? 0.5,
      source: event.source || `${event.type || 'unknown'}_${this.events.length}`,
      timestamp: event.timestamp || this.now,
    });
    return true;
  }

  _cellKey(lat, lon) {
    const cellLat = Math.floor(lat / (this.gridSizeKm / 111));
    const cosLat = Math.cos(lat * Math.PI / 180);
    const cellLon = Math.floor(lon / (this.gridSizeKm / (111 * Math.max(cosLat, 0.01))));
    return `${cellLat}_${cellLon}`;
  }

  _isFresh(event) {
    if (!this.windowHours) return true;
    const ageHours = (this.now - new Date(event.timestamp).getTime()) / 3_600_000;
    return ageHours <= this.windowHours;
  }

  // ------------------------------------------------------------
  //  БАЗОВАЯ ЛИНИЯ (медиана + MAD по числу событий в ячейках)
  // ------------------------------------------------------------
  _baseline() {
    const fresh = this.events.filter(e => this._isFresh(e));
    const counts = new Map();
    for (const e of fresh) {
      const key = this._cellKey(e.lat, e.lon);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const values = Array.from(counts.values());
    const med = median(values);
    const deviation = mad(values, med);
    return { median: med, mad: deviation, counts };
  }

  // ------------------------------------------------------------
  //  ДЕТЕКТ АНОМАЛИЙ (робастный Z-score)
  // ------------------------------------------------------------
  detectAnomalies() {
    const baseline = this._baseline();
    const fresh = this.events.filter(e => this._isFresh(e));
    const cells = new Map();

    for (const e of fresh) {
      const key = this._cellKey(e.lat, e.lon);
      if (!cells.has(key)) {
        cells.set(key, { lat: 0, lon: 0, count: 0, sumSev: 0, types: {}, sources: new Set() });
      }
      const c = cells.get(key);
      c.lat += e.lat;
      c.lon += e.lon;
      c.count++;
      c.sumSev += e.severity;
      c.types[e.type] = (c.types[e.type] || 0) + 1;
      c.sources.add(e.source);
    }

    const anomalies = [];
    for (const [key, c] of cells) {
      const centerLat = c.lat / c.count;
      const centerLon = c.lon / c.count;
      const deviation = baseline.mad === 0 ? 0 : (c.count - baseline.median) / (1.4826 * baseline.mad);
      const score = Math.max(deviation, 0);

      if (score < this.minAnomalyScore) continue;

      const dominantType = Object.entries(c.types).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      const typeDiversity = Object.keys(c.types).length;
      const uniqueSources = c.sources.size;
      const avgSeverity = c.sumSev / c.count;

      // Итоговый балл с учётом разнообразия и мультиподтверждения.
      const compositeScore = score * (1 + (typeDiversity - 1) * 0.3) * (1 + (uniqueSources - 1) * 0.2);

      anomalies.push({
        cellId: key,
        lat: centerLat,
        lon: centerLon,
        eventCount: c.count,
        avgSeverity: Math.round(avgSeverity * 1000) / 1000,
        deviation: Math.round(deviation * 100) / 100,
        score: Math.round(compositeScore * 100) / 100,
        dominantType,
        typeDiversity,
        uniqueSources,
        types: c.types,
        level: compositeScore >= 5 ? 'critical' : compositeScore >= 3 ? 'high' : compositeScore >= 2 ? 'medium' : 'low',
      });
    }

    return anomalies.sort((a, b) => b.score - a.score);
  }

  // ------------------------------------------------------------
  //  КЛАСТЕРИЗАЦИЯ АНОМАЛИЙ (haversine, radius 200 км)
  // ------------------------------------------------------------
  clusterAnomalies() {
    const anomalies = this.detectAnomalies();
    const used = new Set();
    const clusters = [];

    for (let i = 0; i < anomalies.length; i++) {
      if (used.has(i)) continue;
      const seed = anomalies[i];
      const members = [seed];
      used.add(i);

      for (let j = i + 1; j < anomalies.length; j++) {
        if (used.has(j)) continue;
        const other = anomalies[j];
        const dist = haversine(seed.lat, seed.lon, other.lat, other.lon);
        if (dist <= this.clusterRadiusKm) {
          members.push(other);
          used.add(j);
        }
      }

      if (members.length >= 2) {
        const totalEvents = members.reduce((s, m) => s + m.eventCount, 0);
        const avgScore = members.reduce((s, m) => s + m.score, 0) / members.length;
        const centerLat = members.reduce((s, m) => s + m.lat, 0) / members.length;
        const centerLon = members.reduce((s, m) => s + m.lon, 0) / members.length;

        const allTypes = {};
        for (const m of members) {
          for (const [t, cnt] of Object.entries(m.types)) {
            allTypes[t] = (allTypes[t] || 0) + cnt;
          }
        }
        const dominantType = Object.entries(allTypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

        clusters.push({
          clusterId: `cluster_${clusters.length + 1}`,
          lat: centerLat,
          lon: centerLon,
          memberCells: members.length,
          totalEvents,
          avgScore: Math.round(avgScore * 100) / 100,
          dominantType,
          types: allTypes,
          cells: members.map(m => m.cellId),
        });
      }
    }

    return clusters.sort((a, b) => b.avgScore - a.avgScore);
  }

  // ------------------------------------------------------------
  //  АГРЕГАЦИЯ ПО ТИПАМ
  // ------------------------------------------------------------
  byType() {
    const fresh = this.events.filter(e => this._isFresh(e));
    const acc = {};
    for (const e of fresh) {
      if (!acc[e.type]) acc[e.type] = { count: 0, sumSev: 0, uniqueCells: new Set() };
      acc[e.type].count++;
      acc[e.type].sumSev += e.severity;
      acc[e.type].uniqueCells.add(this._cellKey(e.lat, e.lon));
    }
    const out = {};
    for (const [type, a] of Object.entries(acc)) {
      out[type] = {
        count: a.count,
        avgSeverity: Math.round((a.sumSev / a.count) * 1000) / 1000,
        uniqueCells: a.uniqueCells.size,
      };
    }
    return out;
  }

  // ------------------------------------------------------------
  //  АГРЕГАЦИЯ ПО РЕГИОНАМ (6 континентов)
  // ------------------------------------------------------------
  byRegion() {
    const fresh = this.events.filter(e => this._isFresh(e));
    const acc = {};
    for (const e of fresh) {
      const r = this._regionOf(e.lat, e.lon);
      if (!acc[r]) acc[r] = { count: 0, sumSev: 0 };
      acc[r].count++;
      acc[r].sumSev += e.severity;
    }
    const out = {};
    for (const [r, a] of Object.entries(acc)) {
      out[r] = {
        count: a.count,
        avgSeverity: Math.round((a.sumSev / a.count) * 1000) / 1000,
      };
    }
    return out;
  }

  _regionOf(lat, lon) {
    if (lat < -60) return 'Antarctica';
    if (lat >= 15 && lon >= -170 && lon <= -30) return 'Americas';
    if (lat >= 35 && lat <= 72 && lon >= -25 && lon <= 60) return 'Europe';
    if (lat >= -35 && lat <= 37 && lon >= -20 && lon <= 55) return 'Africa';
    if (lat >= -50 && lat <= 0 && lon >= 110 && lon <= 180) return 'Oceania';
    return 'Asia';
  }

  // ------------------------------------------------------------
  //  СТАТИСТИКА
  // ------------------------------------------------------------
  stats() {
    const fresh = this.events.filter(e => this._isFresh(e));
    const baseline = this._baseline();
    return {
      totalEvents: this.events.length,
      freshEvents: fresh.length,
      windowHours: this.windowHours,
      gridSizeKm: this.gridSizeKm,
      clusterRadiusKm: this.clusterRadiusKm,
      minAnomalyScore: this.minAnomalyScore,
      baseline: {
        median: baseline.median,
        mad: Math.round(baseline.mad * 100) / 100,
      },
      now: new Date(this.now).toISOString(),
    };
  }

  clear() {
    this.events = [];
  }
}
