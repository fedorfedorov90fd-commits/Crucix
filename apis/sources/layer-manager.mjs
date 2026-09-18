/**
 * layer-manager.mjs — Управление интерактивными слоями карты
 *
 * API для включения/выключения слоёв, фильтрации, временной шкалы
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const LAYERS_DIR = '/home/ta8_/Рабочий стол/Crucix/data/layers';
const REGISTRY_FILE = '/home/ta8_/Рабочий стол/Crucix/data/registry/registry-layers.json';
const BASKET_DIR = '/home/ta8_/Рабочий стол/Crucix/data/basket';

/**
 * Загрузка всех слоёв из реестра
 */
function loadLayerRegistry() {
  if (!existsSync(REGISTRY_FILE)) {
    return [];
  }
  try {
    const data = readFileSync(REGISTRY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    console.error('[Layer Manager] Ошибка загрузки реестра:', e.message);
    return [];
  }
}

/**
 * Загрузка данных слоя из корзины
 */
function loadLayerData(layerId) {
  if (!existsSync(BASKET_DIR)) return null;
  const files = readdirSync(BASKET_DIR);
  const pattern = new RegExp(`^${layerId}[.-]`);
  for (const file of files) {
    if (pattern.test(file)) {
      try {
        const data = readFileSync(join(BASKET_DIR, file), 'utf8');
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

/**
 * Получение статуса всех слоёв
 */
export function getAllLayers() {
  const registry = loadLayerRegistry();
  const result = [];

  for (const entry of registry) {
    const data = loadLayerData(entry.id);
    result.push({
      id: entry.id,
      name: entry.name || entry.id,
      category: entry.category || 'general',
      enabled: entry.enabled !== false,
      hasData: data !== null,
      dataCount: Array.isArray(data) ? data.length : (data && data.data ? data.data.length : 0),
      color: entry.color || '#4d6bfe',
      icon: entry.icon || '📍',
      description: entry.description || '',
      type: entry.type || 'point',
      lastUpdate: entry.lastUpdate || null
    });
  }

  return result;
}

/**
 * Включение/выключение слоя
 */
export function toggleLayer(layerId, enabled) {
  const registry = loadLayerRegistry();
  const entry = registry.find(l => l.id === layerId);
  if (!entry) {
    return { success: false, error: 'Слой не найден' };
  }
  entry.enabled = enabled !== false;
  writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
  return { success: true, layerId, enabled: entry.enabled };
}

/**
 * Получение данных слоя с фильтрацией
 */
export function getLayerData(layerId, filters = {}) {
  const data = loadLayerData(layerId);
  if (!data) {
    return { success: false, error: 'Данные не найдены' };
  }

  let items = Array.isArray(data) ? data : (data.data || []);

  // Фильтрация по времени
  if (filters.fromDate) {
    const from = new Date(filters.fromDate);
    items = items.filter(item => {
      const date = new Date(item.date || item.timestamp || item.time);
      return date >= from;
    });
  }
  if (filters.toDate) {
    const to = new Date(filters.toDate);
    items = items.filter(item => {
      const date = new Date(item.date || item.timestamp || item.time);
      return date <= to;
    });
  }

  // Фильтрация по региону
  if (filters.region) {
    items = items.filter(item =>
      item.region === filters.region ||
      item.country === filters.region ||
      (item.location && item.location.includes(filters.region))
    );
  }

  // Фильтрация по типу
  if (filters.type) {
    items = items.filter(item => item.type === filters.type || item.category === filters.type);
  }

  // Ограничение по количеству
  if (filters.limit) {
    items = items.slice(0, filters.limit);
  }

  return {
    success: true,
    layerId,
    count: items.length,
    data: items,
    filters
  };
}

/**
 * Получение временной шкалы для слоя
 */
export function getLayerTimeline(layerId) {
  const data = loadLayerData(layerId);
  if (!data) {
    return { success: false, error: 'Данные не найдены' };
  }

  const items = Array.isArray(data) ? data : (data.data || []);
  const timeline = [];

  for (const item of items) {
    const date = new Date(item.date || item.timestamp || item.time);
    if (isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 7);
    const existing = timeline.find(t => t.month === key);
    if (existing) {
      existing.count++;
    } else {
      timeline.push({ month: key, count: 1 });
    }
  }

  timeline.sort((a, b) => a.month.localeCompare(b.month));
  return { success: true, layerId, timeline };
}

/**
 * Получение статистики слоя
 */
export function getLayerStats(layerId) {
  const data = loadLayerData(layerId);
  if (!data) {
    return { success: false, error: 'Данные не найдены' };
  }

  const items = Array.isArray(data) ? data : (data.data || []);
  const stats = {
    total: items.length,
    types: {},
    regions: {},
    dateRange: null
  };

  let minDate = null, maxDate = null;

  for (const item of items) {
    const type = item.type || item.category || 'unknown';
    stats.types[type] = (stats.types[type] || 0) + 1;

    const region = item.region || item.country || item.location || 'unknown';
    stats.regions[region] = (stats.regions[region] || 0) + 1;

    const date = new Date(item.date || item.timestamp || item.time);
    if (!isNaN(date.getTime())) {
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
  }

  if (minDate && maxDate) {
    stats.dateRange = {
      from: minDate.toISOString(),
      to: maxDate.toISOString()
    };
  }

  return { success: true, layerId, stats };
}

// ============================================================
// HTTP-ОБРАБОТЧИКИ ДЛЯ SERVER.MJS
// ============================================================

/**
 * Обработчик /api/layers/ - получение данных слоя
 */
export async function handleLayerAPI(req, res, pathname) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = pathname.replace('/api/layers/', '').split('/');
  const layerId = parts[0];
  const action = parts[1] || 'data';

  try {
    let result;

    if (action === 'data' || !action) {
      const filters = {};
      if (url.searchParams.get('from')) filters.fromDate = url.searchParams.get('from');
      if (url.searchParams.get('to')) filters.toDate = url.searchParams.get('to');
      if (url.searchParams.get('region')) filters.region = url.searchParams.get('region');
      if (url.searchParams.get('type')) filters.type = url.searchParams.get('type');
      if (url.searchParams.get('limit')) filters.limit = parseInt(url.searchParams.get('limit'));
      result = getLayerData(layerId, filters);
    } else if (action === 'stats') {
      result = getLayerStats(layerId);
    } else if (action === 'timeline') {
      result = getLayerTimeline(layerId);
    } else if (action === 'toggle') {
      const enabled = url.searchParams.get('enabled') !== 'false';
      result = toggleLayer(layerId, enabled);
    } else {
      result = { success: false, error: 'Unknown action: ' + action };
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

/**
 * Обработчик /api/layers - список всех слоёв
 */
export async function handleLayersListAPI(req, res) {
  try {
    const result = getAllLayers();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, layers: result, count: result.length }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

// ============================================================
// API-ЭНДПОИНТЫ ДЛЯ ЭКСПОРТА
// ============================================================

export const endpoints = [
  { path: '/api/layers/all', method: 'GET', handler: getAllLayers },
  { path: '/api/layers/toggle', method: 'POST', handler: toggleLayer },
  { path: '/api/layers/data/:layerId', method: 'GET', handler: getLayerData },
  { path: '/api/layers/timeline/:layerId', method: 'GET', handler: getLayerTimeline },
  { path: '/api/layers/stats/:layerId', method: 'GET', handler: getLayerStats }
];

export default {
  getAllLayers,
  toggleLayer,
  getLayerData,
  getLayerTimeline,
  getLayerStats,
  handleLayerAPI,
  handleLayersListAPI,
  endpoints
};
