/**
 * layer-filters.mjs — Фильтрация слоёв карты
 *
 * Поддерживает фильтры по времени, региону, типу, релевантности
 */

import { getLayerData } from './layer-manager.mjs';

/**
 * Фильтрация данных слоя по сложному запросу
 */
export function filterLayerData(layerId, filters) {
  const result = getLayerData(layerId);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  let items = result.data || [];

  // Фильтр по времени (диапазон)
  if (filters.dateRange) {
    const { from, to } = filters.dateRange;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    items = items.filter(item => {
      const date = new Date(item.date || item.timestamp || item.time);
      if (isNaN(date.getTime())) return true;
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }

  // Фильтр по региону (список)
  if (filters.regions && filters.regions.length > 0) {
    const regionSet = new Set(filters.regions);
    items = items.filter(item => {
      const region = item.region || item.country || '';
      return regionSet.has(region);
    });
  }

  // Фильтр по типу (список)
  if (filters.types && filters.types.length > 0) {
    const typeSet = new Set(filters.types);
    items = items.filter(item => {
      const type = item.type || item.category || '';
      return typeSet.has(type);
    });
  }

  // Фильтр по релевантности (только важные)
  if (filters.importantOnly) {
    items = items.filter(item =>
      item.severity === 'critical' ||
      item.confidence > 0.7 ||
      item.important === true
    );
  }

  // Фильтр по тексту
  if (filters.query) {
    const query = filters.query.toLowerCase();
    items = items.filter(item => {
      const searchable = [item.title, item.name, item.description, item.summary, item.text]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }

  // Сортировка
  if (filters.sortBy) {
    const order = filters.sortOrder === 'desc' ? -1 : 1;
    items.sort((a, b) => {
      const va = a[filters.sortBy] || '';
      const vb = b[filters.sortBy] || '';
      if (typeof va === 'string') return va.localeCompare(vb) * order;
      return (va - vb) * order;
    });
  }

  // Пагинация
  if (filters.offset !== undefined || filters.limit !== undefined) {
    const offset = filters.offset || 0;
    const limit = filters.limit || items.length;
    items = items.slice(offset, offset + limit);
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
 * Получение доступных фильтров для слоя
 */
export function getLayerFilters(layerId) {
  const result = getLayerData(layerId);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  const items = result.data || [];
  const filters = {
    types: new Set(),
    regions: new Set(),
    dates: { min: null, max: null }
  };

  for (const item of items) {
    const type = item.type || item.category || 'unknown';
    filters.types.add(type);

    const region = item.region || item.country || '';
    if (region) filters.regions.add(region);

    const date = new Date(item.date || item.timestamp || item.time);
    if (!isNaN(date.getTime())) {
      if (!filters.dates.min || date < filters.dates.min) filters.dates.min = date;
      if (!filters.dates.max || date > filters.dates.max) filters.dates.max = date;
    }
  }

  return {
    success: true,
    layerId,
    filters: {
      types: Array.from(filters.types),
      regions: Array.from(filters.regions),
      dateRange: {
        from: filters.dates.min ? filters.dates.min.toISOString() : null,
        to: filters.dates.max ? filters.dates.max.toISOString() : null
      }
    }
  };
}

// ============================================================
// API-ЭНДПОИНТЫ
// ============================================================

export const endpoints = [
  { path: '/api/layers/filter/:layerId', method: 'POST', handler: filterLayerData },
  { path: '/api/layers/filters/:layerId', method: 'GET', handler: getLayerFilters }
];

export default {
  filterLayerData,
  getLayerFilters,
  endpoints
};
