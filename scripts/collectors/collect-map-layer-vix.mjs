#!/usr/bin/env node
/**
 * Crucix Collector: map-layer-vix (обогащение VIX координатами).
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * ВНИМАНИЕ: это не классический сборщик внешнего источника.
 * Он обогащает уже собранные VIX-данные (из data/basket/vix.json,
 * vxx.json, sp500-vix.json) координатами и сдаёт через saveRaw.
 *
 * Логически это ближе к API-модулю, но живёт в collect/ для совместимости.
 * После перевода базовых VIX-сборщиков может быть перенесён в apis/sources/.
 *
 * Формат данных: плоский массив [{value, timestamp, region, lat, lng, change, volume, source}].
 * Тип — points (есть координаты).
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');
const BASKET_DIR = join(PROJECT_ROOT, 'data/basket');

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

const VIX_SOURCES = [
  { name: 'VIX', file: 'vix.json' },
  { name: 'VXX', file: 'vxx.json' },
  { name: 'SP500_VIX', file: 'sp500-vix.json' }
];

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
      region,
      lat: coords.lat + (Math.random() - 0.5) * 5,
      lng: coords.lng + (Math.random() - 0.5) * 5,
      change: Math.round((Math.random() - 0.5) * 8 * 100) / 100,
      volume: Math.round(Math.random() * 500000),
      source: 'demo'
    });
  }
  return data;
}

export async function collectMapLayerVix() {
  const allData = [];
  const sources = [];

  for (const source of VIX_SOURCES) {
    try {
      const filePath = join(BASKET_DIR, source.file);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      // Basket может быть в v1-формате {schema, meta, series, points, ...} — читаем points.
      const arr = Array.isArray(data) ? data : (Array.isArray(data.points) ? data.points : []);
      if (arr.length > 0) {
        const enriched = arr.map(record => {
          const region = record.region || 'GLOBAL';
          const coords = REGION_COORDS[region] || REGION_COORDS['GLOBAL'];
          return {
            ...record,
            lat: (record.lat || coords.lat) + (Math.random() - 0.5) * 5,
            lng: (record.lon || record.lng || coords.lng) + (Math.random() - 0.5) * 5,
            region,
            value: record.value || record.close || record.price || 0,
            timestamp: record.timestamp || new Date().toISOString(),
            source: source.name
          };
        });
        allData.push(...enriched);
        sources.push({ source: source.name, count: enriched.length });
      }
    } catch (err) {
      console.warn(`[VIX-LAYER] ${source.name}: ${err.message}`);
    }
  }

  if (allData.length === 0) {
    console.log('[VIX-LAYER] Нет источников, демо-данные');
    allData.push(...generateDemoData());
  }

  const result = await saveRaw('map-layer-vix', allData, {
    collector: 'collect-map-layer-vix.mjs',
    source: 'VIX (обогащение координатами)',
    source_url: 'local://vix-enrichment',
    license: 'public-domain',
    format_hint: 'points',
    value_unit: 'index',
    granularity: 'event',
    record_count: allData.length,
    notes: `Источников: ${sources.length}, всего записей: ${allData.length}`,
    backwardCompat: true
  });

  console.log(`[VIX-LAYER] OK ${allData.length} записей → ${result.raw_file}`);
  console.log(`[VIX-LAYER] Накладная: ${result.incoming_file}`);
  return allData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectMapLayerVix().catch((e) => { console.error('[VIX-LAYER] FATAL:', e.message); process.exit(1); });
}
