#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'who.json');

const DEMO_DATA = {
  alerts: [
    { id: 'who-001', disease: 'Ebola', country: 'Демократическая Республика Конго', status: 'active', risk: 'high', date: '2026-08-10', source: 'WHO' },
    { id: 'who-002', disease: 'Cholera', country: 'Йемен', status: 'active', risk: 'high', date: '2026-08-12', source: 'WHO' },
    { id: 'who-003', disease: 'Dengue', country: 'Бразилия', status: 'active', risk: 'medium', date: '2026-08-14', source: 'WHO' },
    { id: 'who-004', disease: 'Monkeypox', country: 'Нигерия', status: 'active', risk: 'medium', date: '2026-08-15', source: 'WHO' },
    { id: 'who-005', disease: 'Polio', country: 'Пакистан', status: 'active', risk: 'high', date: '2026-08-16', source: 'WHO' }
  ],
  summary: {
    total: 5,
    byRisk: { 'high': 3, 'medium': 2 },
    byStatus: { 'active': 5 },
    byCountry: { 'ДР Конго': 1, 'Йемен': 1, 'Бразилия': 1, 'Нигерия': 1, 'Пакистан': 1 }
  }
};

async function collect() {
  try {
    const entry = {
      id: `who-${new Date().toISOString().slice(0, 10)}`,
      type: 'who',
      date: new Date().toISOString(),
      data: DEMO_DATA,
      source: 'demo'
    };
    await fs.mkdir(join(ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(entry, null, 2));
    console.log('✅ WHO сохранён в корзину');
  } catch (e) {
    console.error('❌ Ошибка сбора WHO:', e.message);
  }
}
collect();
