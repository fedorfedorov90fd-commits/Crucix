#!/usr/bin/env node

// ============================================================
// FIX-COORDINATE-LAYERS.MJS — Исправление слоёв с координатами
// ============================================================

import fs from 'fs/promises';
import path from 'path';

const BASKET_DIR = path.join(process.cwd(), 'data', 'basket');

// Список слоёв с default координатами
const DEFAULT_COORDS = {
  'war-preparation': { lat: 55.7558, lng: 37.6173 },   // Москва
  'nuclear-monitor': { lat: 46.2044, lng: 6.1432 },    // Женева
  'viirs': { lat: 38.8895, lng: -77.0353 },            // Вашингтон
  'firms': { lat: 40.0, lng: 30.0 },                   // Центр регионов
  'acled': { lat: 30.0, lng: 20.0 },                   // Центр Африки
  'gdelt': { lat: 30.0, lng: 20.0 }                    // Центр мира
};

// Слои, где данные уже есть и нужно просто пересохранить
const REFORMAT_LAYERS = [
  'military-bases',
  'noaa',
  'safecast',
  'usgs',
  'starlink',
  'cyber-attacks',
  'aviation'
];

async function fixLayer(layerId) {
  const filePath = path.join(BASKET_DIR, `${layerId}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    let data = JSON.parse(content);
    
    // Если есть default координаты — добавим их
    if (DEFAULT_COORDS[layerId]) {
      const { lat, lng } = DEFAULT_COORDS[layerId];
      console.log(`  📍 ${layerId}: добавляем default координаты (${lat}, ${lng})`);
      
      // Если это массив — добавим координаты в каждый объект
      if (Array.isArray(data)) {
        data = data.map(item => ({
          ...item,
          lat: item.lat || lat,
          lng: item.lng || lng
        }));
      } else if (data.data && Array.isArray(data.data)) {
        data.data = data.data.map(item => ({
          ...item,
          lat: item.lat || lat,
          lng: item.lng || lng
        }));
      }
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    }
    
    // Для слоёв с уже существующими координатами — проверяем структуру
    if (REFORMAT_LAYERS.includes(layerId)) {
      console.log(`  📍 ${layerId}: проверка структуры...`);
      
      // Если данные уже в FeatureCollection — оставляем
      if (data.type === 'FeatureCollection') {
        console.log(`  ✅ ${layerId}: уже в правильном формате`);
        return true;
      }
      
      // Если данные в data.features
      if (data.data && data.data.features) {
        const features = data.data.features;
        // Проверяем, есть ли координаты
        const hasCoords = features.some(f => 
          f.geometry?.coordinates || f.lat || f.lng
        );
        if (!hasCoords) {
          console.log(`  ⚠️ ${layerId}: есть features, но нет координат`);
        } else {
          console.log(`  ✅ ${layerId}: координаты найдены`);
        }
        return true;
      }
      
      console.log(`  ⚠️ ${layerId}: формат не распознан`);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error(`  ❌ ${layerId}: ошибка — ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔧 ИСПРАВЛЕНИЕ СЛОЁВ С КООРДИНАТАМИ\n');
  console.log('═'.repeat(50));
  
  let fixed = 0;
  const layers = Object.keys(DEFAULT_COORDS).concat(REFORMAT_LAYERS);
  
  for (const layerId of layers) {
    const result = await fixLayer(layerId);
    if (result) fixed++;
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Исправлено слоёв: ${fixed}/${layers.length}`);
  console.log('\n✅ Готово!');
}

main().catch(console.error);
