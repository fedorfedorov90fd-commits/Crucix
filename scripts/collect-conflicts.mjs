#!/usr/bin/env node

// ============================================================
// СБОР ДАННЫХ О КОНФЛИКТАХ (ACLED)
// Источник: ACLED API
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'data', 'conflicts', 'history.json');

// Страны для мониторинга
const COUNTRIES = ['Ukraine', 'Syria', 'Yemen', 'Sudan', 'Myanmar'];

async function fetchAcled(country) {
  // ACLED API (требуется ключ)
  // Пока генерируем тестовые данные
  return generateTestConflicts(country);
}

function generateTestConflicts(country) {
  const data = [];
  const now = new Date();
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    // Случайное количество событий
    const base = 10 + Math.sin(i / 3) * 8;
    const value = Math.round(Math.max(0, base + Math.random() * 15) * 100) / 100;
    data.push({ date, value, country });
  }
  return data;
}

async function collectConflicts() {
  console.log('[Conflicts] Начинаю сбор данных...');
  
  let allData = [];
  for (const country of COUNTRIES) {
    const data = await fetchAcled(country);
    allData = allData.concat(data);
    console.log(`[Conflicts] Страна ${country}: ${data.length} записей`);
  }
  
  // Агрегируем по дням
  const daily = {};
  for (const item of allData) {
    if (!daily[item.date]) daily[item.date] = 0;
    daily[item.date] += item.value;
  }
  
  const result = Object.entries(daily)
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));
  
  await fs.mkdir(join(ROOT, 'data', 'conflicts'), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(result, null, 2));
  
  console.log(`[Conflicts] Сохранено ${result.length} дней данных в ${OUTPUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectConflicts().catch(console.error);
}

export default collectConflicts;