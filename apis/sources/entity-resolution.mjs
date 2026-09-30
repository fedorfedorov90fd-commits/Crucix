/**
 * entity-resolution.mjs — Разрешение сущностей
 *
 * Объединяет разные упоминания одной сущности в разных источниках
 * Аналог Crucix: связывание данных о человеке/организации из разных источников
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = '/home/ta8_/Рабочий стол/Crucix/data/basket';
const RESOLVED_FILE = '/home/ta8_/Рабочий стол/Crucix/data/entities-resolved.json';

// Кэш разрешённых сущностей
let resolvedCache = null;

/**
 * Типы сущностей для разрешения
 */
const ENTITY_TYPES = [
  'person',
  'organization',
  'country',
  'location',
  'event',
  'indicator'
];

/**
 * Извлечение сущностей из данных
 */
function extractRawEntities(data) {
  const entities = [];
  const items = Array.isArray(data) ? data : (data.data || data.items || []);

  for (const item of items) {
    // Персоны
    const names = [item.name, item.person, item.actor, item.author, item.source]
      .filter(Boolean);
    for (const name of names) {
      if (name.length > 1 && name.length < 100) {
        entities.push({
          type: 'person',
          name: name,
          context: item,
          source: item.source || 'unknown'
        });
      }
    }

    // Организации
    const orgs = [item.organization, item.org, item.group, item.company]
      .filter(Boolean);
    for (const org of orgs) {
      if (org.length > 1) {
        entities.push({
          type: 'organization',
          name: org,
          context: item,
          source: item.source || 'unknown'
        });
      }
    }

    // Страны
    const countries = [item.country, item.country_code, item.region]
      .filter(Boolean);
    for (const country of countries) {
      if (country.length > 1 && country.length < 50) {
        entities.push({
          type: 'country',
          name: country,
          context: item,
          source: item.source || 'unknown'
        });
      }
    }
  }

  return entities;
}

/**
 * Нормализация имени для сравнения
 */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Сравнение имён (похожесть)
 */
function namesSimilar(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;

  // Расстояние Левенштейна
  const dist = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 0;
  return 1 - dist / maxLen;
}

/**
 * Расстояние Левенштейна
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i-1] === a[j-1]) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Разрешение сущностей
 */
export function resolveEntities(threshold = 0.7) {
  const allEntities = [];
  const sources = [];

  // Сканируем корзину
  if (existsSync(BASKET_DIR)) {
    const files = readdirSync(BASKET_DIR).filter(f => f.endsWith('.json'));
    for (const file of files.slice(0, 50)) {
      try {
        const content = readFileSync(join(BASKET_DIR, file), 'utf8');
        const data = JSON.parse(content);
        const raw = extractRawEntities(data);
        allEntities.push(...raw);
        sources.push(file);
      } catch (e) {
        // Пропускаем битые файлы
      }
    }
  }

  // Группировка по типу
  const byType = {};
  for (const entity of allEntities) {
    if (!byType[entity.type]) byType[entity.type] = [];
    byType[entity.type].push(entity);
  }

  // Разрешение
  const resolved = [];
  const used = new Set();

  for (const type of ENTITY_TYPES) {
    const entities = byType[type] || [];
    const clusters = [];

    for (const entity of entities) {
      const key = `${type}_${normalizeName(entity.name)}`;
      if (used.has(key)) continue;

      const cluster = {
        type: type,
        canonicalName: entity.name,
        mentions: [entity.name],
        sources: new Set([entity.source]),
        contexts: [entity.context],
        count: 1,
        confidence: 1.0
      };

      // Поиск похожих
      for (const other of entities) {
        if (entity === other || used.has(`${type}_${normalizeName(other.name)}`)) continue;
        const similarity = namesSimilar(entity.name, other.name);
        if (similarity >= threshold) {
          cluster.mentions.push(other.name);
          cluster.sources.add(other.source);
          cluster.contexts.push(other.context);
          cluster.count++;
          cluster.confidence = Math.min(1, cluster.confidence + similarity * 0.1);
          used.add(`${type}_${normalizeName(other.name)}`);
        }
      }

      resolved.push(cluster);
      used.add(key);
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    sources: sources,
    resolved: resolved,
    stats: {
      totalRaw: allEntities.length,
      totalResolved: resolved.length,
      byType: {}
    }
  };

  for (const r of resolved) {
    result.stats.byType[r.type] = (result.stats.byType[r.type] || 0) + 1;
  }

  resolvedCache = result;
  writeFileSync(RESOLVED_FILE, JSON.stringify(result, null, 2));

  return { success: true, result };
}

/**
 * Поиск сущности по имени
 */
export function searchResolved(query) {
  if (!resolvedCache) {
    resolveEntities();
  }

  const q = query.toLowerCase();
  const results = resolvedCache.resolved.filter(r =>
    r.canonicalName.toLowerCase().includes(q) ||
    r.mentions.some(m => m.toLowerCase().includes(q))
  );

  return {
    success: true,
    query,
    results: results.slice(0, 50),
    count: results.length
  };
}

/**
 * Получение связей между разрешёнными сущностями
 */
export function getEntityRelations(entityName) {
  if (!resolvedCache) {
    resolveEntities();
  }

  const entity = resolvedCache.resolved.find(r =>
    r.canonicalName.toLowerCase() === entityName.toLowerCase() ||
    r.mentions.some(m => m.toLowerCase() === entityName.toLowerCase())
  );

  if (!entity) {
    return { success: false, error: 'Сущность не найдена' };
  }

  // Поиск связанных сущностей через контексты
  const relations = [];
  const relatedNames = new Set();

  for (const context of entity.contexts) {
    const contextStr = JSON.stringify(context).toLowerCase();
    for (const other of resolvedCache.resolved) {
      if (other === entity) continue;
      if (relatedNames.has(other.canonicalName)) continue;

      const otherStr = JSON.stringify(other.contexts).toLowerCase();
      // Простая проверка: есть ли упоминания в одних контекстах
      if (contextStr.includes(other.canonicalName.toLowerCase()) ||
          other.mentions.some(m => contextStr.includes(m.toLowerCase()))) {
        relatedNames.add(other.canonicalName);
        relations.push({
          from: entity.canonicalName,
          to: other.canonicalName,
          type: 'related',
          confidence: 0.6
        });
      }
    }
  }

  return {
    success: true,
    entity: entity,
    relations: relations.slice(0, 20),
    count: relations.length
  };
}

/**
 * Получение статистики разрешения
 */
export function getResolutionStats() {
  if (!resolvedCache) {
    resolveEntities();
  }

  return {
    success: true,
    stats: resolvedCache.stats,
    sources: resolvedCache.sources,
    timestamp: resolvedCache.timestamp
  };
}

// ============================================================
// API-ЭНДПОИНТЫ
// ============================================================

export const endpoints = [
  { path: '/api/entities/resolve', method: 'POST', handler: resolveEntities },
  { path: '/api/entities/search', method: 'GET', handler: searchResolved },
  { path: '/api/entities/relations/:name', method: 'GET', handler: getEntityRelations },
  { path: '/api/entities/stats', method: 'GET', handler: getResolutionStats }
];

export default {
  resolveEntities,
  searchResolved,
  getEntityRelations,
  getResolutionStats,
  endpoints
};
