#!/usr/bin/env node

// ============================================================
// СБОР ЭКОНОМИЧЕСКИХ ДАННЫХ (FRED)
// Источник: FRED API
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'data', 'economy', 'history.json');

// Индикаторы для мониторинга
const INDICATORS = [
  { id: 'VIXCLS', name: 'VIX' },
  { id: 'DGS10', name: '10Y Treasury' },
  { id: 'DAAA', name: 'Corporate AAA' }
];

async function fetchFred(indicator) {
  // Для теста генерируем данные
  return generateTestEconomy(indicator);
}

function generateTestEconomy(indicator) {
  const data = [];
  const now = new Date();
  const baseValue = indicator.id === 'VIXCLS' ? 20 : 
                    indicator.id === 'DGS10' ? 4.3 : 5.2;
  const volatility = indicator.id === 'VIXCLS' ? 0.3 : 0.1;
  
  for (let i = 30; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const value = Math.round((baseValue + (Math.random() - 0.5) * volatility * 2) * 100) / 100;
    data.push({ date, value, indicator: indicator.id });
  }
  return data;
}

async function collectEconomy() {
  console.log('[Economy] Начинаю сбор данных...');
  
  let allData = [];
  for (const indicator of INDICATORS) {
    const data = await fetchFred(indicator);
    allData = allData.concat(data);
    console.log(`[Economy] Индикатор ${indicator.id}: ${data.length} записей`);
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
  
  await fs.mkdir(join(ROOT, 'data', 'economy'), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(result, null, 2));
  
  console.log(`[Economy] Сохранено ${result.length} дней данных в ${OUTPUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  collectEconomy().catch(console.error);
}

export default collectEconomy;