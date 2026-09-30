// Crucix — RouteExplorer (класс-вычислитель)
// Анализ альтернативных маршрутов для морской торговли.
// Поиск путей в графе портов и проливов, учёт стоимости и времени.

const EARTH_R = 6371;

function haversine(lat1, lon1, lat2, lon2) {
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

export default class RouteExplorer {
  constructor(opts = {}) {
    this.ports = new Map();
    this.chokepoints = new Map();
    this.speedKnots = opts.speedKnots ?? 14;
    this.costPerKm = opts.costPerKm ?? 1.0;
  }

  addPort(p) { if (p.id && p.lat && p.lng) this.ports.set(p.id, p); return this; }
  addChokepoint(c) { if (c.id && c.lat && c.lng) this.chokepoints.set(c.id, c); return this; }

  /**
   * Прямое расстояние между портами (по прямой).
   */
  directRoute(fromId, toId) {
    const from = this.ports.get(fromId);
    const to = this.ports.get(toId);
    if (!from || !to) return null;
    const km = haversine(from.lat, from.lng, to.lat, to.lng);
    const hours = km / (this.speedKnots * 1.852);
    return {
      type: 'direct',
      from: fromId, to: toId,
      distanceKm: Math.round(km),
      durationHours: Math.round(hours),
      costUSD: Math.round(km * this.costPerKm),
      waypoints: [fromId, toId],
    };
  }

  /**
   * Маршрут через промежуточные чокпоинты (например, через Панаму).
   */
  routeVia(fromId, chokepointId, toId) {
    const from = this.ports.get(fromId);
    const chok = this.chokepoints.get(chokepointId);
    const to = this.ports.get(toId);
    if (!from || !chok || !to) return null;

    const km1 = haversine(from.lat, from.lng, chok.lat, chok.lng);
    const km2 = haversine(chok.lat, chok.lng, to.lat, to.lng);
    const totalKm = km1 + km2;
    const hours = totalKm / (this.speedKnots * 1.852);

    // Учёт congestion через чокпоинт
    const congestionDelay = chok.congestionHours || 0;
    const totalHours = hours + congestionDelay;

    return {
      type: 'via-chokepoint',
      from: fromId, to: toId,
      via: chokepointId,
      distanceKm: Math.round(totalKm),
      durationHours: Math.round(totalHours),
      costUSD: Math.round(totalKm * this.costPerKm),
      waypoints: [fromId, chokepointId, toId],
      congestionDelayHours: congestionDelay,
    };
  }

  /**
   * Сравнить варианты: прямой vs через альтернативные чокпоинты.
   */
  compareAlternatives(fromId, toId, chokepointIds = []) {
    const variants = [];
    const direct = this.directRoute(fromId, toId);
    if (direct) variants.push(direct);
    for (const cpId of chokepointIds) {
      const r = this.routeVia(fromId, cpId, toId);
      if (r) variants.push(r);
    }
    variants.sort((a, b) => a.durationHours - b.durationHours);
    return {
      from: fromId, to: toId,
      alternatives: variants,
      fastest: variants[0]?.via || variants[0]?.type || 'direct',
      cheapest: [...variants].sort((a, b) => a.costUSD - b.costUSD)[0]?.via || 'direct',
    };
  }

  listPorts() { return [...this.ports.values()]; }
  listChokepoints() { return [...this.chokepoints.values()]; }
}
