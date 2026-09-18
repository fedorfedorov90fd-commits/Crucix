// ═══════════════════════════════════════════════════════════════
//  CRUCIX ENTITY MODEL ENGINE v1.0.0
//  Схемы сущностей, валидация, живые досье, оценка риска.
//  Работает поверх EntityGraph. Читает данные только из графа.
//  Никаких fetch(). Слово "ontology" не используется.
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';
import { NODE_TYPES, EDGE_TYPES } from './entity-graph-engine.mjs';

// ─── Базовые схемы сущностей ──────────────────────────────────
// Каждая схема: required (обязательные поля), properties (типы, enum, min/max).
export const ENTITY_SCHEMAS = Object.freeze({

  [NODE_TYPES.COUNTRY]: {
    type: NODE_TYPES.COUNTRY,
    required: ['label'],
    properties: {
      label:            { type: 'string' },
      isoCode:          { type: 'string', pattern: '^[A-Z]{2}$' },
      isoCode3:         { type: 'string', pattern: '^[A-Z]{3}$' },
      region:           { type: 'string' },
      population:       { type: 'number', min: 0 },
      gdpUsd:           { type: 'number', min: 0 },
      instabilityIndex: { type: 'number', min: 0, max: 100 },
      resilienceIndex:  { type: 'number', min: 0, max: 100 },
      capital:          { type: 'string' },
    },
  },

  [NODE_TYPES.ORGANIZATION]: {
    type: NODE_TYPES.ORGANIZATION,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      orgType:     { type: 'string', enum: ['military', 'government', 'commercial', 'ngo', 'criminal', 'terrorist', 'international'] },
      country:     { type: 'string' },
      founded:     { type: 'string', pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$' },
      employees:   { type: 'number', min: 0 },
      revenueUsd:  { type: 'number' },
      parentOrgId: { type: 'string' },
    },
  },

  [NODE_TYPES.PERSON]: {
    type: NODE_TYPES.PERSON,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      title:       { type: 'string' },
      country:     { type: 'string' },
      birthDate:   { type: 'string', pattern: '^\\d{4}(-\\d{2}(-\\d{2})?)?$' },
      nationality: { type: 'string' },
      role:        { type: 'string', enum: ['leader', 'official', 'military', 'operative', 'civilian', 'analyst', 'unknown'] },
      affiliations: { type: 'array' },
    },
  },

  [NODE_TYPES.VESSEL]: {
    type: NODE_TYPES.VESSEL,
    required: ['label'],
    properties: {
      label:      { type: 'string' },
      imo:        { type: 'number', min: 1000000, max: 9999999 },
      mmsi:       { type: 'number', min: 0, max: 999999999 },
      flag:       { type: 'string' },
      vesselType: { type: 'string', enum: ['tanker', 'cargo', 'bulk', 'container', 'fishing', 'naval', 'passenger', 'other'] },
      dwt:        { type: 'number', min: 0 },
      built:      { type: 'number', min: 1900, max: 2100 },
      sanctioned: { type: 'boolean' },
      darkFleet:  { type: 'boolean' },
    },
  },

  [NODE_TYPES.AIRCRAFT]: {
    type: NODE_TYPES.AIRCRAFT,
    required: ['label'],
    properties: {
      label:        { type: 'string' },
      icao24:       { type: 'string', pattern: '^[0-9a-fA-F]{6}$' },
      registration: { type: 'string' },
      aircraftType: { type: 'string', enum: ['military', 'commercial', 'private', 'cargo', 'government', 'other'] },
      operator:     { type: 'string' },
      origin:       { type: 'string' },
      destination:  { type: 'string' },
    },
  },

  [NODE_TYPES.EVENT]: {
    type: NODE_TYPES.EVENT,
    required: ['label'],
    properties: {
      label:      { type: 'string' },
      eventType:  { type: 'string', enum: ['conflict', 'disaster', 'protest', 'diplomatic', 'military', 'cyber', 'economic', 'health', 'environmental', 'other'] },
      severity:   { type: 'number', min: 0, max: 100 },
      fatalities: { type: 'number', min: 0 },
      timestamp:  { type: 'string' },
      country:    { type: 'string' },
      source:     { type: 'string' },
    },
  },

  [NODE_TYPES.FACILITY]: {
    type: NODE_TYPES.FACILITY,
    required: ['label'],
    properties: {
      label:        { type: 'string' },
      facilityType: { type: 'string', enum: ['military', 'industrial', 'energy', 'telecom', 'transport', 'nuclear', 'water', 'medical', 'other'] },
      country:      { type: 'string' },
      capacity:     { type: 'number', min: 0 },
      status:       { type: 'string', enum: ['active', 'damaged', 'destroyed', 'under_construction', 'decommissioned', 'unknown'] },
    },
  },

  [NODE_TYPES.INFRASTRUCTURE]: {
    type: NODE_TYPES.INFRASTRUCTURE,
    required: ['label'],
    properties: {
      label:     { type: 'string' },
      infraType: { type: 'string', enum: ['pipeline', 'cable', 'power_line', 'rail', 'road', 'port', 'airport', 'datacenter', 'satellite_ground', 'other'] },
      length:    { type: 'number', min: 0 },
      operator:  { type: 'string' },
      criticality: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
    },
  },

  [NODE_TYPES.SANCTION]: {
    type: NODE_TYPES.SANCTION,
    required: ['label'],
    properties: {
      label:      { type: 'string' },
      program:    { type: 'string' },
      authority:  { type: 'string', enum: ['OFAC', 'EU', 'UN', 'UK', 'other'] },
      date:       { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      targetId:   { type: 'string' },
      reason:     { type: 'string' },
    },
  },

  [NODE_TYPES.CRYPTO_WALLET]: {
    type: NODE_TYPES.CRYPTO_WALLET,
    required: ['label'],
    properties: {
      label:      { type: 'string' },
      chain:      { type: 'string', enum: ['btc', 'eth', 'tron', 'usdt', 'other'] },
      balance:    { type: 'number' },
      txCount:    { type: 'number', min: 0 },
      sanctioned: { type: 'boolean' },
      clusterId:  { type: 'string' },
    },
  },

  [NODE_TYPES.IP_ADDRESS]: {
    type: NODE_TYPES.IP_ADDRESS,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      asn:         { type: 'number' },
      country:     { type: 'string' },
      isp:         { type: 'string' },
      isTor:       { type: 'boolean' },
      isVpn:       { type: 'boolean' },
      isHosting:   { type: 'boolean' },
      reputation:  { type: 'string', enum: ['clean', 'neutral', 'suspicious', 'malicious'] },
    },
  },

  [NODE_TYPES.DOMAIN]: {
    type: NODE_TYPES.DOMAIN,
    required: ['label'],
    properties: {
      label:          { type: 'string' },
      registrar:      { type: 'string' },
      registrationDate: { type: 'string' },
      expirationDate: { type: 'string' },
      nameservers:    { type: 'array' },
      privacy:        { type: 'boolean' },
    },
  },

  [NODE_TYPES.APT]: {
    type: NODE_TYPES.APT,
    required: ['label'],
    properties: {
      label:        { type: 'string' },
      aliases:      { type: 'array' },
      sponsor:      { type: 'string' },
      targets:      { type: 'array' },
      ttps:         { type: 'array' },
      firstSeen:    { type: 'string' },
    },
  },

  [NODE_TYPES.CVE]: {
    type: NODE_TYPES.CVE,
    required: ['label'],
    properties: {
      label:       { type: 'string', pattern: '^CVE-\\d{4}-\\d{4,}$' },
      cvss:        { type: 'number', min: 0, max: 10 },
      severity:    { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
      exploited:   { type: 'boolean' },
      published:   { type: 'string' },
      description: { type: 'string' },
    },
  },

  [NODE_TYPES.MALWARE]: {
    type: NODE_TYPES.MALWARE,
    required: ['label'],
    properties: {
      label:      { type: 'string' },
      family:     { type: 'string' },
      type:       { type: 'string', enum: ['ransomware', 'trojan', 'worm', 'rootkit', 'backdoor', 'downloader', 'other'] },
      firstSeen:  { type: 'string' },
      targets:    { type: 'array' },
    },
  },

  [NODE_TYPES.MEDIA]: {
    type: NODE_TYPES.MEDIA,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      mediaType:   { type: 'string', enum: ['news', 'social', 'blog', 'official', 'leak', 'other'] },
      country:     { type: 'string' },
      credibility: { type: 'number', min: 0, max: 100 },
      bias:        { type: 'string' },
    },
  },

  [NODE_TYPES.DOCUMENT]: {
    type: NODE_TYPES.DOCUMENT,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      docType:     { type: 'string', enum: ['report', 'leak', 'treaty', 'order', 'analysis', 'intelligence', 'other'] },
      classification: { type: 'string', enum: ['unclassified', 'restricted', 'confidential', 'secret', 'top_secret'] },
      issuedBy:    { type: 'string' },
      issuedDate:  { type: 'string' },
    },
  },

  [NODE_TYPES.WEAPON]: {
    type: NODE_TYPES.WEAPON,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      weaponType:  { type: 'string', enum: ['missile', 'aircraft', 'tank', 'artillery', 'naval', 'nuclear', 'cyber', 'space', 'other'] },
      rangeKm:     { type: 'number', min: 0 },
      country:     { type: 'string' },
      inService:   { type: 'boolean' },
    },
  },

  [NODE_TYPES.UNIT]: {
    type: NODE_TYPES.UNIT,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      unitType:    { type: 'string', enum: ['brigade', 'division', 'corps', 'fleet', 'squadron', 'battalion', 'regiment', 'other'] },
      branch:      { type: 'string', enum: ['army', 'navy', 'airforce', 'marine', 'space', 'cyber', 'other'] },
      country:     { type: 'string' },
      strength:    { type: 'number', min: 0 },
      headquarters: { type: 'string' },
    },
  },

  [NODE_TYPES.SATELLITE]: {
    type: NODE_TYPES.SATELLITE,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      noradId:     { type: 'number' },
      operator:    { type: 'string' },
      purpose:     { type: 'string', enum: ['communication', 'reconnaissance', 'navigation', 'weather', 'science', 'military', 'other'] },
      orbitType:   { type: 'string', enum: ['LEO', 'MEO', 'GEO', 'HEO', 'SSO', 'other'] },
    },
  },

  [NODE_TYPES.SENSOR]: {
    type: NODE_TYPES.SENSOR,
    required: ['label'],
    properties: {
      label:        { type: 'string' },
      sensorType:   { type: 'string', enum: ['seismic', 'acoustic', 'radiation', 'radar', 'optical', 'infrared', 'other'] },
      operator:     { type: 'string' },
      status:       { type: 'string', enum: ['online', 'offline', 'degraded', 'unknown'] },
    },
  },

  [NODE_TYPES.LOCATION]: {
    type: NODE_TYPES.LOCATION,
    required: ['label', 'lat', 'lon'],
    properties: {
      label:        { type: 'string' },
      lat:          { type: 'number', min: -90, max: 90 },
      lon:          { type: 'number', min: -180, max: 180 },
      country:      { type: 'string' },
      region:       { type: 'string' },
      locationType: { type: 'string', enum: ['city', 'base', 'port', 'airport', 'border', 'capital', 'landmark', 'other'] },
    },
  },

  [NODE_TYPES.VEHICLE]: {
    type: NODE_TYPES.VEHICLE,
    required: ['label'],
    properties: {
      label:       { type: 'string' },
      vehicleType: { type: 'string', enum: ['car', 'truck', 'apc', 'tank', 'artillery', 'other'] },
      country:     { type: 'string' },
      operator:    { type: 'string' },
    },
  },

  [NODE_TYPES.OBSERVATION]: {
    type: NODE_TYPES.OBSERVATION,
    required: ['label'],
    properties: {
      label:      { type: 'string' },
      source:     { type: 'string' },
      confidence: { type: 'number', min: 0, max: 1 },
      timestamp:  { type: 'string' },
    },
  },

});

// ─── Допустимые связи между типами ────────────────────────────
// Используется для подсказок при добавлении рёбер.
const VALID_EDGE_MAP = Object.freeze({
  [`${NODE_TYPES.PERSON}_${NODE_TYPES.ORGANIZATION}`]:      [EDGE_TYPES.MEMBER_OF, EDGE_TYPES.AFFILIATED_WITH, EDGE_TYPES.CONTROLS],
  [`${NODE_TYPES.ORGANIZATION}_${NODE_TYPES.ORGANIZATION}`]:[EDGE_TYPES.OWNS, EDGE_TYPES.CONTROLS, EDGE_TYPES.SUPPLIES, EDGE_TYPES.PARENT_OF],
  [`${NODE_TYPES.ORGANIZATION}_${NODE_TYPES.COUNTRY}`]:     [EDGE_TYPES.LOCATED_IN, EDGE_TYPES.SANCTIONED_BY],
  [`${NODE_TYPES.VESSEL}_${NODE_TYPES.SANCTION}`]:          [EDGE_TYPES.SANCTIONED_BY],
  [`${NODE_TYPES.VESSEL}_${NODE_TYPES.COUNTRY}`]:           [EDGE_TYPES.LOCATED_IN, EDGE_TYPES.ROUTES_THROUGH],
  [`${NODE_TYPES.COUNTRY}_${NODE_TYPES.COUNTRY}`]:          [EDGE_TYPES.ALLIED_WITH, EDGE_TYPES.CONFLICTS_WITH, EDGE_TYPES.TRADES_WITH],
  [`${NODE_TYPES.EVENT}_${NODE_TYPES.LOCATION}`]:           [EDGE_TYPES.LOCATED_IN, EDGE_TYPES.OBSERVED_AT],
  [`${NODE_TYPES.EVENT}_${NODE_TYPES.COUNTRY}`]:            [EDGE_TYPES.LOCATED_IN],
  [`${NODE_TYPES.IP_ADDRESS}_${NODE_TYPES.COUNTRY}`]:       [EDGE_TYPES.LOCATED_IN],
  [`${NODE_TYPES.CVE}_${NODE_TYPES.MALWARE}`]:              [EDGE_TYPES.ATTACKS, EDGE_TYPES.DERIVED_FROM],
  [`${NODE_TYPES.APT}_${NODE_TYPES.MALWARE}`]:              [EDGE_TYPES.OWNS, EDGE_TYPES.OPERATES],
  [`${NODE_TYPES.APT}_${NODE_TYPES.COUNTRY}`]:              [EDGE_TYPES.AFFILIATED_WITH, EDGE_TYPES.LOCATED_IN],
  [`${NODE_TYPES.CRYPTO_WALLET}_${NODE_TYPES.SANCTION}`]:   [EDGE_TYPES.SANCTIONED_BY],
  [`${NODE_TYPES.CRYPTO_WALLET}_${NODE_TYPES.CRYPTO_WALLET}`]: [EDGE_TYPES.TRANSFERRED_FUNDS],
});

// ─── Главный класс ────────────────────────────────────────────
export class EntityModelEngine extends EventEmitter {
  constructor(graph) {
    super();
    if (!graph) throw new Error('EntityModelEngine требует EntityGraph');
    this.graph = graph;
    this.schemas = new Map(Object.entries(ENTITY_SCHEMAS));
  }

  // ── Схемы ──────────────────────────────────────────────────
  getSchema(type) {
    return this.schemas.get(type) || null;
  }

  getAllSchemas() {
    return [...this.schemas.values()];
  }

  addSchema(type, schema) {
    if (!type || !schema) return false;
    this.schemas.set(type, { ...schema, type });
    this.emit('schema:added', type);
    return true;
  }

  getTypes() {
    return [...this.schemas.keys()];
  }

  getValidEdgeTypes(fromType, toType) {
    const key = `${fromType}_${toType}`;
    return VALID_EDGE_MAP[key] || [];
  }

  // ── Валидация ──────────────────────────────────────────────
  validate(type, data) {
    const schema = this.schemas.get(type);
    if (!schema) {
      return { valid: false, errors: [`Неизвестный тип сущности: ${type}`] };
    }
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Данные должны быть объектом'] };
    }
    const errors = [];

    // Обязательные поля
    for (const field of (schema.required || [])) {
      const v = data[field];
      if (v === undefined || v === null || v === '') {
        errors.push(`Отсутствует обязательное поле: ${field}`);
      }
    }

    // Проверка типов свойств
    for (const [field, prop] of Object.entries(schema.properties || {})) {
      const v = data[field];
      if (v === undefined || v === null) continue;

      if (prop.type === 'string') {
        if (typeof v !== 'string') {
          errors.push(`${field}: ожидалась строка, получено ${typeof v}`);
          continue;
        }
        if (prop.pattern) {
          const re = new RegExp(prop.pattern);
          if (!re.test(v)) errors.push(`${field}: значение "${v}" не соответствует шаблону ${prop.pattern}`);
        }
        if (prop.enum && !prop.enum.includes(v)) {
          errors.push(`${field}: значение "${v}" не входит в допустимые [${prop.enum.join(', ')}]`);
        }
      } else if (prop.type === 'number') {
        if (typeof v !== 'number' || Number.isNaN(v)) {
          errors.push(`${field}: ожидалось число, получено ${typeof v}`);
          continue;
        }
        if (prop.min !== undefined && v < prop.min) errors.push(`${field}: ${v} меньше минимума ${prop.min}`);
        if (prop.max !== undefined && v > prop.max) errors.push(`${field}: ${v} больше максимума ${prop.max}`);
      } else if (prop.type === 'boolean') {
        if (typeof v !== 'boolean') errors.push(`${field}: ожидалось булево, получено ${typeof v}`);
      } else if (prop.type === 'array') {
        if (!Array.isArray(v)) errors.push(`${field}: ожидался массив`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Валидация и добавление в граф одной операцией
  createNode(type, data) {
    const v = this.validate(type, data);
    if (!v.valid) return { error: v.errors };
    const node = this.graph.addNode({ ...data, type });
    return { node: node.toJSON() };
  }

  // ── Живое досье ────────────────────────────────────────────
  buildDossier(nodeId) {
    const node = this.graph.getNode(nodeId);
    if (!node) return null;

    const neighbors = this.graph.getNeighbors(nodeId, 2);
    const edges = this.graph.getEdgesOf(nodeId);
    const degree = this.graph.getDegree(nodeId);
    const credibilityInfo = this.graph.aggregateCredibility(nodeId);

    // Группировка соседей по типу узла
    const byType = {};
    for (const n of neighbors) {
      if (!n.node) continue;
      const t = n.node.type || 'unknown';
      if (!byType[t]) byType[t] = [];
      byType[t].push({
        id: n.node.id,
        label: n.node.label,
        edgeType: n.edge?.type || null,
        credibility: n.node.credibility,
        riskScore: n.node.riskScore,
        depth: n.depth,
      });
    }

    // Хронология наблюдений
    const timeline = [...(node.observations || [])]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 30);

    // Оценка риска
    const risk = this.assessRisk(nodeId);

    // Источники
    const sources = new Set(node.sources || []);
    for (const e of edges) for (const s of (e.sources || [])) sources.add(s);

    const dossier = {
      id: node.id,
      type: node.type,
      label: node.label,
      aliases: node.aliases,
      description: node.description,
      location: (Number.isFinite(node.lat) && Number.isFinite(node.lon))
        ? { lat: node.lat, lon: node.lon }
        : null,
      country: node.country,
      tags: node.tags,
      credibility: node.credibility,
      credibilityAggregate: credibilityInfo,
      riskScore: risk.score,
      riskLevel: risk.level,
      riskFactors: risk.factors,
      degree,
      connections: {
        total: neighbors.length,
        byType,
      },
      timeline,
      sources: [...sources],
      properties: node.properties,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      generatedAt: new Date().toISOString(),
    };

    this.emit('dossier:built', { nodeId, dossier });
    return dossier;
  }

  // ── Оценка риска узла ──────────────────────────────────────
  assessRisk(nodeId) {
    const node = this.graph.getNode(nodeId);
    if (!node) return { score: 0, level: 'unknown', factors: [] };

    let score = Number(node.riskScore) || 0;
    const factors = [];

    // Базовый риск по типу
    const typeBase = {
      [NODE_TYPES.APT]: 40,
      [NODE_TYPES.SANCTION]: 50,
      [NODE_TYPES.MALWARE]: 30,
      [NODE_TYPES.CVE]: 20,
      [NODE_TYPES.WEAPON]: 25,
      [NODE_TYPES.UNIT]: 20,
      [NODE_TYPES.VESSEL]: 10,
      [NODE_TYPES.AIRCRAFT]: 10,
    }[node.type] || 0;
    if (typeBase) {
      score += typeBase;
      factors.push(`База для типа ${node.type}: +${typeBase}`);
    }

    // Санкционные связи
    const edges = this.graph.getEdgesOf(nodeId);
    const sanctionedEdges = edges.filter(e =>
      e.type === EDGE_TYPES.SANCTIONED_BY || e.type === EDGE_TYPES.SANCTIONS
    );
    if (sanctionedEdges.length > 0) {
      const add = Math.min(30, sanctionedEdges.length * 10);
      score += add;
      factors.push(`Санкционные связи: ${sanctionedEdges.length} (+${add})`);
    }

    // Конфликтные связи
    const conflictEdges = edges.filter(e =>
      e.type === EDGE_TYPES.CONFLICTS_WITH || e.type === EDGE_TYPES.ATTACKS || e.type === EDGE_TYPES.ATTACKED_BY
    );
    if (conflictEdges.length > 0) {
      const add = Math.min(25, conflictEdges.length * 8);
      score += add;
      factors.push(`Конфликтные связи: ${conflictEdges.length} (+${add})`);
    }

    // Низкая достоверность
    if (node.credibility < 30) {
      score += 15;
      factors.push('Низкая достоверность источника (+15)');
    }

    // Кибер-сущности с большим числом открытых портов
    if (node.type === NODE_TYPES.IP_ADDRESS || node.type === NODE_TYPES.DOMAIN) {
      const ports = node.properties?.openPorts;
      if (Array.isArray(ports) && ports.length > 5) {
        score += 10;
        factors.push(`Открытых портов: ${ports.length} (+10)`);
      }
      if (node.properties?.isTor) {
        score += 20;
        factors.push('Tor-узел (+20)');
      }
      if (node.properties?.reputation === 'malicious') {
        score += 25;
        factors.push('Репутация: malicious (+25)');
      }
    }

    // Dark fleet флаг
    if (node.properties?.darkFleet) {
      score += 30;
      factors.push('Флаг тёмного флота (+30)');
    }

    score = Math.max(0, Math.min(100, score));
    const level = score >= 75 ? 'CRITICAL'
                : score >= 50 ? 'HIGH'
                : score >= 25 ? 'ELEVATED'
                : 'LOW';

    return { score, level, factors };
  }

  // ── Массовая генерация досье по типу ───────────────────────
  buildDossiersByType(type, { limit = 50, minRisk = 0 } = {}) {
    const results = [];
    for (const node of this.graph.nodes.values()) {
      if (node.type !== type) continue;
      const risk = this.assessRisk(node.id);
      if (risk.score < minRisk) continue;
      const dossier = this.buildDossier(node.id);
      if (dossier) results.push(dossier);
      if (results.length >= limit) break;
    }
    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  // ── Промпт для LLM из досье ────────────────────────────────
  buildDossierPrompt(nodeId) {
    const dossier = this.buildDossier(nodeId);
    if (!dossier) return null;

    const lines = [
      `ДОСЬЕ СУЩНОСТИ: ${dossier.label}`,
      `Тип: ${dossier.type}`,
      `ID: ${dossier.id}`,
      `Достоверность: ${dossier.credibility}/100`,
      `Агрегированная достоверность: ${dossier.credibilityAggregate?.aggregated ?? dossier.credibility}/100 (источников: ${dossier.credibilityAggregate?.uniqueSources ?? 0})`,
      `Риск: ${dossier.riskScore}/100 (${dossier.riskLevel})`,
      `Степень в графе: ${dossier.degree?.total ?? 0} связей`,
      '',
    ];

    if (dossier.description) lines.push(`Описание: ${dossier.description}`, '');
    if (dossier.country) lines.push(`Страна: ${dossier.country}`, '');
    if (dossier.aliases?.length) lines.push(`Псевдонимы: ${dossier.aliases.join(', ')}`, '');
    if (dossier.tags?.length) lines.push(`Теги: ${dossier.tags.join(', ')}`, '');

    if (dossier.riskFactors?.length) {
      lines.push('ФАКТОРЫ РИСКА:');
      for (const f of dossier.riskFactors) lines.push(`  - ${f}`);
      lines.push('');
    }

    if (dossier.connections.total > 0) {
      lines.push(`СВЯЗИ (${dossier.connections.total}):`);
      for (const [type, list] of Object.entries(dossier.connections.byType)) {
        lines.push(`  ${type} (${list.length}):`);
        for (const c of list.slice(0, 5)) {
          lines.push(`    - ${c.label} [${c.edgeType || '—'}] (дост. ${c.credibility}, риск ${c.riskScore})`);
        }
      }
      lines.push('');
    }

    if (dossier.timeline?.length) {
      lines.push(`ХРОНОЛОГИЯ (${dossier.timeline.length}):`);
      for (const t of dossier.timeline.slice(0, 10)) {
        lines.push(`  ${t.timestamp} [${t.source}] ${t.type}`);
      }
      lines.push('');
    }

    if (dossier.sources?.length) {
      lines.push(`ИСТОЧНИКИ: ${dossier.sources.join(', ')}`);
    }

    return {
      system: 'Ты аналитик разведки. Проанализируй досье сущности. Выдели ключевые связи, риски и потенциальные угрозы. Отвечай структурированно, кратко, по существу.',
      prompt: lines.join('\n'),
    };
  }

  // ── Статистика по схемам ───────────────────────────────────
  getStats() {
    const byType = {};
    for (const node of this.graph.nodes.values()) {
      byType[node.type] = (byType[node.type] || 0) + 1;
    }
    const typesWithNodes = Object.keys(byType).length;
    const typesWithoutNodes = [...this.schemas.keys()].filter(t => !byType[t]);
    return {
      schemas: this.schemas.size,
      typesWithNodes,
      typesWithoutNodes,
      nodesByType: byType,
    };
  }
}

// ─── Фабрика ───────────────────────────────────────────────────
let _instance = null;

export function getEntityModelEngine(graph) {
  if (!_instance) {
    if (!graph) throw new Error('Первый вызов getEntityModelEngine требует EntityGraph');
    _instance = new EntityModelEngine(graph);
  }
  return _instance;
}

export function resetEntityModelEngine() {
  _instance = null;
}
