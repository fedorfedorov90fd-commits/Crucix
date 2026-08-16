#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'ofac.json');

const DEMO_DATA = {
  entities: [
    { id: 'ofac-001', name: 'Entity A', type: 'entity', country: 'Иран', sanctions: ['OFAC', 'UN'], dateAdded: '2024-01-15', status: 'active' },
    { id: 'ofac-002', name: 'Entity B', type: 'entity', country: 'Россия', sanctions: ['OFAC', 'EU'], dateAdded: '2024-02-01', status: 'active' },
    { id: 'ofac-003', name: 'Person C', type: 'individual', country: 'Северная Корея', sanctions: ['UN'], dateAdded: '2024-02-15', status: 'active' },
    { id: 'ofac-004', name: 'Entity D', type: 'entity', country: 'Иран', sanctions: ['OFAC'], dateAdded: '2024-03-01', status: 'active' },
    { id: 'ofac-005', name: 'Person E', type: 'individual', country: 'Россия', sanctions: ['EU'], dateAdded: '2024-03-15', status: 'active' }
  ],
  summary: {
    total: 5,
    byCountry: { 'Иран': 2, 'Россия': 2, 'Северная Корея': 1 },
    byType: { 'entity': 3, 'individual': 2 },
    bySanction: { 'OFAC': 3, 'UN': 2, 'EU': 2 }
  }
};

async function collect() {
  try {
    const entry = {
      id: `ofac-${new Date().toISOString().slice(0, 10)}`,
      type: 'ofac',
      date: new Date().toISOString(),
      data: DEMO_DATA,
      source: 'demo'
    };
    await fs.mkdir(join(ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(entry, null, 2));
    console.log('✅ OFAC сохранён в корзину');
  } catch (e) {
    console.error('❌ Ошибка сбора OFAC:', e.message);
  }
}
collect();
