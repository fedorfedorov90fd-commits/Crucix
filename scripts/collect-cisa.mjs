#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'cisa.json');

const DEMO_DATA = {
  vulnerabilities: [
    { id: 'CVE-2024-12345', vendor: 'Microsoft', product: 'Windows 11', name: 'Windows 11 Privilege Escalation', dateAdded: '2024-01-15', dueDate: '2024-07-15', severity: 'CRITICAL', status: 'active' },
    { id: 'CVE-2024-12346', vendor: 'Adobe', product: 'Reader', name: 'Adobe Reader Remote Code Execution', dateAdded: '2024-01-20', dueDate: '2024-07-20', severity: 'HIGH', status: 'active' },
    { id: 'CVE-2024-12347', vendor: 'Google', product: 'Chrome', name: 'Chrome V8 Type Confusion', dateAdded: '2024-02-01', dueDate: '2024-08-01', severity: 'CRITICAL', status: 'active' },
    { id: 'CVE-2024-12348', vendor: 'Apple', product: 'iOS', name: 'iOS Kernel Memory Corruption', dateAdded: '2024-02-10', dueDate: '2024-08-10', severity: 'HIGH', status: 'active' },
    { id: 'CVE-2024-12349', vendor: 'Linux', product: 'Kernel', name: 'Linux Kernel Use-After-Free', dateAdded: '2024-02-15', dueDate: '2024-08-15', severity: 'HIGH', status: 'active' }
  ],
  summary: {
    total: 5,
    byVendor: { 'Microsoft': 1, 'Adobe': 1, 'Google': 1, 'Apple': 1, 'Linux': 1 },
    bySeverity: { 'CRITICAL': 2, 'HIGH': 3 },
    byStatus: { 'active': 5 }
  }
};

async function collect() {
  try {
    const entry = {
      id: `cisa-${new Date().toISOString().slice(0, 10)}`,
      type: 'cisa',
      date: new Date().toISOString(),
      data: DEMO_DATA,
      source: 'demo'
    };
    await fs.mkdir(join(ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(entry, null, 2));
    console.log('✅ CISA сохранён в корзину');
  } catch (e) {
    console.error('❌ Ошибка сбора CISA:', e.message);
  }
}
collect();
