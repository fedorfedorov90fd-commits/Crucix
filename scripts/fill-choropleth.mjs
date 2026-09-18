#!/usr/bin/env node

// ============================================================
// FILL-CHOROPLETH.MJS — Добавление данных по странам
// ============================================================

import fs from 'fs/promises';
import path from 'path';

const BASKET_DIR = path.join(process.cwd(), 'data', 'basket');

// Базовые страны (сокращённый список для демо)
const COUNTRIES = [
  'США', 'Россия', 'Китай', 'Индия', 'Бразилия', 'Великобритания',
  'Германия', 'Франция', 'Япония', 'Италия', 'Канада', 'Австралия',
  'Мексика', 'Турция', 'Иран', 'Египет', 'ЮАР', 'Аргентина',
  'Украина', 'Польша', 'Испания', 'Нидерланды', 'Бельгия', 'Швеция',
  'Норвегия', 'Дания', 'Финляндия', 'Ирландия', 'Португалия', 'Греция'
];

// Функция генерации случайных значений
function randomValue(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// Данные для каждого слоя
const DATA = {
  'big-mac': { min: 2.5, max: 6.5, label: 'price', unit: '$' },
  'big-mac-alt': { min: 2.5, max: 6.5, label: 'price', unit: '$' },
  'big-mac-main': { min: 2.5, max: 6.5, label: 'price', unit: '$' },
  'debt-gdp': { min: 30, max: 250, label: 'debt', unit: '%' },
  'social-unrest': { min: 10, max: 90, label: 'index', unit: '' },
  'consumer-confidence': { min: 40, max: 120, label: 'index', unit: '' },
  'happiness': { min: 3, max: 8, label: 'score', unit: '' },
  'happiness-alt': { min: 3, max: 8, label: 'score', unit: '' },
  'cisa': { min: 1, max: 50, label: 'vulnerabilities', unit: '' },
  'eia': { min: 50, max: 200, label: 'price', unit: '$' },
  'oil-gas': { min: 5, max: 40, label: 'ratio', unit: '' },
  'who': { min: 1, max: 100, label: 'alerts', unit: '' },
  'covid': { min: 100, max: 100000, label: 'cases', unit: '' },
  'fred': { min: 2, max: 10, label: 'gdp', unit: 'трлн $' },
  'comtrade': { min: 100, max: 1000, label: 'trade', unit: 'млрд $' },
  'inflation': { min: 1, max: 15, label: 'inflation', unit: '%' }
};

async function fillLayer(layerId) {
  const config = DATA[layerId];
  if (!config) {
    console.log(`  ⚠️ ${layerId}: нет конфигурации`);
    return false;
  }
  
  const filePath = path.join(BASKET_DIR, `${layerId}.json`);
  const features = COUNTRIES.map(country => ({
    type: 'Feature',
    properties: {
      name: country,
      value: randomValue(config.min, config.max),
      label: config.label,
      unit: config.unit
    }
  }));
  
  const result = {
    type: 'FeatureCollection',
    features: features,
    _meta: {
      source: `demo-${layerId}`,
      updated: new Date().toISOString(),
      total: features.length
    }
  };
  
  await fs.writeFile(filePath, JSON.stringify(result, null, 2));
  console.log(`  ✅ ${layerId}: ${features.length} стран`);
  return true;
}

async function main() {
  console.log('\n🌍 ЗАПОЛНЕНИЕ CHOROPLETH-СЛОЁВ\n');
  console.log('═'.repeat(50));
  
  let filled = 0;
  const layers = Object.keys(DATA);
  for (const layerId of layers) {
    const result = await fillLayer(layerId);
    if (result) filled++;
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Заполнено слоёв: ${filled}/${layers.length}`);
}

main().catch(console.error);
