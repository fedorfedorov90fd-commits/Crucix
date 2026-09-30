// infrastructure-nuclear-monitor.mjs v2.0
// Crucix Infrastructure — Layer 3: Nuclear Facility Monitor
//
// ОБНОВЛЕНО 12.09.2026:
// - Приоритетное чтение из data/infrastructure/objects.json (20 АЭС).
// - Fallback на _defaultFacilities() (8 АЭС), если objects.json недоступен.
// - Адаптер _adaptFromObjects() преобразует формат objects.json в формат монитора.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { haversine } from './infrastructure-graph-core.mjs';
import { TemporalDecay } from './infrastructure-temporal.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OBJECTS_PATH = join(__dirname, '..', '..', 'data', 'infrastructure', 'objects.json');

export class NuclearFacilityMonitor {
  constructor(options = {}) {
    this.temporal = new TemporalDecay(options.temporal || {});
    // Приоритет: options.facilities > objects.json > _defaultFacilities()
    if (options.facilities) {
      this.facilities = options.facilities;
      this.source = 'explicit';
    } else {
      const fromObjects = this._loadFromObjects();
      if (fromObjects && fromObjects.length > 0) {
        this.facilities = fromObjects;
        this.source = 'objects.json';
      } else {
        this.facilities = this._defaultFacilities();
        this.source = 'default';
      }
    }
    this.inesLevels = {
      0: { name: 'No significance' }, 1: { name: 'Anomaly' },
      2: { name: 'Incident' }, 3: { name: 'Serious Incident' },
      4: { name: 'Accident with Local Consequences' },
      5: { name: 'Accident with Wider Consequences' },
      6: { name: 'Serious Accident' }, 7: { name: 'Major Accident' },
    };
  }

  /**
   * Читает objects.json и адаптирует АЭС под формат монитора.
   */
  _loadFromObjects() {
    try {
      if (!existsSync(OBJECTS_PATH)) return null;
      const data = JSON.parse(readFileSync(OBJECTS_PATH, 'utf-8'));
      if (!data.objects || !Array.isArray(data.objects)) return null;
      const nuclear = data.objects.filter(o => o.type === 'nuclear_power_plant');
      if (nuclear.length === 0) return null;
      return nuclear.map(o => this._adaptFromObjects(o));
    } catch (e) {
      console.warn(`[NuclearMonitor] Не удалось прочитать objects.json: ${e.message}`);
      return null;
    }
  }

  _adaptFromObjects(obj) {
    const lat = obj.coordinates?.lat ?? obj.lat;
    const lng = obj.coordinates?.lng ?? obj.lng;
    // baselineRisk из vulnerability (0-10 шкала) → 0-1
    const vuln = typeof obj.vulnerability === 'number' ? obj.vulnerability : 5.0;
    const baselineRisk = Math.min(vuln / 10, 1.0);
    return {
      id: obj.id,
      name: obj.name,
      lat,
      lng,
      country: obj.country || 'Unknown',
      reactors: obj.reactors || 4,
      capacityMW: obj.capacity || 0,
      exclusionZoneKm: obj.exclusionZoneKm || 20,
      maxImpactKm: obj.maxImpactKm || 300,
      seismicDesign: obj.seismicDesign || false,
      baselineRisk,
      populationDensity: obj.populationDensity || 100,
      status: obj.status,
      statusReason: obj.statusReason,
      operational: obj.operational,
      risks: obj.risks,
      owner: obj.owner,
    };
  }

  analyze(acledEvents = [], earthquakes = [], refDate = new Date()) {
    return this.facilities.map((facility) => {
      const conflictThreat = this._conflictThreat(facility, acledEvents, refDate);
      const seismicThreat = this._seismicThreat(facility, earthquakes, refDate);
      const overallRisk = this._overallRisk(facility, conflictThreat, seismicThreat);
      const impactRadius = this._impactRadius(facility, overallRisk);
      return {
        ...facility,
        inesLevel: this._inesAssessment(overallRisk),
        conflictThreat, seismicThreat, overallRisk,
        riskLevel: this._riskLevel(overallRisk),
        impactRadiusKm: impactRadius,
        exclusionZoneKm: facility.exclusionZoneKm || 20,
        affectedPopulation: this._estimateAffected(facility, impactRadius),
        recommendations: this._recommendations(overallRisk, facility),
        status: this._status(overallRisk, facility),
      };
    });
  }

  assessFacility(facilityId, acledEvents = [], earthquakes = [], refDate = new Date()) {
    const facility = this.facilities.find((f) => f.id === facilityId);
    if (!facility) return { error: `Unknown facility: ${facilityId}` };
    const conflictThreat = this._conflictThreat(facility, acledEvents, refDate);
    const seismicThreat = this._seismicThreat(facility, earthquakes, refDate);
    const overallRisk = this._overallRisk(facility, conflictThreat, seismicThreat);
    return {
      facility: facility.name,
      location: { lat: facility.lat, lng: facility.lng, country: facility.country },
      reactors: facility.reactors, capacity: facility.capacityMW,
      conflictThreat, seismicThreat, overallRisk,
      inesLevel: this._inesAssessment(overallRisk),
      impactRadiusKm: this._impactRadius(facility, overallRisk),
      recommendations: this._recommendations(overallRisk, facility),
    };
  }

  _conflictThreat(facility, acledEvents, refDate) {
    if (!acledEvents || acledEvents.length === 0) return { score: 0, level: 'none', nearbyEvents: 0 };
    const nearby = acledEvents.filter((e) => {
      if (e.lat == null || e.lon == null) return false;
      return haversine(facility.lat, facility.lng, e.lat, e.lon) <= 200;
    });
    if (nearby.length === 0) return { score: 0, level: 'none', nearbyEvents: 0 };
    const scored = nearby.map((e) => {
      const tw = this.temporal.weight(e.event_date, refDate);
      const dist = haversine(facility.lat, facility.lng, e.lat, e.lon);
      const distFactor = Math.max(0, 1 - dist / 200);
      return tw * distFactor * Math.min(1 + (e.fatalities || 0) / 50, 2);
    });
    const max = Math.max(...scored);
    const sum = scored.reduce((a, b) => a + b, 0);
    const score = Math.min((max * 0.6 + sum * 0.1) / 1.5, 1);
    return {
      score, level: this._riskLevel(score), nearbyEvents: nearby.length,
      totalFatalities: nearby.reduce((s, e) => s + (e.fatalities || 0), 0),
      minDistance: Math.min(...nearby.map((e) => haversine(facility.lat, facility.lng, e.lat, e.lon))),
    };
  }

  _seismicThreat(facility, earthquakes, refDate) {
    if (!earthquakes || earthquakes.length === 0) return { score: 0, level: 'none' };
    const nearby = earthquakes.filter((e) => {
      if (e.lat == null || e.lng == null) return false;
      return haversine(facility.lat, facility.lng, e.lat, e.lng) <= 300;
    });
    if (nearby.length === 0) return { score: 0, level: 'none' };
    const scored = nearby.map((e) => {
      const tw = this.temporal.weight(e.date || e.time, refDate);
      const magFactor = Math.min((e.magnitude || 0) / 9, 1);
      const dist = haversine(facility.lat, facility.lng, e.lat, e.lng);
      const distFactor = Math.max(0, 1 - dist / 300);
      return tw * magFactor * distFactor;
    });
    const max = Math.max(...scored);
    return { score: max, level: this._riskLevel(max), maxMagnitude: Math.max(...nearby.map((e) => e.magnitude || 0)) };
  }

  _overallRisk(facility, conflictThreat, seismicThreat) {
    const designFactor = facility.seismicDesign ? 0.7 : 1.0;
    const baseRisk = facility.baselineRisk || 0.02;
    return Math.min(baseRisk + conflictThreat.score * 0.55 + seismicThreat.score * 0.35 * designFactor, 1);
  }

  _inesAssessment(risk) {
    if (risk >= 0.9) return 7;
    if (risk >= 0.75) return 6;
    if (risk >= 0.6) return 5;
    if (risk >= 0.45) return 4;
    if (risk >= 0.3) return 3;
    if (risk >= 0.15) return 2;
    if (risk >= 0.05) return 1;
    return 0;
  }

  _impactRadius(facility, risk) {
    const base = facility.exclusionZoneKm || 20;
    return Math.round(base + risk * ((facility.maxImpactKm || 300) - base));
  }

  _estimateAffected(facility, radiusKm) {
    const area = Math.PI * radiusKm ** 2;
    const density = facility.populationDensity || 100;
    return Math.round(area * density);
  }

  _riskLevel(score) {
    if (score >= 0.75) return 'critical';
    if (score >= 0.5) return 'high';
    if (score >= 0.25) return 'moderate';
    if (score >= 0.1) return 'low';
    return 'normal';
  }

  _status(risk, facility) {
    if (risk >= 0.75) return 'emergency';
    if (risk >= 0.5) return 'heightened_alert';
    if (risk >= 0.25) return 'monitoring';
    return 'normal';
  }

  _recommendations(risk, facility) {
    const recs = [];
    if (risk >= 0.75) {
      recs.push('Immediate evacuation of exclusion zone');
      recs.push('Activate emergency protocols');
      recs.push('Notify IAEA and neighboring countries');
    } else if (risk >= 0.5) {
      recs.push('Increase security presence');
      recs.push('Prepare emergency response teams');
      recs.push('Review evacuation plans');
    } else if (risk >= 0.25) {
      recs.push('Enhanced monitoring');
      recs.push('Verify backup systems');
    } else {
      recs.push('Routine operations');
    }
    return recs;
  }

  _defaultFacilities() {
    return [
      { id: 'zaporizhzhia', name: 'Запорожская АЭС', lat: 47.51, lng: 34.59, country: 'Ukraine', reactors: 6, capacityMW: 5700, exclusionZoneKm: 30, maxImpactKm: 300, seismicDesign: false, baselineRisk: 0.15, populationDensity: 80 },
      { id: 'fukushima', name: 'Fukushima Daiichi', lat: 37.42, lng: 141.03, country: 'Japan', reactors: 0, capacityMW: 0, exclusionZoneKm: 20, maxImpactKm: 250, seismicDesign: true, baselineRisk: 0.05, populationDensity: 200 },
      { id: 'chernobyl', name: 'Чернобыльская АЭС', lat: 51.39, lng: 30.10, country: 'Ukraine', reactors: 0, capacityMW: 0, exclusionZoneKm: 30, maxImpactKm: 300, seismicDesign: false, baselineRisk: 0.03, populationDensity: 10 },
      { id: 'kudankulam', name: 'Kudankulam NPP', lat: 8.17, lng: 77.71, country: 'India', reactors: 2, capacityMW: 2000, exclusionZoneKm: 16, maxImpactKm: 200, seismicDesign: true, baselineRisk: 0.04, populationDensity: 300 },
      { id: 'bruce', name: 'Bruce NPP', lat: 44.32, lng: -81.59, country: 'Canada', reactors: 8, capacityMW: 7276, exclusionZoneKm: 20, maxImpactKm: 250, seismicDesign: true, baselineRisk: 0.02, populationDensity: 50 },
      { id: 'uljin', name: 'Ulchin NPP', lat: 37.09, lng: 129.41, country: 'South Korea', reactors: 6, capacityMW: 5900, exclusionZoneKm: 20, maxImpactKm: 250, seismicDesign: true, baselineRisk: 0.04, populationDensity: 150 },
      { id: 'palo-verde', name: 'Palo Verde', lat: 33.39, lng: -112.87, country: 'USA', reactors: 3, capacityMW: 3937, exclusionZoneKm: 16, maxImpactKm: 200, seismicDesign: true, baselineRisk: 0.02, populationDensity: 30 },
      { id: 'daya-bay', name: 'Daya Bay NPP', lat: 22.59, lng: 114.54, country: 'China', reactors: 4, capacityMW: 4140, exclusionZoneKm: 20, maxImpactKm: 250, seismicDesign: true, baselineRisk: 0.03, populationDensity: 500 },
    ];
  }
}

export default NuclearFacilityMonitor;
