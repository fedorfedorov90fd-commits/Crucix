/**
 * basket-adapter.mjs
 * Универсальный адаптер для данных из корзины
 * Единый вход для всех источников
 */

import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// Импорт адаптеров
import { adaptVix } from './adapters/vix-adapter.mjs';

// Регистрация адаптеров
const ADAPTERS = {
  'vix': adaptVix,
  'vix.json': adaptVix,
  // Добавляем новые адаптеры по мере необходимости
};

// Координаты регионов (общие для всех)
export const REGION_COORDS = {
  'US': { lat: 39.8283, lng: -98.5795 },
  'EU': { lat: 50.8503, lng: 4.3517 },
  'UK': { lat: 51.5074, lng: -0.1278 },
  'ASIA': { lat: 35.6762, lng: 139.6503 },
  'JAPAN': { lat: 35.6762, lng: 139.6503 },
  'CHINA': { lat: 35.8617, lng: 104.1954 },
  'INDIA': { lat: 20.5937, lng: 78.9629 },
  'RUSSIA': { lat: 61.5240, lng: 105.3188 },
  'BRAZIL': { lat: -14.2350, lng: -51.9253 },
  'AUSTRALIA': { lat: -25.2744, lng: 133.7751 },
  'MIDDLE_EAST': { lat: 23.4241, lng: 53.8478 },
  'AFRICA': { lat: -8.7832, lng: 34.5085 },
  'GLOBAL': { lat: 20.0, lng: 0.0 }
};

// Нормализация названий регионов
export function NORMALIZE_REGION(name) {
  if (!name) return 'GLOBAL';
  const str = name.toUpperCase().trim();
  for (const [key, value] of Object.entries(REGION_COORDS)) {
    if (str.includes(key) || key.includes(str)) return key;
  }
  return 'GLOBAL';
}

/**
 * Загрузить и адаптировать данные из корзины
 * @param {string} name - имя файла без расширения (например, 'vix')
 * @param {string} format - формат, если нужно принудительно
 * @returns {Promise<Array>} - массив объектов Feature
 */
export async function loadBasketData(name, format = null) {
  const filePath = join(PROJECT_ROOT, 'data/basket', `${name}.json`);

  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = JSON.parse(content);

    // Определяем адаптер
    const adapterKey = format || name;
    const adapter = ADAPTERS[adapterKey] || ADAPTERS[name];

    if (!adapter) {
      console.warn(`⚠️ Адаптер для "${name}" не найден`);
      return [];
    }

    return adapter(raw);
  } catch (err) {
    console.warn(`⚠️ Ошибка загрузки "${name}":`, err.message);
    return [];
  }
}

/**
 * Загрузить данные и сразу преобразовать в FeatureCollection
 */
export async function loadBasketFeatureCollection(name, format = null) {
  const features = await loadBasketData(name, format);
  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      source: name,
      total: features.length,
      timestamp: new Date().toISOString()
    }
  };
}

export default {
  loadBasketData,
  loadBasketFeatureCollection,
  REGION_COORDS,
  NORMALIZE_REGION
};
