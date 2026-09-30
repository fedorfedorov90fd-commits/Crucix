/**
 * dark-web-monitor.mjs — Мониторинг даркнета
 *
 * Отслеживание активности в даркнете: утечки, продажи данных, угрозы
 * Аналог Recorded Future: мониторинг даркнет-источников
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = '/home/ta8_/Рабочий стол/Crucix/data/basket';
const DARKWEB_FILE = '/home/ta8_/Рабочий стол/Crucix/data/darkweb-data.json';

// Кэш данных даркнета
let darkwebCache = null;

/**
 * Типы данных даркнета
 */
const DATA_TYPES = {
  LEAK: 'leak',
  SALE: 'sale',
  THREAT: 'threat',
  FORUM: 'forum',
  MARKET: 'market',
  CHAT: 'chat'
};

/**
 * Сбор данных из даркнета (из корзины)
 */
export function collectDarkWebData() {
  const items = [];
  const sources = [];

  if (!existsSync(BASKET_DIR)) {
    return { success: false, error: 'Корзина не найдена' };
  }

  // Ищем файлы, связанные с даркнетом
  const darkFiles = readdirSync(BASKET_DIR).filter(f =>
    f.includes('darkweb') || f.includes('dark') || f.includes('leak') ||
    f.includes('breach') || f.includes('hack') || f.includes('cyber')
  );

  for (const file of darkFiles) {
    try {
      const content = readFileSync(join(BASKET_DIR, file), 'utf8');
      const data = JSON.parse(content);
      sources.push(file);

      const extracted = extractDarkItems(data, file);
      items.push(...extracted);
    } catch (e) {
      // Пропускаем битые файлы
    }
  }

  // Сортировка по времени
  items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const result = {
    timestamp: new Date().toISOString(),
    sources: sources,
    items: items,
    stats: {
      total: items.length,
      byType: {},
      bySeverity: {}
    }
  };

  for (const item of items) {
    result.stats.byType[item.type] = (result.stats.byType[item.type] || 0) + 1;
    result.stats.bySeverity[item.severity] = (result.stats.bySeverity[item.severity] || 0) + 1;
  }

  darkwebCache = result;
  writeFileSync(DARKWEB_FILE, JSON.stringify(result, null, 2));

  return { success: true, result };
}

/**
 * Извлечение данных из источников
 */
function extractDarkItems(data, source) {
  const items = [];
  const records = Array.isArray(data) ? data : (data.data || data.items || []);

  for (const record of records) {
    const item = extractDarkItem(record, source);
    if (item) items.push(item);
  }

  return items;
}

/**
 * Извлечение одного элемента
 */
function extractDarkItem(record, source) {
  const text = JSON.stringify(record).toLowerCase();

  // Определяем тип
  let type = DATA_TYPES.FORUM;
  if (text.includes('leak') || text.includes('breach') || text.includes('утечка')) {
    type = DATA_TYPES.LEAK;
  } else if (text.includes('sale') || text.includes('sell') || text.includes('продажа')) {
    type = DATA_TYPES.SALE;
  } else if (text.includes('threat') || text.includes('attack') || text.includes('угроза')) {
    type = DATA_TYPES.THREAT;
  } else if (text.includes('market') || text.includes('рынок') || text.includes('shop')) {
    type = DATA_TYPES.MARKET;
  } else if (text.includes('chat') || text.includes('telegram') || text.includes('discord')) {
    type = DATA_TYPES.CHAT;
  }

  // Определяем критичность
  let severity = 'medium';
  if (text.includes('critical') || text.includes('emergency') || text.includes('high')) {
    severity = 'high';
  } else if (text.includes('low') || text.includes('minor')) {
    severity = 'low';
  }

  const name = record.title || record.name || record.event || 'Неизвестное событие';
  const description = record.description || record.summary || record.text || '';

  return {
    id: `dark_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.slice(0, 100),
    description: description.slice(0, 500),
    type: type,
    severity: severity,
    source: source,
    timestamp: record.date || record.timestamp || new Date().toISOString(),
    data: record,
    status: 'active'
  };
}

/**
 * Получение данных даркнета
 */
export function getDarkWebData(options = {}) {
  if (!darkwebCache) {
    collectDarkWebData();
  }

  const { type, severity, limit = 50 } = options;
  let items = darkwebCache ? darkwebCache.items : [];

  if (type) {
    items = items.filter(i => i.type === type);
  }
  if (severity) {
    items = items.filter(i => i.severity === severity);
  }

  return {
    success: true,
    items: items.slice(0, limit),
    count: items.length,
    stats: darkwebCache ? darkwebCache.stats : null
  };
}

/**
 * Получение утечек данных
 */
export function getDataLeaks() {
  return getDarkWebData({ type: DATA_TYPES.LEAK });
}

/**
 * Получение угроз из даркнета
 */
export function getDarkThreats() {
  return getDarkWebData({ type: DATA_TYPES.THREAT, severity: 'high' });
}

/**
 * Анализ трендов даркнета
 */
export function analyzeDarkTrends() {
  if (!darkwebCache) {
    collectDarkWebData();
  }

  const items = darkwebCache.items;
  const trends = {
    byType: {},
    bySeverity: {},
    timeline: {},
    topSources: {}
  };

  for (const item of items) {
    // По типу
    trends.byType[item.type] = (trends.byType[item.type] || 0) + 1;

    // По критичности
    trends.bySeverity[item.severity] = (trends.bySeverity[item.severity] || 0) + 1;

    // Временная шкала
    const date = new Date(item.timestamp).toISOString().slice(0, 10);
    trends.timeline[date] = (trends.timeline[date] || 0) + 1;

    // Источники
    trends.topSources[item.source] = (trends.topSources[item.source] || 0) + 1;
  }

  // Сортируем источники
  const sortedSources = Object.entries(trends.topSources)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    success: true,
    trends: {
      byType: trends.byType,
      bySeverity: trends.bySeverity,
      timeline: trends.timeline,
      topSources: sortedSources,
      total: items.length
    },
    period: {
      from: items.length > 0 ? items[items.length - 1].timestamp : null,
      to: items.length > 0 ? items[0].timestamp : null
    }
  };
}

// ============================================================
// API-ЭНДПОИНТЫ
// ============================================================

export const endpoints = [
  { path: '/api/darkweb/collect', method: 'POST', handler: collectDarkWebData },
  { path: '/api/darkweb/data', method: 'GET', handler: getDarkWebData },
  { path: '/api/darkweb/leaks', method: 'GET', handler: getDataLeaks },
  { path: '/api/darkweb/threats', method: 'GET', handler: getDarkThreats },
  { path: '/api/darkweb/trends', method: 'GET', handler: analyzeDarkTrends }
];

export default {
  collectDarkWebData,
  getDarkWebData,
  getDataLeaks,
  getDarkThreats,
  analyzeDarkTrends,
  endpoints
};
