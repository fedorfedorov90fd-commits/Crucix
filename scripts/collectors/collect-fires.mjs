#!/usr/bin/env node

// ============================================================
// COLLECT-FIRES.MJS — Сбор данных о пожарах (FIRMS)
// Профессиональная версия с координатами
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'fires.json');

// Регионы с реальными координатами (центры пожароопасных зон)
const REGIONS = [
  { name: 'Amazon', lat: -5.0, lng: -60.0 },
  { name: 'California', lat: 37.0, lng: -120.0 },
  { name: 'Siberia', lat: 60.0, lng: 100.0 },
  { name: 'Australia', lat: -25.0, lng: 135.0 },
  { name: 'Greece', lat: 38.0, lng: 23.0 },
  { name: 'Turkey', lat: 39.0, lng: 35.0 },
  { name: 'Canada', lat: 55.0, lng: -100.0 },
  { name: 'Indonesia', lat: -3.0, lng: 118.0 },
  { name: 'Brazil', lat: -15.0, lng: -55.0 },
  { name: 'Spain', lat: 40.0, lng: -4.0 },
  { name: 'Portugal', lat: 39.5, lng: -8.0 },
  { name: 'Italy', lat: 42.0, lng: 12.0 },
  { name: 'Greece', lat: 38.0, lng: 23.0 },
  { name: 'Russia', lat: 55.0, lng: 40.0 },
  { name: 'South Africa', lat: -30.0, lng: 25.0 },
  { name: 'India', lat: 20.0, lng: 78.0 },
  { name: 'China', lat: 35.0, lng: 105.0 },
  { name: 'Japan', lat: 36.0, lng: 138.0 },
  { name: 'Mexico', lat: 23.0, lng: -102.0 },
  { name: 'Argentina', lat: -35.0, lng: -65.0 },
];

function generateFeatures() {
  const now = new Date();
  const features = [];
  const severity = ['low', 'medium', 'high', 'critical'];
  
  for (let i = 0; i < 60; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const intensity = Math.floor(20 + Math.random() * 180);
    const severityLevel = intensity > 120 ? 'critical' : intensity > 80 ? 'high' : intensity > 40 ? 'medium' : 'low';
    
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [region.lng, region.lat]
      },
      properties: {
        name: `Пожар в ${region.name}`,
        region: region.name,
        date: date.toISOString().slice(0,10),
        fires: intensity,
        intensity: intensity,
        severity: severityLevel,
        frp: Math.round((Math.random() * 100 + 10) * 100) / 100,
        confidence: Math.round((50 + Math.random() * 50) * 10) / 10,
        lat: region.lat,
        lng: region.lng
      }
    });
  }
  return features;
}

async function collectFires() {
  try {
    console.log('[FIRES] Начинаем сбор данных о пожарах...');
    const features = generateFeatures();
    
    const data = {
      type: 'FeatureCollection',
      features: features,
      metadata: {
        source: 'FIRMS (NASA) — демо-данные',
        total: features.length,
        updated: new Date().toISOString(),
        attribution: 'Данные сгенерированы на основе реальных координат пожароопасных зон'
      }
    };
    
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[FIRES] ✅ Сохранено ${features.length} записей в ${BASKET_PATH}`);
    console.log(`[FIRES] ✅ Первая запись:`, features[0].properties);
    return data;
  } catch (error) {
    console.error(`[FIRES] ❌ Ошибка: ${error.message}`);
    throw error;
  }
}

console.log('[FIRES] Запуск сборщика...');
collectFires().then(() => console.log('[FIRES] ✅ Готово!')).catch(console.error);
