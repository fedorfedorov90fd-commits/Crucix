#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'usgs.json');

const DEMO_DATA = {
  earthquakes: [
    { id: 'usgs-001', magnitude: 4.2, place: 'Калифорния, США', time: '2026-08-16T10:30:00Z', depth: 8.5, lat: 34.0, lng: -118.0 },
    { id: 'usgs-002', magnitude: 5.8, place: 'Индонезия', time: '2026-08-16T08:15:00Z', depth: 12.0, lat: -8.0, lng: 115.0 },
    { id: 'usgs-003', magnitude: 3.1, place: 'Италия', time: '2026-08-16T06:45:00Z', depth: 5.0, lat: 42.5, lng: 13.0 },
    { id: 'usgs-004', magnitude: 6.2, place: 'Япония', time: '2026-08-16T04:20:00Z', depth: 22.0, lat: 35.0, lng: 140.0 },
    { id: 'usgs-005', magnitude: 2.8, place: 'Турция', time: '2026-08-16T02:10:00Z', depth: 3.5, lat: 39.0, lng: 35.0 }
  ],
  summary: {
    total: 5,
    maxMagnitude: 6.2,
    avgDepth: 10.2,
    byRegion: { 'США': 1, 'Индонезия': 1, 'Италия': 1, 'Япония': 1, 'Турция': 1 }
  }
};

async function collect() {
  try {
    const entry = {
      id: `usgs-${new Date().toISOString().slice(0, 10)}`,
      type: 'usgs',
      date: new Date().toISOString(),
      data: DEMO_DATA,
      source: 'demo'
    };
    await fs.mkdir(join(ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(entry, null, 2));
    console.log('✅ USGS сохранён в корзину');
  } catch (e) {
    console.error('❌ Ошибка сбора USGS:', e.message);
  }
}
collect();
