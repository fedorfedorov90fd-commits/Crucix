/**
 * link-analysis.mjs — Анализ связей между сущностями
 *
 * Выявляет скрытые связи между событиями, людьми, организациями
 * Аналог Crucix: обнаружение паттернов и цепочек связей
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = '/home/ta8_/Рабочий стол/Crucix/data/basket';
const GRAPH_FILE = '/home/ta8_/Рабочий стол/Crucix/data/knowledge-graph.json';

/**
 * Типы связей
 */
const LINK_TYPES = {
  DIRECT: 'direct',
  INDIRECT: 'indirect',
  TEMPORAL: 'temporal',
  SPATIAL: 'spatial',
  SEMANTIC: 'semantic'
};

/**
 * Анализ связей между двумя сущностями
 */
export function analyzeLinks(entity1, entity2, options = {}) {
  const { depth = 2, minConfidence = 0.3 } = options;

  // Загружаем граф
  let graph = null;
  if (existsSync(GRAPH_FILE)) {
    try {
      graph = JSON.parse(readFileSync(GRAPH_FILE, 'utf8'));
    } catch (e) {
      return { success: false, error: 'Ошибка загрузки графа' };
    }
  }

  if (!graph) {
    return { success: false, error: 'Граф не построен. Запустите knowledge-graph' };
  }

  // Поиск сущностей
  const e1 = findEntity(graph, entity1);
  const e2 = findEntity(graph, entity2);

  if (!e1) return { success: false, error: `Сущность "${entity1}" не найдена` };
  if (!e2) return { success: false, error: `Сущность "${entity2}" не найдена` };

  // Поиск прямых связей
  const directLinks = findDirectLinks(graph, e1.id, e2.id);

  // Поиск косвенных связей
  const indirectLinks = findIndirectLinks(graph, e1.id, e2.id, depth);

  // Временные связи
  const temporalLinks = findTemporalLinks(graph, e1.id, e2.id);

  // Общие связи
  const commonConnections = findCommonConnections(graph, e1.id, e2.id);

  const result = {
    success: true,
    entity1: e1,
    entity2: e2,
    directLinks: directLinks,
    indirectLinks: indirectLinks,
    temporalLinks: temporalLinks,
    commonConnections: commonConnections,
    summary: {
      direct: directLinks.length,
      indirect: indirectLinks.length,
      temporal: temporalLinks.length,
      common: commonConnections.length,
      confidence: calculateConfidence(directLinks, indirectLinks, temporalLinks)
    }
  };

  return result;
}

/**
 * Поиск сущности в графе
 */
function findEntity(graph, query) {
  const q = query.toLowerCase();
  return graph.entities.find(e =>
    e.name.toLowerCase() === q ||
    e.name.toLowerCase().includes(q) ||
    e.id.toLowerCase() === q
  );
}

/**
 * Поиск прямых связей
 */
function findDirectLinks(graph, id1, id2) {
  const links = [];

  for (const rel of graph.relations) {
    if ((rel.from === id1 && rel.to === id2) || (rel.from === id2 && rel.to === id1)) {
      links.push({
        type: rel.type,
        weight: rel.weight || 1,
        source: rel.source,
        direction: rel.from === id1 ? 'entity1->entity2' : 'entity2->entity1'
      });
    }
  }

  return links;
}

/**
 * Поиск косвенных связей (через посредников)
 */
function findIndirectLinks(graph, id1, id2, depth) {
  const links = [];

  function traverse(currentId, targetId, path, currentDepth) {
    if (currentDepth > depth || currentId === targetId) return;

    const relations = graph.relations.filter(r => r.from === currentId || r.to === currentId);

    for (const rel of relations) {
      const nextId = rel.from === currentId ? rel.to : rel.from;
      if (path.includes(nextId)) continue;

      const newPath = [...path, nextId];

      if (nextId === targetId) {
        links.push({
          path: newPath,
          length: newPath.length,
          nodes: newPath.map(id => graph.entities.find(e => e.id === id)),
          confidence: 1 / (newPath.length + 1)
        });
      } else if (currentDepth < depth) {
        traverse(nextId, targetId, newPath, currentDepth + 1);
      }
    }
  }

  traverse(id1, id2, [id1], 0);

  // Сортируем по длине пути
  links.sort((a, b) => a.length - b.length);

  return links.slice(0, 10);
}

/**
 * Поиск временных связей
 */
function findTemporalLinks(graph, id1, id2) {
  const links = [];
  const entity1 = graph.entities.find(e => e.id === id1);
  const entity2 = graph.entities.find(e => e.id === id2);

  if (!entity1 || !entity2) return links;

  // Ищем события с участием обеих сущностей
  const events1 = graph.relations
    .filter(r => r.from === id1 || r.to === id1)
    .map(r => r.from === id1 ? r.to : r.from);
  const events2 = graph.relations
    .filter(r => r.from === id2 || r.to === id2)
    .map(r => r.from === id2 ? r.to : r.from);

  // Находим общие события
  const commonEvents = events1.filter(e => events2.includes(e));

  for (const eventId of commonEvents) {
    const event = graph.entities.find(e => e.id === eventId);
    if (event && event.date) {
      links.push({
        event: event.name,
        date: event.date,
        type: 'shared_event',
        confidence: 0.7
      });
    }
  }

  return links;
}

/**
 * Поиск общих связей
 */
function findCommonConnections(graph, id1, id2) {
  const connections1 = new Set();
  const connections2 = new Set();

  for (const rel of graph.relations) {
    if (rel.from === id1) connections1.add(rel.to);
    if (rel.to === id1) connections1.add(rel.from);
    if (rel.from === id2) connections2.add(rel.to);
    if (rel.to === id2) connections2.add(rel.from);
  }

  const common = [...connections1].filter(id => connections2.has(id));

  return common.map(id => {
    const entity = graph.entities.find(e => e.id === id);
    return entity ? { id: entity.id, name: entity.name, type: entity.type } : null;
  }).filter(Boolean);
}

/**
 * Расчёт уверенности
 */
function calculateConfidence(direct, indirect, temporal) {
  let score = 0;

  if (direct.length > 0) score += 0.5;
  if (indirect.length > 0) score += 0.2;
  if (temporal.length > 0) score += 0.2;

  return Math.min(1, score);
}

/**
 * Получение всех связей для сущности
 */
export function getAllLinks(entityName) {
  let graph = null;
  if (existsSync(GRAPH_FILE)) {
    try {
      graph = JSON.parse(readFileSync(GRAPH_FILE, 'utf8'));
    } catch (e) {
      return { success: false, error: 'Ошибка загрузки графа' };
    }
  }

  if (!graph) {
    return { success: false, error: 'Граф не построен' };
  }

  const entity = findEntity(graph, entityName);
  if (!entity) {
    return { success: false, error: `Сущность "${entityName}" не найдена` };
  }

  const links = [];
  const relations = graph.relations.filter(r => r.from === entity.id || r.to === entity.id);

  for (const rel of relations) {
    const otherId = rel.from === entity.id ? rel.to : rel.from;
    const other = graph.entities.find(e => e.id === otherId);
    if (other) {
      links.push({
        entity: other,
        type: rel.type,
        weight: rel.weight || 1,
        source: rel.source,
        direction: rel.from === entity.id ? 'outgoing' : 'incoming'
      });
    }
  }

  // Группировка по типу
  const grouped = {};
  for (const link of links) {
    const type = link.entity.type || 'unknown';
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(link);
  }

  return {
    success: true,
    entity: entity,
    links: links,
    grouped: grouped,
    stats: {
      total: links.length,
      types: Object.keys(grouped).map(k => ({ type: k, count: grouped[k].length }))
    }
  };
}

// ============================================================
// API-ЭНДПОИНТЫ
// ============================================================

export const endpoints = [
  { path: '/api/links/analyze', method: 'POST', handler: analyzeLinks },
  { path: '/api/links/all/:entity', method: 'GET', handler: getAllLinks }
];

export default {
  analyzeLinks,
  getAllLinks,
  endpoints
};
