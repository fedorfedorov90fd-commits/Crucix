// infrastructure-chokepoint-monitor.mjs v2.0
// Crucix Infrastructure — Layer 3: Chokepoint Monitor
//
// ОБНОВЛЕНО 12.09.2026:
// - Приоритетное чтение из data/infrastructure/objects.json (15 чокпоинтов).
// - Fallback на _defaultChokepoints() (8 чокпоинтов), если objects.json недоступен.
// - MERGE: coordinates/country/status/vulnerability из objects.json,
//          dailyVolume/alternatives/historicalDisruptionRate — из _default() по id.
// - Вспомогательный индекс _defaultById для быстрого мэтчинга.

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { haversine } from './infrastructure-graph-core.mjs';
import { TemporalDecay } from './infrastructure-temporal.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OBJECTS_PATH = join(__dirname, '..', '..', 'data', 'infrastructure', 'objects.json');

export class ChokepointMonitor {
  constructor(options = {}) {
    this.temporal = new TemporalDecay(options.temporal || {});

    // Индекс _default по короткому id (без префикса chokepoint-)
    const defaults = this._defaultChokepoints();
    this._defaultById = new Map();
    for (const cp of defaults) {
      this._defaultById.set(cp.id, cp);
    }

    // Приоритет: options.chokepoints > objects.json > _default
    if (options.chokepoints) {
      this.chokepoints = options.chokepoints;
      this.source = 'explicit';
    } else {
      const merged = this._loadFromObjectsMerged();
      if (merged && merged.length > 0) {
        this.chokepoints = merged;
        this.source = 'objects.json+default-merge';
      } else {
        this.chokepoints = defaults;
        this.source = 'default';
      }
    }
  }

  /**
   * Читает objects.json, фильтрует chokepoint, мержит с _default по короткому id.
   */
  _loadFromObjectsMerged() {
    try {
      if (!existsSync(OBJECTS_PATH)) return null;
      const data = JSON.parse(readFileSync(OBJECTS_PATH, 'utf-8'));
      if (!data.objects || !Array.isArray(data.objects)) return null;
      const chokepoints = data.objects.filter(o => o.type === 'chokepoint');
      if (chokepoints.length === 0) return null;
      return chokepoints.map(o => this._mergeChokepoint(o));
    } catch (e) {
      console.warn(`[ChokepointMonitor] Не удалось прочитать objects.json: ${e.message}`);
      return null;
    }
  }

  /**
   * Мержит объект из objects.json с _default по короткому id.
   * Короткий id: chokepoint-hormuz → hormuz.
   */
  _mergeChokepoint(obj) {
    const shortId = obj.id.replace(/^chokepoint-/, '');
    const def = this._defaultById.get(shortId);

    const lat = obj.coordinates?.lat ?? obj.lat;
    const lng = obj.coordinates?.lng ?? obj.lng;

    // baselineRisk — ПРИОРИТЕТ vulnerability из objects.json (0-10 → 0-1),
    // fallback на def.baselineRisk если vuln отсутствует
    const vuln = typeof obj.vulnerability === 'number' ? obj.vulnerability : 0;
    const fromVuln = Math.min(vuln / 10 * 0.8, 0.95);
    const baselineRisk = fromVuln > 0.1 ? fromVuln : (def?.baselineRisk ?? 0.05);

    return {
      // Из objects.json — точные данные
      id: obj.id,
      shortId,
      name: obj.name,
      lat,
      lng,
      country: obj.country || def?.country || 'Unknown',
      status: obj.status,
      statusReason: obj.statusReason,
      vulnerability: vuln,
      risks: obj.risks || [],
      // Из _default — если есть (dailyVolume, alternatives, и т.д.)
      dailyVolume: def?.dailyVolume ?? 10,
      riskRadiusKm: def?.riskRadiusKm ?? 400,
      baselineRisk,
      historicalDisruptionRate: def?.historicalDisruptionRate ?? 0.03,
      alternatives: def?.alternatives ?? [],
    };
  }

  analyze(acledEvents = [], graph = null, refDate = new Date()) {
    return this.chokepoints.map((cp) => {
      const nearbyConflicts = this._nearbyConflicts(cp, acledEvents, refDate);
      const riskScore = this._computeRisk(cp, nearbyConflicts, refDate);
      const nearbyInfrastructure = graph ? this._nearbyInfrastructure(cp, graph) : [];
      return {
        ...cp,
        riskScore,
        riskLevel: this._riskLevel(riskScore),
        nearbyConflicts: nearbyConflicts.length,
        conflictFatalities: nearbyConflicts.reduce((s, e) => s + (e.fatalities || 0), 0),
        disruptionProbability: this._disruptionProbability(cp, riskScore),
        nearbyInfrastructure,
        alternativeRoutes: cp.alternatives || [],
        status: this._status(riskScore, cp),
      };
    });
  }

  assessDisruption(chokepointId, acledEvents = [], graph = null, refDate = new Date()) {
    const cp = this.chokepoints.find((c) => c.id === chokepointId);
    if (!cp) return { error: `Unknown chokepoint: ${chokepointId}` };
    const nearbyConflicts = this._nearbyConflicts(cp, acledEvents, refDate);
    const riskScore = this._computeRisk(cp, nearbyConflicts, refDate);
    const affectedInfra = this._nearbyInfrastructure(cp, graph);
    const trafficImpact = cp.dailyVolume || 0;
    const rerouteCost = cp.alternatives
      ? cp.alternatives.reduce((sum, alt) => sum + (alt.extraDays || 0) * (alt.capacity || 0), 0)
      : 0;
    return {
      chokepoint: cp.name, riskScore, riskLevel: this._riskLevel(riskScore),
      disruptionProbability: this._disruptionProbability(cp, riskScore),
      dailyVolumeAffected: trafficImpact,
      rerouteOptions: cp.alternatives || [],
      estimatedRerouteCost: rerouteCost,
      affectedInfrastructure: affectedInfra,
      recommendation: this._recommendation(riskScore, cp),
    };
  }

  _nearbyConflicts(cp, acledEvents, refDate) {
    if (!acledEvents || acledEvents.length === 0) return [];
    return acledEvents.filter((e) => {
      if (e.lat == null || e.lon == null) return false;
      const dist = haversine(cp.lat, cp.lng, e.lat, e.lon);
      return dist <= (cp.riskRadiusKm || 500);
    });
  }

  _computeRisk(cp, conflicts, refDate) {
    if (conflicts.length === 0) return cp.baselineRisk || 0.05;
    const scored = conflicts.map((e) => {
      const tw = this.temporal.weight(e.event_date, refDate);
      const fatFactor = Math.min(1 + (e.fatalities || 0) / 50, 2);
      return tw * fatFactor;
    });
    const sum = scored.reduce((a, b) => a + b, 0);
    const max = Math.max(...scored);
    const conflictRisk = Math.min((sum * 0.5 + max * 0.5) / 2, 1);
    return Math.min((cp.baselineRisk || 0.05) * 0.3 + conflictRisk * 0.7, 1);
  }

  _disruptionProbability(cp, riskScore) {
    const base = cp.historicalDisruptionRate || 0.02;
    return Math.min(base + riskScore * 0.5, 0.95);
  }

  _riskLevel(score) {
    if (score >= 0.75) return 'critical';
    if (score >= 0.5) return 'high';
    if (score >= 0.25) return 'moderate';
    if (score >= 0.1) return 'low';
    return 'minimal';
  }

  _status(score, cp) {
    if (score >= 0.75) return 'disrupted';
    if (score >= 0.5) return 'high_risk';
    if (score >= 0.25) return 'elevated';
    return 'normal';
  }

  _nearbyInfrastructure(cp, graph) {
    if (!graph || typeof graph.findNearby !== 'function') return [];
    return graph.findNearby(cp.lat, cp.lng, cp.riskRadiusKm || 500).map((n) => ({
      id: n.id, name: n.name, type: n.type,
      distance: haversine(cp.lat, cp.lng, n.lat, n.lng),
    }));
  }

  _recommendation(score, cp) {
    if (score >= 0.75) return `CRITICAL: Reroute all traffic from ${cp.name} immediately`;
    if (score >= 0.5) return `HIGH: Prepare alternative routes for ${cp.name}`;
    if (score >= 0.25) return `ELEVATED: Monitor ${cp.name} closely`;
    return `${cp.name} operating normally`;
  }

  _defaultChokepoints() {
    return [
      { id: 'suez', name: 'Suez Canal', lat: 30.5, lng: 32.3, country: 'Egypt', dailyVolume: 51, riskRadiusKm: 400, baselineRisk: 0.08, historicalDisruptionRate: 0.03, alternatives: [{ route: 'Cape of Good Hope', extraDays: 10, capacity: 90 }] },
      { id: 'hormuz', name: 'Strait of Hormuz', lat: 26.6, lng: 56.3, country: 'Iran/Oman/UAE', dailyVolume: 21, riskRadiusKm: 400, baselineRisk: 0.15, historicalDisruptionRate: 0.05, alternatives: [{ route: 'East Coast Saudi Pipeline', extraDays: 5, capacity: 25 }] },
      { id: 'malacca', name: 'Strait of Malacca', lat: 2.5, lng: 101.3, country: 'Malaysia/Singapore/Indonesia', dailyVolume: 94, riskRadiusKm: 400, baselineRisk: 0.06, historicalDisruptionRate: 0.02, alternatives: [{ route: 'Sunda Strait', extraDays: 3, capacity: 40 }] },
      { id: 'bab-el-mandeb', name: 'Bab el-Mandeb', lat: 12.6, lng: 43.3, country: 'Yemen/Djibouti/Eritrea', dailyVolume: 12, riskRadiusKm: 400, baselineRisk: 0.18, historicalDisruptionRate: 0.06, alternatives: [{ route: 'Cape of Good Hope', extraDays: 7, capacity: 60 }] },
      { id: 'bosporus', name: 'Bosphorus Strait', lat: 41.1, lng: 29.0, country: 'Turkey', dailyVolume: 8, riskRadiusKm: 300, baselineRisk: 0.10, historicalDisruptionRate: 0.04, alternatives: [] },
      { id: 'panama', name: 'Panama Canal', lat: 9.1, lng: -79.7, country: 'Panama', dailyVolume: 38, riskRadiusKm: 400, baselineRisk: 0.05, historicalDisruptionRate: 0.02, alternatives: [{ route: 'Cape Horn', extraDays: 15, capacity: 80 }] },
      { id: 'gibraltar', name: 'Strait of Gibraltar', lat: 35.9, lng: -5.6, country: 'Spain/Morocco/UK', dailyVolume: 30, riskRadiusKm: 400, baselineRisk: 0.04, historicalDisruptionRate: 0.01, alternatives: [] },
      { id: 'taiwan', name: 'Taiwan Strait', lat: 24.5, lng: 119.5, country: 'Taiwan/China', dailyVolume: 40, riskRadiusKm: 400, baselineRisk: 0.12, historicalDisruptionRate: 0.03, alternatives: [{ route: 'East Taiwan Coast', extraDays: 2, capacity: 70 }] },
    ];
  }
}

export default ChokepointMonitor;
