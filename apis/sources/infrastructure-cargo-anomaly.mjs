// infrastructure-cargo-anomaly.mjs
// Crucix Infrastructure — Layer 3: Cargo Anomaly Detector

import { haversine } from './infrastructure-graph-core.mjs';

export class CargoAnomalyDetector {
  constructor(options = {}) {
    this.zThreshold = options.zThreshold ?? 2.5;
    this.minSamples = options.minSamples ?? 5;
    this.windowSize = options.windowSize ?? 30;
    this.baselineRoutes = options.baselineRoutes || new Map();
  }

  detect(records) {
    if (!records || records.length === 0) {
      return { anomalies: [], summary: { totalRecords: 0, anomalyCount: 0, anomalyRate: 0 } };
    }
    const byVessel = this._groupByVessel(records);
    const anomalies = [];
    for (const [vesselId, vesselRecords] of byVessel) {
      const speedAnomalies = this._detectSpeedAnomalies(vesselId, vesselRecords);
      const routeAnomalies = this._detectRouteAnomalies(vesselId, vesselRecords);
      const cargoAnomalies = this._detectCargoAnomalies(vesselId, vesselRecords);
      const gapAnomalies = this._detectAISGaps(vesselId, vesselRecords);
      anomalies.push(...speedAnomalies, ...routeAnomalies, ...cargoAnomalies, ...gapAnomalies);
    }
    anomalies.sort((a, b) => b.zScore - a.zScore);
    return {
      anomalies,
      summary: {
        totalRecords: records.length,
        totalVessels: byVessel.size,
        anomalyCount: anomalies.length,
        anomalyRate: records.length > 0 ? anomalies.length / records.length : 0,
        byType: this._countByType(anomalies),
      },
    };
  }

  _detectSpeedAnomalies(vesselId, records) {
    if (records.length < this.minSamples) return [];
    const speeds = records.map((r) => r.speed || 0).filter((s) => s != null);
    if (speeds.length < this.minSamples) return [];
    const mean = this._mean(speeds);
    const std = this._std(speeds);
    if (std === 0) return [];
    const anomalies = [];
    for (const record of records) {
      if (record.speed == null) continue;
      const z = Math.abs((record.speed - mean) / std);
      if (z >= this.zThreshold) {
        anomalies.push({
          vesselId, type: 'speed_anomaly', zScore: z, value: record.speed,
          expected: mean, timestamp: record.timestamp, lat: record.lat, lng: record.lng,
          severity: this._severity(z),
          description: `Speed ${record.speed.toFixed(1)} kn (expected ${mean.toFixed(1)} ± ${std.toFixed(1)})`,
        });
      }
    }
    return anomalies;
  }

  _detectRouteAnomalies(vesselId, records) {
    if (records.length < this.minSamples) return [];
    const baseline = this.baselineRoutes.get(vesselId);
    if (!baseline || !baseline.waypoints || baseline.waypoints.length === 0) return [];
    const anomalies = [];
    for (const record of records) {
      if (record.lat == null || record.lng == null) continue;
      const minDist = Math.min(
        ...baseline.waypoints.map((wp) => haversine(record.lat, record.lng, wp.lat, wp.lng))
      );
      const expectedDist = baseline.maxDeviationKm || 50;
      if (minDist > expectedDist) {
        const z = minDist / expectedDist;
        anomalies.push({
          vesselId, type: 'route_deviation', zScore: z, value: minDist,
          expected: expectedDist, timestamp: record.timestamp,
          lat: record.lat, lng: record.lng, severity: this._severity(z),
          description: `Route deviation ${minDist.toFixed(0)} km (max ${expectedDist} km)`,
        });
      }
    }
    return anomalies;
  }

  _detectCargoAnomalies(vesselId, records) {
    if (records.length < this.minSamples) return [];
    const weights = records.map((r) => r.cargoWeight).filter((w) => w != null);
    if (weights.length < this.minSamples) return [];
    const mean = this._mean(weights);
    const std = this._std(weights);
    if (std === 0) return [];
    const anomalies = [];
    for (const record of records) {
      if (record.cargoWeight == null) continue;
      const z = Math.abs((record.cargoWeight - mean) / std);
      if (z >= this.zThreshold) {
        anomalies.push({
          vesselId, type: 'cargo_anomaly', zScore: z, value: record.cargoWeight,
          expected: mean, timestamp: record.timestamp, severity: this._severity(z),
          description: `Cargo weight ${record.cargoWeight} (expected ${mean.toFixed(0)} ± ${std.toFixed(0)})`,
        });
      }
    }
    return anomalies;
  }

  _detectAISGaps(vesselId, records) {
    if (records.length < 2) return [];
    const sorted = [...records].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const anomalies = [];
    const expectedInterval = 600;
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].timestamp);
      const curr = new Date(sorted[i].timestamp);
      const gap = (curr - prev) / 1000;
      if (gap > expectedInterval * 6) {
        const z = gap / (expectedInterval * 6);
        anomalies.push({
          vesselId, type: 'ais_gap', zScore: z, value: gap,
          expected: expectedInterval, timestamp: sorted[i].timestamp,
          severity: this._severity(z),
          description: `AIS gap of ${(gap / 3600).toFixed(1)} hours`,
        });
      }
    }
    return anomalies;
  }

  _groupByVessel(records) {
    const groups = new Map();
    for (const r of records) {
      if (!r.vesselId) continue;
      if (!groups.has(r.vesselId)) groups.set(r.vesselId, []);
      groups.get(r.vesselId).push(r);
    }
    return groups;
  }

  _severity(z) {
    if (z >= 4) return 'critical';
    if (z >= 3) return 'high';
    if (z >= 2.5) return 'moderate';
    return 'low';
  }

  _mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
  _std(arr) {
    if (arr.length < 2) return 0;
    const m = this._mean(arr);
    return Math.sqrt(arr.reduce((sum, x) => sum + (x - m) ** 2, 0) / arr.length);
  }

  _countByType(anomalies) {
    const counts = {};
    anomalies.forEach((a) => { counts[a.type] = (counts[a.type] || 0) + 1; });
    return counts;
  }

  setBaseline(vesselId, route) { this.baselineRoutes.set(vesselId, route); }

  trainBaseline(vesselId, historicalRecords) {
    if (!historicalRecords || historicalRecords.length < this.minSamples) return;
    const waypoints = historicalRecords.filter((r) => r.lat != null && r.lng != null).map((r) => ({ lat: r.lat, lng: r.lng }));
    if (waypoints.length === 0) return;
    const deviations = [];
    for (let i = 1; i < waypoints.length; i++) {
      deviations.push(haversine(waypoints[i - 1].lat, waypoints[i - 1].lng, waypoints[i].lat, waypoints[i].lng));
    }
    const maxDev = Math.max(...deviations, 50);
    this.setBaseline(vesselId, { waypoints, maxDeviationKm: maxDev * 1.5, sampleCount: historicalRecords.length });
  }
}
