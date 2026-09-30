// infrastructure-military-monitor.mjs v2.0
// Crucix Infrastructure — Layer 3: Military Concentration Monitor
//
// ОБНОВЛЕНО 12.09.2026:
// - Приоритетное чтение военных баз из data/infrastructure/objects.json (25 баз).
// - Fallback на _defaultZones() (8 регионов), если objects.json недоступен.
// - Двойной подход: zones (регионы) + facilities (конкретные базы).
// - Адаптер _adaptFromObjects() преобразует формат.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { haversine } from './infrastructure-graph-core.mjs';
import { TemporalDecay } from './infrastructure-temporal.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OBJECTS_PATH = join(__dirname, '..', '..', 'data', 'infrastructure', 'objects.json');

export class MilitaryConcentration {
  constructor(options = {}) {
    this.temporal = new TemporalDecay(options.temporal || {});
    this.zones = options.zones || this._defaultZones();
    this.alertThresholds = options.alertThresholds || { low: 0.3, moderate: 0.5, high: 0.75, critical: 0.9 };
    this.radiusKm = options.radiusKm ?? 300;

    // Приоритет: options.facilities > objects.json > _defaultFacilities
    if (options.facilities) {
      this.facilities = options.facilities;
      this.facilitiesSource = 'explicit';
    } else {
      const fromObjects = this._loadFromObjects();
      if (fromObjects && fromObjects.length > 0) {
        this.facilities = fromObjects;
        this.facilitiesSource = 'objects.json';
      } else {
        this.facilities = [];
        this.facilitiesSource = 'default';
      }
    }
  }

  /**
   * Читает objects.json, фильтрует military_base, адаптирует формат.
   */
  _loadFromObjects() {
    try {
      if (!existsSync(OBJECTS_PATH)) return null;
      const data = JSON.parse(readFileSync(OBJECTS_PATH, 'utf-8'));
      if (!data.objects || !Array.isArray(data.objects)) return null;
      const bases = data.objects.filter(o => o.type === 'military_base');
      if (bases.length === 0) return null;
      return bases.map(o => this._adaptFromObjects(o));
    } catch (e) {
      console.warn(`[MilitaryMonitor] Не удалось прочитать objects.json: ${e.message}`);
      return null;
    }
  }

  _adaptFromObjects(obj) {
    const lat = obj.coordinates?.lat ?? obj.lat;
    const lng = obj.coordinates?.lng ?? obj.lng;
    const vuln = typeof obj.vulnerability === 'number' ? obj.vulnerability : 5.0;
    const baselineRisk = Math.min(vuln / 10, 1.0);
    return {
      id: obj.id,
      name: obj.name,
      lat,
      lng,
      country: obj.country || 'Unknown',
      status: obj.status,
      statusReason: obj.statusReason,
      operational: obj.operational,
      capacity: obj.capacity,
      unit: obj.unit,
      owner: obj.owner,
      vulnerability: vuln,
      baselineRisk,
      risks: obj.risks || [],
      sanctions: obj.sanctions || false
    };
  }

  /**
   * Основной метод — анализ зон и баз.
   * Возвращает { zones, facilities, summary }.
   */
  analyze(acledEvents, refDate = new Date()) {
    if (!acledEvents || acledEvents.length === 0) {
      return {
        zones: [],
        facilities: this.facilities,
        summary: { totalEvents: 0, maxConcentration: 0, alerts: [], source: this.facilitiesSource }
      };
    }
    const recentEvents = this.temporal.filterRecent(acledEvents, 90, refDate);

    // === Зоны (регионы, старая логика) ===
    const zoneResults = this.zones.map((zone) => {
      const zoneEvents = this._eventsInZone(recentEvents, zone);
      return this._analyzeZone(zone, zoneEvents, refDate);
    });

    // === Базы (новая data-driven логика) ===
    const facilityResults = this.facilities.map((f) => {
      const threat = this.assessThreat(f, recentEvents, refDate);
      // Если есть ACLED события рядом — комбинируем baseline и threat.
      // Если нет — используем baseline (реальная vulnerability из objects.json).
      // Иначе база со status=critical получала бы riskLevel=low.
      const baseScore = threat.threat > 0
        ? f.baselineRisk * 0.4 + threat.threat * 0.6
        : f.baselineRisk;
      const combinedRisk = Math.min(baseScore, 1);
      return {
        ...f,
        threat: threat.threat,
        threatLevel: threat.level,
        nearbyEvents: threat.nearbyEvents || 0,
        totalFatalities: threat.totalFatalities || 0,
        eventTypes: threat.eventTypes || {},
        combinedRisk,
        riskLevel: this._level(combinedRisk)
      };
    }).sort((a, b) => b.combinedRisk - a.combinedRisk);

    const alerts = zoneResults
      .filter((z) => z.concentration >= this.alertThresholds.moderate)
      .sort((a, b) => b.concentration - a.concentration);

    return {
      zones: zoneResults,
      facilities: facilityResults,
      summary: {
        totalEvents: recentEvents.length,
        maxConcentration: Math.max(...zoneResults.map((z) => z.concentration), 0),
        activeZones: zoneResults.filter((z) => z.concentration > 0).length,
        totalBases: facilityResults.length,
        totalBasesWithThreat: facilityResults.filter((f) => f.threat > 0).length,
        alerts,
        source: this.facilitiesSource
      },
    };
  }

  assessThreat(node, acledEvents, refDate = new Date()) {
    if (!node || node.lat == null) return { threat: 0, level: 'none' };
    const recentEvents = this.temporal.filterRecent(acledEvents, 90, refDate);
    const nearby = recentEvents.filter((e) => {
      if (e.lat == null || e.lon == null) return false;
      return haversine(node.lat, node.lng, e.lat, e.lon) <= this.radiusKm;
    });
    if (nearby.length === 0) return { threat: 0, level: 'none', nearbyEvents: 0 };
    const scored = nearby.map((e) => {
      const tw = this.temporal.weight(e.event_date, refDate);
      const fatFactor = Math.min(1 + (e.fatalities || 0) / 100, 2);
      return tw * fatFactor;
    });
    const sum = scored.reduce((a, b) => a + b, 0);
    const max = Math.max(...scored);
    const threat = Math.min((sum * 0.5 + max * 0.5) / 2, 1);
    return {
      threat, level: this._level(threat), nearbyEvents: nearby.length,
      totalFatalities: nearby.reduce((s, e) => s + (e.fatalities || 0), 0),
      eventTypes: this._aggregateTypes(nearby),
    };
  }

  _eventsInZone(events, zone) {
    return events.filter((e) => {
      if (e.lat == null || e.lon == null) return false;
      return haversine(zone.lat, zone.lng, e.lat, e.lon) <= (zone.radiusKm || this.radiusKm);
    });
  }

  _analyzeZone(zone, events, refDate) {
    const scored = events.map((e) => {
      const tw = this.temporal.weight(e.event_date, refDate);
      const fatFactor = Math.min(1 + (e.fatalities || 0) / 50, 2);
      const typeWeight = this._typeWeight(e.event_type);
      return tw * fatFactor * typeWeight;
    });
    const sum = scored.reduce((a, b) => a + b, 0);
    const max = scored.length > 0 ? Math.max(...scored) : 0;
    const concentration = Math.min((sum * 0.6 + max * 0.4) / 3, 1);
    const operators = new Set();
    events.forEach((e) => {
      if (e.actor1) operators.add(e.actor1);
      if (e.actor2) operators.add(e.actor2);
    });
    return {
      zone: zone.name, lat: zone.lat, lng: zone.lng,
      eventCount: events.length,
      totalFatalities: events.reduce((s, e) => s + (e.fatalities || 0), 0),
      concentration, level: this._level(concentration),
      operators: Array.from(operators),
      eventTypes: this._aggregateTypes(events),
    };
  }

  _level(score) {
    if (score >= this.alertThresholds.critical) return 'critical';
    if (score >= this.alertThresholds.high) return 'high';
    if (score >= this.alertThresholds.moderate) return 'moderate';
    if (score >= this.alertThresholds.low) return 'low';
    return 'none';
  }

  _typeWeight(type) {
    const w = {
      'Battle': 1.0, 'Battles': 1.0, 'Armed Clash': 1.0,
      'Violence against civilians': 0.9,
      'Remote violence/Explosions': 0.85,
      'Riots': 0.5, 'Protests': 0.2,
    };
    return w[type] ?? 0.6;
  }

  _aggregateTypes(events) {
    const counts = {};
    events.forEach((e) => {
      const t = e.event_type || 'unknown';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }

  _defaultZones() {
    return [
      { name: 'Eastern Europe', lat: 49.0, lng: 32.0, radiusKm: 800 },
      { name: 'Middle East', lat: 33.0, lng: 44.0, radiusKm: 800 },
      { name: 'East Africa', lat: 9.0, lng: 40.0, radiusKm: 700 },
      { name: 'West Africa', lat: 9.0, lng: -5.0, radiusKm: 600 },
      { name: 'Southeast Asia', lat: 13.0, lng: 105.0, radiusKm: 700 },
      { name: 'South America', lat: -10.0, lng: -65.0, radiusKm: 700 },
      { name: 'Central Asia', lat: 41.0, lng: 70.0, radiusKm: 600 },
      { name: 'Horn of Africa', lat: 8.0, lng: 45.0, radiusKm: 500 },
    ];
  }
}

export default MilitaryConcentration;
