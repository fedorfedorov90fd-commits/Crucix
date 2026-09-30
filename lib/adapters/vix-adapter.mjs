/**
 * vix-adapter.mjs
 * Адаптер для данных VIX — распределяет точки по регионам
 */

import { REGION_COORDS, NORMALIZE_REGION } from '../basket-adapter.mjs';

// Список регионов для распределения
const REGIONS = ['US', 'EU', 'UK', 'JAPAN', 'CHINA', 'INDIA', 'RUSSIA', 'BRAZIL', 'AUSTRALIA', 'MIDDLE_EAST', 'AFRICA'];

export function adaptVix(rawData) {
  // Если данные не массив — пытаемся извлечь
  let data = rawData;
  if (!Array.isArray(data)) {
    if (data.data && Array.isArray(data.data)) data = data.data;
    else if (data.values && Array.isArray(data.values)) data = data.values;
    else if (data.items && Array.isArray(data.items)) data = data.items;
    else return [];
  }

  return data.map((item, index) => {
    // Извлекаем значение
    let value = 0;
    if (typeof item === 'number') value = item;
    else if (item.value !== undefined) value = item.value;
    else if (item.close !== undefined) value = item.close;
    else if (item.price !== undefined) value = item.price;
    else if (item.vix !== undefined) value = item.vix;

    // Извлекаем дату
    let timestamp = new Date().toISOString();
    if (item.timestamp) timestamp = new Date(item.timestamp).toISOString();
    else if (item.date) timestamp = new Date(item.date).toISOString();
    else if (item.time) timestamp = new Date(item.time).toISOString();

    // Определяем регион: если в данных есть поле region — используем его
    let region = 'GLOBAL';
    if (item.region) {
      region = NORMALIZE_REGION(item.region);
    } else if (item.country) {
      region = NORMALIZE_REGION(item.country);
    } else {
      // Если региона нет — распределяем по индексу (циклически)
      region = REGIONS[index % REGIONS.length];
    }

    const coords = REGION_COORDS[region] || REGION_COORDS['GLOBAL'];

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [coords.lng, coords.lat]
      },
      properties: {
        value: parseFloat(value) || 0,
        timestamp: timestamp,
        region: region,
        source: 'vix',
        label: `VIX: ${parseFloat(value).toFixed(2)}`,
        raw: item
      }
    };
  }).filter(f => f.properties.value > 0);
}
