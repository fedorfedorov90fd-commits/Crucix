/**
 * collect-map-layer-vix.mjs
 * Сборщик данных для слоя VIX
 *
 * Читает существующие данные VIX и обогащает их гео-координатами
 * Сохраняет в data/basket/map-layer-vix.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '../..');
const BASKET_DIR = join(PROJECT_ROOT, 'data/basket');
const OUTPUT_FILE = join(BASKET_DIR, 'map-layer-vix.json');

// Координаты для регионов
const REGION_COORDS = {
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
  'AFRICA': { lat: -8.7832, lng: 34.5085 },
  'MIDDLE_EAST': { lat: 23.4241, lng: 53.8478 },
  'GLOBAL': { lat: 20.0, lng: 0.0 }
};

// Источники VIX
const VIX_SOURCES = [
  { name: 'VIX', file: 'vix.json' },
  { name: 'VXX', file: 'vxx.json' },
  { name: 'SP500_VIX', file: 'sp500-vix.json' }
];

async function main() {
  console.log('📊 [map-layer-vix] Сбор данных для слоя VIX...');
  const startTime = Date.now();

  try {
    // Создаём папку если нет
    await mkdir(BASKET_DIR, { recursive: true });

    const allData = [];
    const sources = [];

    // Собираем данные из всех источников
    for (const source of VIX_SOURCES) {
      try {
        const filePath = join(BASKET_DIR, source.file);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (Array.isArray(data) && data.length > 0) {
          // Определяем регион для каждого элемента
          const enriched = data.map((record, index) => {
            const region = record.region || record.regionCode || 'GLOBAL';
            const coords = REGION_COORDS[region] || REGION_COORDS['GLOBAL'];

            // Добавляем небольшую случайность для распределения
            const latOffset = (Math.random() - 0.5) * 5;
            const lngOffset = (Math.random() - 0.5) * 5;

            return {
              ...record,
              _source: source.name,
              _enriched: true,
              lat: coords.lat + latOffset,
              lng: coords.lng + lngOffset,
              region: region,
              value: record.value || record.close || record.price || 0,
              timestamp: record.timestamp || record.date || new Date().toISOString()
            };
          });

          allData.push(...enriched);
          sources.push({ source: source.name, count: enriched.length });
          console.log(`  ✅ ${source.name}: ${enriched.length} записей`);
        } else {
          console.log(`  ⚠️ ${source.name}: данные пустые или нет файла`);
        }
      } catch (err) {
        console.log(`  ⚠️ ${source.name}: не удалось прочитать — ${err.message}`);
      }
    }

    // Если данных нет — создаём демо
    if (allData.length === 0) {
      console.log('  📦 Создаю демо-данные...');
      const demo = generateDemoData();
      allData.push(...demo);
    }

    // Сортируем по времени
    allData.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return tA - tB;
    });

    // Сохраняем результат
    const output = {
      type: 'FeatureCollection',
      features: allData.map(record => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [record.lng, record.lat]
        },
        properties: {
          value: record.value,
          timestamp: record.timestamp,
          label: `VIX: ${record.value}`,
          region: record.region || 'GLOBAL',
          change: record.change || 0,
          volume: record.volume || 0,
          source: record._source || 'unknown',
          _original: record
        }
      })),
      metadata: {
        sources,
        total: allData.length,
        timestamp: new Date().toISOString(),
        layer: 'map-layer-vix',
        generator: 'collect-map-layer-vix'
      }
    };

    await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');

    console.log(`✅ [map-layer-vix] Сохранено ${allData.length} записей`);
    console.log(`   Файл: ${OUTPUT_FILE}`);
    console.log(`   ⏱️ ${(Date.now() - startTime) / 1000}с`);

    return output;

  } catch (err) {
    console.error('❌ [map-layer-vix] Ошибка:', err);
    throw err;
  }
}

/**
 * Генерация демо-данных
 */
function generateDemoData() {
  const data = [];
  const now = Date.now();
  const regions = Object.keys(REGION_COORDS);

  for (let i = 0; i < 50; i++) {
    const region = regions[Math.floor(Math.random() * regions.length)];
    const coords = REGION_COORDS[region];
    const baseValue = 15 + Math.random() * 25;

    data.push({
      value: Math.round(baseValue * 100) / 100,
      timestamp: new Date(now - Math.random() * 86400000 * 60).toISOString(),
      region: region,
      lat: coords.lat + (Math.random() - 0.5) * 5,
      lng: coords.lng + (Math.random() - 0.5) * 5,
      change: Math.round((Math.random() - 0.5) * 8 * 100) / 100,
      volume: Math.round(Math.random() * 500000),
      _source: 'demo',
      _enriched: true
    });
  }

  return data;
}

// Запуск если скрипт вызван напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default main;
