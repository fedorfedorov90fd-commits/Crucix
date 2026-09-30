// apis/knowledge/graph.mjs
// Граф знаний Crucix (knowledge graph). Синтез из knowledge/graph.mjs и entity_model/graph.mjs.
//
// Теоретическая основа:
//   Hogan, A. et al. (2021). "Knowledge Graphs". ACM Computing Surveys,
//   54(4), 1-37.
//   Ji, S., Pan, S., Cambria, E., Marttinen, P., & Yu, P. S. (2021).
//   "A Survey on Knowledge Graphs". IEEE TNNLS, 33(2), 494-514.
//
// Назначение:
//   Постоянный граф сущностей и связей, извлекаемых из каждого sweep.
//   Используется для обнаружения скрытых связей, BFS-путей между событиями,
//   поиска мостов между кластерами.
//
// Синтез: объединяет функционал knowledge/graph.mjs и entity_model/graph.mjs.
//   Из knowledge: проверки addEntity/addRelation, findPath с проверкой, stats() метод.
//   Из entity_model: Timestamp в OCCURRED_AT, actors → CAUSED_BY, warn'ы, сохранение в runs/.
//
// Версия: 2.0.0

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// СХЕМА: типы сущностей и связей
// ============================================================

const ENTITY_TYPES = {
  Actor: {
    subtypes: ['State', 'NonState', 'Individual', 'Military', 'Government', 'Media'],
    properties: ['name', 'type', 'country', 'influence', 'allies', 'adversaries'],
  },
  Event: {
    subtypes: ['Conflict', 'Economic', 'Political', 'Military', 'Diplomatic', 'Social'],
    properties: ['timestamp', 'location', 'severity', 'source', 'description', 'casualties'],
  },
  Location: {
    subtypes: ['Country', 'Region', 'City', 'Facility', 'Maritime', 'Border'],
    properties: ['name', 'lat', 'lon', 'type', 'population', 'strategicValue'],
  },
  Asset: {
    subtypes: ['Weapon', 'Vehicle', 'Aircraft', 'Ship', 'Facility', 'Cyber'],
    properties: ['name', 'type', 'owner', 'location', 'status', 'capability'],
  },
  Organization: {
    subtypes: ['Government', 'Military', 'NGO', 'Corporate', 'Terror', 'International'],
    properties: ['name', 'type', 'country', 'members', 'funding', 'affiliations'],
  },
  Document: {
    subtypes: ['Report', 'Sanction', 'Treaty', 'Statement', 'Leak', 'Analysis'],
    properties: ['title', 'source', 'timestamp', 'classification', 'url', 'summary'],
  },
};

const RELATION_TYPES = {
  CONTROLS:      { from: ['Actor', 'Organization'], to: ['Asset', 'Location', 'Organization'] },
  LOCATED_IN:    { from: ['Asset', 'Event', 'Actor'], to: ['Location'] },
  OCCURRED_AT:   { from: ['Event'], to: ['Location', 'Timestamp'] },
  SANCTIONED_BY: { from: ['Actor', 'Organization'], to: ['Actor', 'Organization'] },
  LINKED_TO:     { from: ['*'], to: ['*'] },
  USED_IN:       { from: ['Asset'], to: ['Event'] },
  MEMBER_OF:     { from: ['Actor'], to: ['Organization'] },
  ALLIED_WITH:   { from: ['Actor', 'Organization'], to: ['Actor', 'Organization'] },
  ADVERSARY_OF:  { from: ['Actor', 'Organization'], to: ['Actor', 'Organization'] },
  REPORTED_BY:   { from: ['Event', 'Document'], to: ['Actor', 'Organization'] },
  CAUSED_BY:     { from: ['Event'], to: ['Event', 'Actor'] },
  TARGETS:       { from: ['Actor', 'Asset'], to: ['Actor', 'Location', 'Asset'] },
};

// ============================================================
// КЛАСС ГРАФА ЗНАНИЙ
// ============================================================

class KnowledgeGraph {
  constructor() {
    this.entities = new Map();
    this.relations = [];
    this.index = {
      byType: new Map(),
      byName: new Map(),
      byRelation: new Map(),
    };
  }

  /**
   * Добавление сущности.
   * Проверка: entity && entity.type. Иначе — null.
   */
  addEntity(entity) {
    if (!entity || !entity.type) return null;

    const id = entity.id || `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const normalized = {
      id,
      type: entity.type,
      subtype: entity.subtype || null,
      properties: entity.properties || {},
      name: entity.name || (entity.properties && entity.properties.name) || id,
      source: entity.source || 'unknown',
      confidence: typeof entity.confidence === 'number' ? entity.confidence : 1.0,
      timestamp: entity.timestamp || new Date().toISOString(),
      observedCount: 1,
    };

    this.entities.set(id, normalized);
    this._indexEntity(normalized);
    return id;
  }

  /**
   * Добавление связи.
   * Проверки: from/to/type обязательны. RELATION_TYPES — warn.
   * entities.has — warn.
   */
  addRelation(from, to, type, properties = {}) {
    if (!from || !to || !type) return null;

    if (!RELATION_TYPES[type]) {
      console.warn(`[graph] Unknown relation type: ${type}`);
    }
    if (!this.entities.has(from) || !this.entities.has(to)) {
      console.warn(`[graph] Missing entity for relation ${from} -> ${to}`);
    }

    const relation = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from,
      to,
      type,
      properties: {
        ...properties,
        confidence: typeof properties.confidence === 'number' ? properties.confidence : 0.8,
        source: properties.source || 'unknown',
      },
      timestamp: new Date().toISOString(),
    };

    this.relations.push(relation);

    if (!this.index.byRelation.has(type)) this.index.byRelation.set(type, []);
    this.index.byRelation.get(type).push({ from, to });

    return relation.id;
  }

  _indexEntity(entity) {
    if (!this.index.byType.has(entity.type)) this.index.byType.set(entity.type, new Set());
    this.index.byType.get(entity.type).add(entity.id);

    const normName = (entity.name || '').toLowerCase().trim();
    if (normName) {
      if (!this.index.byName.has(normName)) this.index.byName.set(normName, new Set());
      this.index.byName.get(normName).add(entity.id);
    }
  }

  findByName(name) {
    if (!name) return [];
    const norm = name.toLowerCase().trim();
    const exact = this.index.byName.get(norm);
    if (exact) return [...exact].map((id) => this.entities.get(id));

    const results = [];
    for (const [key, ids] of this.index.byName) {
      if (key.includes(norm) || norm.includes(key)) {
        for (const id of ids) results.push(this.entities.get(id));
      }
    }
    return results;
  }

  getRelations(entityId, direction = 'both') {
    return this.relations.filter((r) => {
      if (direction === 'out') return r.from === entityId;
      if (direction === 'in') return r.to === entityId;
      return r.from === entityId || r.to === entityId;
    });
  }

  findPath(fromId, toId, maxDepth = 5) {
    if (!this.entities.has(fromId) || !this.entities.has(toId)) return null;

    const queue = [{ id: fromId, path: [] }];
    const visited = new Set([fromId]);

    while (queue.length > 0) {
      const { id, path } = queue.shift();
      if (id === toId) return path;
      if (path.length >= maxDepth) continue;

      const relations = this.getRelations(id);
      for (const r of relations) {
        const nextId = r.from === id ? r.to : r.from;
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push({ id: nextId, path: [...path, r] });
        }
      }
    }
    return null;
  }

  getNeighborhood(entityId, hops = 2) {
    const visited = new Set([entityId]);
    const entities = [];
    const relations = [];

    let frontier = [entityId];
    for (let h = 0; h < hops; h++) {
      const nextFrontier = [];
      for (const id of frontier) {
        const rels = this.getRelations(id);
        for (const r of rels) {
          relations.push(r);
          const otherId = r.from === id ? r.to : r.from;
          if (!visited.has(otherId)) {
            visited.add(otherId);
            const entity = this.entities.get(otherId);
            if (entity) entities.push(entity);
            nextFrontier.push(otherId);
          }
        }
      }
      frontier = nextFrontier;
    }
    const centerEntity = this.entities.get(entityId);
    if (centerEntity) entities.push(centerEntity);

    return { entities, relations };
  }

  stats() {
    const typeCounts = {};
    for (const [t, s] of this.index.byType) typeCounts[t] = s.size;

    const relationCounts = {};
    for (const [t, list] of this.index.byRelation) relationCounts[t] = list.length;

    return {
      entityCount: this.entities.size,
      relationCount: this.relations.length,
      typeCounts,
      relationCounts,
    };
  }

  toJSON() {
    return {
      entities: [...this.entities.values()],
      relations: this.relations,
      stats: this.stats(),
    };
  }

  save(filepath) {
    writeFileSync(filepath, JSON.stringify(this.toJSON(), null, 2));
  }

  static load(filepath) {
    if (!existsSync(filepath)) return new KnowledgeGraph();
    try {
      const raw = readFileSync(filepath, 'utf-8');
      const data = JSON.parse(raw);
      const kg = new KnowledgeGraph();
      for (const e of data.entities || []) {
        kg.entities.set(e.id, e);
        kg._indexEntity(e);
      }
      kg.relations = data.relations || [];
      for (const r of kg.relations) {
        if (!kg.index.byRelation.has(r.type)) kg.index.byRelation.set(r.type, []);
        kg.index.byRelation.get(r.type).push({ from: r.from, to: r.to });
      }
      return kg;
    } catch {
      return new KnowledgeGraph();
    }
  }
}

// ============================================================
// ИЗВЛЕЧЕНИЕ СУЩНОСТЕЙ ИЗ SWEEP
// ============================================================

/**
 * Построение графа из sweep.
 * Из GDELT: Event → Location (OCCURRED_AT), Event → Actor (CAUSED_BY).
 * Из sanctions: Document → Actor (TARGETS).
 * Сохранение в runs/knowledge_graph.json.
 */
function buildGraphFromSweep(latest, previousGraph = null) {
  const kg = previousGraph || new KnowledgeGraph();

  // ─── GDELT события ───
  if (latest && latest.gdelt && Array.isArray(latest.gdelt.conflictEvents)) {
    for (const event of latest.gdelt.conflictEvents.slice(0, 50)) {
      const eventId = kg.addEntity({
        type: 'Event',
        subtype: 'Conflict',
        name: event.summary || event.description || 'Unknown conflict',
        properties: {
          timestamp: event.timestamp,
          location: event.location,
          severity: event.severity,
          source: 'gdelt',
          goldsteinScore: event.goldsteinScore,
          casualties: event.casualties,
        },
        source: 'gdelt',
        confidence: 0.7,
      });

      if (event.countryCode) {
        const locId = kg.addEntity({
          type: 'Location',
          subtype: 'Country',
          name: event.countryName || event.countryCode,
          properties: { countryCode: event.countryCode },
          source: 'gdelt',
        });
        if (locId) kg.addRelation(eventId, locId, 'OCCURRED_AT');
      }

      if (Array.isArray(event.actors)) {
        for (const actor of event.actors) {
          const actorId = kg.addEntity({
            type: 'Actor',
            subtype: actor.type || 'State',
            name: actor.name,
            properties: { country: actor.country },
            source: 'gdelt',
            confidence: 0.6,
          });
          if (actorId) kg.addRelation(eventId, actorId, 'CAUSED_BY', { role: actor.role });
        }
      }
    }
  }

  // ─── Санкции ───
  if (latest && latest.sanctions && Array.isArray(latest.sanctions.entries)) {
    for (const s of latest.sanctions.entries) {
      const docId = kg.addEntity({
        type: 'Document',
        subtype: 'Sanction',
        name: s.title || 'Sanction entry',
        properties: { target: s.target, date: s.date, source: s.source },
        source: 'sanctions',
        confidence: 0.9,
      });
      if (s.targetCountry) {
        const targetId = kg.addEntity({
          type: 'Actor',
          subtype: 'State',
          name: s.targetCountry,
          source: 'sanctions',
        });
        if (targetId) kg.addRelation(docId, targetId, 'TARGETS');
      }
    }
  }

  // ─── Сохранение ───
  try {
    const dir = join(__dirname, '..', '..', 'runs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    kg.save(join(dir, 'knowledge_graph.json'));
  } catch (e) {
    console.warn('[graph] save failed:', e.message);
  }

  return kg;
}

export {
  KnowledgeGraph,
  ENTITY_TYPES,
  RELATION_TYPES,
  buildGraphFromSweep,
};
