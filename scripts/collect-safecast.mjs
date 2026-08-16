#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'safecast.json');

const DEMO_DATA = {
  sites: [
    { id: 'demo-1', name: 'Запорожская АЭС', lat: 47.5122, lng: 34.8347, reading: 85.3, level: 'elevated' },
    { id: 'demo-2', name: 'Чернобыльская Зона', lat: 51.389, lng: 30.099, reading: 33.3, level: 'normal' },
    { id: 'demo-3', name: 'Фукусима-1', lat: 37.4214, lng: 141.0325, reading: 69.5, level: 'elevated' },
    { id: 'demo-4', name: 'АЭС Бушер', lat: 28.8309, lng: 50.8865, reading: null, level: 'unknown' },
    { id: 'demo-5', name: 'Ёнбён (Северная Корея)', lat: 39.796, lng: 125.758, reading: null, level: 'unknown' },
    { id: 'demo-6', name: 'Димона (Израиль)', lat: 31.0, lng: 35.0, reading: 29.5, level: 'normal' }
  ],
  summary: {
    total: 6,
    byLevel: { normal: 2, elevated: 2, critical: 0, unknown: 2 },
    average: 54.4,
    max: 85.3,
    maxSite: 'Запорожская АЭС'
  },
  anomalies: [
    { site: 'Запорожская АЭС', reading: 85.3, description: 'Повышенный уровень радиации' }
  ]
};

async function collect() {
  try {
    const entry = {
      id: `safecast-${new Date().toISOString().slice(0, 10)}`,
      type: 'safecast',
      date: new Date().toISOString(),
      data: DEMO_DATA,
      source: 'demo'
    };
    await fs.mkdir(join(ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(entry, null, 2));
    console.log('✅ SafeCast сохранён в корзину');
  } catch (e) {
    console.error('❌ Ошибка сбора SafeCast:', e.message);
  }
}
collect();
