export default class SatelliteAnalyzer {
  constructor() { this.tracks = new Map(); this.analyses = []; }
  addTrack(t) { if (!this.tracks.has(t.id)) this.tracks.set(t.id, []); this.tracks.get(t.id).push({ lat: t.lat, lng: t.lng, alt: t.alt, timestamp: t.timestamp || Date.now() }); return this; }
  analyze(trackId) {
    const points = this.tracks.get(trackId);
    if (!points || points.length < 2) return null;
    const first = points[0], last = points[points.length - 1];
    const dtHours = (last.timestamp - first.timestamp) / 3600000;
    const distKm = this._haversine(first.lat, first.lng, last.lat, last.lng);
    return { trackId, points: points.length, distanceKm: Math.round(distKm), durationHours: Math.round(dtHours), avgSpeedKmh: dtHours > 0 ? Math.round(distKm / dtHours) : 0, orbitType: this._classifyOrbit(last.alt) };
  }
  _classifyOrbit(alt) {
    if (alt < 2000) return 'LEO';
    if (alt < 35000) return 'MEO';
    if (alt < 40000) return 'GEO';
    return 'HEO';
  }
  _haversine(lat1, lon1, lat2, lon2) {
    const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  getAll() { return [...this.tracks.keys()].map(id => this.analyze(id)).filter(Boolean); }
}
