/**
 * threat-intel.mjs — Угрозы в реальном времени
 *
 * Агрегация и анализ угроз из различных источников
 * Аналог Recorded Future: оповещения о новых угрозах
 */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = '/home/ta8_/Рабочий стол/Crucix/data/basket';
const THREATS_FILE = '/home/ta8_/Рабочий стол/Crucix/data/threats.json';

// Кэш угроз
let threatsCache = null;

/**
 * Типы угроз
 */
const THREAT_TYPES = {
  CYBER: 'cyber',
  MILITARY: 'military',
  GEOPOLITICAL: 'geopolitical',
  ECONOMIC: 'economic',
  NATURAL: 'natural',
  SOCIAL: 'social',
  TERRORISM: 'terrorism'
};

/**
 * Уровни критичности
 */
const SEVERITY_LEVELS = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

/**
 * Сбор угроз из всех источников
 */
export function collectThreats() {
  const threats = [];
  const sources = [];

  if (!existsSync(BASKET_DIR)) {
    return { success: false, error: 'Корзина не найдена' };
  }

  const files = readdirSync(BASKET_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const content = readFileSync(join(BASKET_DIR, file), 'utf8');
      const data = JSON.parse(content);
      sources.push(file);

      const extracted = extractThreats(data, file);
      threats.push(...extracted);
    } catch (e) {
      // Пропускаем битые файлы
    }
  }

  // Сортировка по критичности и времени
  threats.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    const aOrder = severityOrder[a.severity] || 5;
    const bOrder = severityOrder[b.severity] || 5;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const result = {
    timestamp: new Date().toISOString(),
    sources: sources,
    threats: threats,
    stats: {
      total: threats.length,
      bySeverity: {},
      byType: {}
    }
  };

  for (const t of threats) {
    result.stats.bySeverity[t.severity] = (result.stats.bySeverity[t.severity] || 0) + 1;
    result.stats.byType[t.type] = (result.stats.byType[t.type] || 0) + 1;
  }

  threatsCache = result;
  writeFileSync(THREATS_FILE, JSON.stringify(result, null, 2));

  return { success: true, result };
}

/**
 * Извлечение угроз из данных
 */
function extractThreats(data, source) {
  const threats = [];
  const items = Array.isArray(data) ? data : (data.data || data.items || []);

  for (const item of items) {
    const threat = extractThreatFromItem(item, source);
    if (threat) threats.push(threat);
  }

  return threats;
}

/**
 * Извлечение угрозы из одного элемента
 */
function extractThreatFromItem(item, source) {
  // Определяем тип угрозы
  let type = THREAT_TYPES.GEOPOLITICAL;
  let severity = SEVERITY_LEVELS.MEDIUM;

  const text = JSON.stringify(item).toLowerCase();

  // Киберугрозы
  if (text.includes('cyber') || text.includes('hack') || text.includes('malware') ||
      text.includes('virus') || text.includes('ransomware') || text.includes('attack')) {
    type = THREAT_TYPES.CYBER;
  }

  // Военные угрозы
  if (text.includes('military') || text.includes('war') || text.includes('conflict') ||
      text.includes('missile') || text.includes('drone') || text.includes('troop')) {
    type = THREAT_TYPES.MILITARY;
  }

  // Экономические угрозы
  if (text.includes('crash') || text.includes('inflation') || text.includes('recession') ||
      text.includes('bankruptcy') || text.includes('default') || text.includes('debt')) {
    type = THREAT_TYPES.ECONOMIC;
  }

  // Природные угрозы
  if (text.includes('earthquake') || text.includes('flood') || text.includes('hurricane') ||
      text.includes('tsunami') || text.includes('fire') || text.includes('volcano')) {
    type = THREAT_TYPES.NATURAL;
  }

  // Социальные угрозы
  if (text.includes('protest') || text.includes('riot') || text.includes('unrest') ||
      text.includes('strike') || text.includes('demonstration')) {
    type = THREAT_TYPES.SOCIAL;
  }

  // Терроризм
  if (text.includes('terror') || text.includes('jihad') || text.includes('isis') ||
      text.includes('bomb') || text.includes('attack') && text.includes('civilian')) {
    type = THREAT_TYPES.TERRORISM;
  }

  // Определяем критичность
  if (text.includes('critical') || text.includes('emergency') || text.includes('urgent')) {
    severity = SEVERITY_LEVELS.CRITICAL;
  } else if (text.includes('high') || text.includes('severe') || text.includes('major')) {
    severity = SEVERITY_LEVELS.HIGH;
  } else if (text.includes('low') || text.includes('minor')) {
    severity = SEVERITY_LEVELS.LOW;
  }

  const name = item.title || item.name || item.event || 'Неизвестная угроза';
  const description = item.description || item.summary || item.text || '';

  return {
    id: `threat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.slice(0, 100),
    description: description.slice(0, 500),
    type: type,
    severity: severity,
    source: source,
    timestamp: item.date || item.timestamp || new Date().toISOString(),
    location: item.location || item.region || item.country || null,
    data: item
  };
}

/**
 * Получение активных угроз
 */
export function getActiveThreats(options = {}) {
  if (!threatsCache) {
    collectThreats();
  }

  const { severity, type, limit = 50 } = options;
  let threats = threatsCache ? threatsCache.threats : [];

  if (severity) {
    threats = threats.filter(t => t.severity === severity);
  }
  if (type) {
    threats = threats.filter(t => t.type === type);
  }

  return {
    success: true,
    threats: threats.slice(0, limit),
    count: threats.length,
    stats: threatsCache ? threatsCache.stats : null
  };
}

/**
 * Получение критических угроз (срочные)
 */
export function getCriticalThreats() {
  return getActiveThreats({ severity: SEVERITY_LEVELS.CRITICAL });
}

/**
 * Обновление статуса угрозы
 */
export function updateThreatStatus(threatId, status) {
  if (!threatsCache) {
    collectThreats();
  }

  const threat = threatsCache.threats.find(t => t.id === threatId);
  if (!threat) {
    return { success: false, error: 'Угроза не найдена' };
  }

  threat.status = status;
  threat.updatedAt = new Date().toISOString();

  writeFileSync(THREATS_FILE, JSON.stringify(threatsCache, null, 2));

  return { success: true, threat };
}

/**
 * Генерация отчёта по угрозам
 */
export function generateThreatReport() {
  if (!threatsCache) {
    collectThreats();
  }

  const stats = threatsCache.stats;
  const critical = threatsCache.threats.filter(t => t.severity === SEVERITY_LEVELS.CRITICAL);
  const high = threatsCache.threats.filter(t => t.severity === SEVERITY_LEVELS.HIGH);

  return {
    success: true,
    report: {
      generated: new Date().toISOString(),
      summary: {
        total: stats.total,
        critical: stats.bySeverity.critical || 0,
        high: stats.bySeverity.high || 0,
        medium: stats.bySeverity.medium || 0,
        low: stats.bySeverity.low || 0
      },
      byType: stats.byType,
      criticalThreats: critical.slice(0, 10),
      highThreats: high.slice(0, 20),
      sources: threatsCache.sources
    }
  };
}

// ============================================================
// API-ЭНДПОИНТЫ
// ============================================================

export const endpoints = [
  { path: '/api/threats/collect', method: 'POST', handler: collectThreats },
  { path: '/api/threats/active', method: 'GET', handler: getActiveThreats },
  { path: '/api/threats/critical', method: 'GET', handler: getCriticalThreats },
  { path: '/api/threats/update/:id', method: 'PUT', handler: updateThreatStatus },
  { path: '/api/threats/report', method: 'GET', handler: generateThreatReport }
];

export default {
  collectThreats,
  getActiveThreats,
  getCriticalThreats,
  updateThreatStatus,
  generateThreatReport,
  endpoints
};
