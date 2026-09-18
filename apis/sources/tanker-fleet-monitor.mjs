export default class TankerFleetMonitor {
  constructor() { this.vessels = new Map(); this.anomalies = []; }
  addVessel(v) { this.vessels.set(v.mmsi || v.id, { ...v, added: Date.now() }); return this; }
  detectAnomalies() {
    const out = [];
    for (const v of this.vessels.values()) {
      if (v.dark && v.last_seen_hours > 6) out.push({ mmsi: v.mmsi, type: 'dark_fleet', severity: 'high', reason: `AIS-off ${v.last_seen_hours}h` });
      if (v.route_deviation_km > 500) out.push({ mmsi: v.mmsi, type: 'route_deviation', severity: 'moderate', reason: `Deviation ${v.route_deviation_km}km` });
      if (v.sanctioned) out.push({ mmsi: v.mmsi, type: 'sanctioned_vessel', severity: 'critical' });
      if (v.sts_transfer) out.push({ mmsi: v.mmsi, type: 'sts_transfer', severity: 'high', reason: 'Possible shadow transfer' });
    }
    this.anomalies = out;
    return out;
  }
  getAll() { return [...this.vessels.values()]; }
  topAnomalies(n = 20) { return this.anomalies.slice(0, n); }
}
