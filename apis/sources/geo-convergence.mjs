// Crucix — GeoConvergence (класс-вычислитель)
// Пространственная конвергенция событий: кластеризация координат,
// поиск горячих точек, радиусы влияния.
//
// Используется анализатором scripts/analyzers/geo-convergence.mjs.

const EARTH_R = 6371;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default class GeoConvergence {
  constructor(opts = {}) {
    this.gridSizeKm = opts.gridSizeKm ?? 100;
    this.minEventsPerCell = opts.minEventsPerCell ?? 2;
    this.events = [];
  }

  add(event) {
    if (event.lat == null || event.lon == null) return false;
    this.events.push({
      lat: event.lat,
      lon: event.lon,
      severity: event.severity ?? 0.5,
      type: event.type || 'unknown',
      timestamp: event.timestamp || Date.now(),
    });
    return true;
  }

  /**
   * Найти горячие точки (ячейки с N+ событий).
   */
  hotspots() {
    const cells = new Map();
    for (const e of this.events) {
      const cellLat = Math.floor(e.lat / (this.gridSizeKm / 111));
      const cellLon = Math.floor(e.lon / (this.gridSizeKm / (111 * Math.cos(e.lat * Math.PI / 180))));
      const key = `${cellLat}_${cellLon}`;
      if (!cells.has(key)) cells.set(key, { lat: 0, lon: 0, count: 0, sumSev: 0, types: {} });
      const c = cells.get(key);
      c.lat += e.lat;
      c.lon += e.lon;
      c.count++;
      c.sumSev += e.severity;
      c.types[e.type] = (c.types[e.type] || 0) + 1;
    }

    const hotspots = [];
    for (const [key, c] of cells) {
      if (c.count < this.minEventsPerCell) continue;
      hotspots.push({
        cellId: key,
        lat: c.lat / c.count,
        lon: c.lon / c.count,
        eventCount: c.count,
        avgSeverity: c.sumSev / c.count,
        convergenceScore: Math.round((c.count * (c.sumSev / c.count)) * 100) / 100,
        dominantType: Object.entries(c.types).sort((a,b) => b[1]-a[1])[0]?.[0] || 'unknown',
        types: c.types,
      });
    }

    return hotspots.sort((a, b) => b.convergenceScore - a.convergenceScore);
  }

  topHotspots(n = 10) {
    return this.hotspots().slice(0, n);
  }

  clear() { this.events = []; }
}
