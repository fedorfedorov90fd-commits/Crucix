#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'eia.json');

const DEMO_DATA = {
  prices: [
    { id: 'eia-001', name: 'WTI Crude', price: 112.06, unit: '$/bbl', change: '+3.2%', source: 'EIA' },
    { id: 'eia-002', name: 'Brent Crude', price: 109.05, unit: '$/bbl', change: '+2.8%', source: 'EIA' },
    { id: 'eia-003', name: 'Natural Gas', price: 2.81, unit: '$/MMBtu', change: '-1.2%', source: 'EIA' },
    { id: 'eia-004', name: 'Gasoline', price: 3.45, unit: '$/gallon', change: '+1.5%', source: 'EIA' },
    { id: 'eia-005', name: 'Heating Oil', price: 4.12, unit: '$/gallon', change: '+0.8%', source: 'EIA' }
  ],
  summary: {
    total: 5,
    avgPrice: 46.3,
    maxPrice: 112.06,
    minPrice: 2.81,
    byType: { 'Crude': 2, 'Gas': 3 }
  }
};

async function collect() {
  try {
    const entry = {
      id: `eia-${new Date().toISOString().slice(0, 10)}`,
      type: 'eia',
      date: new Date().toISOString(),
      data: DEMO_DATA,
      source: 'demo'
    };
    await fs.mkdir(join(ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(entry, null, 2));
    console.log('✅ EIA сохранён в корзину');
  } catch (e) {
    console.error('❌ Ошибка сбора EIA:', e.message);
  }
}
collect();
