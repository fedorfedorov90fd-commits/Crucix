#!/usr/bin/env node

// ============================================================
// GENERATE-ALL-MISSING.MJS — Пакетное создание недостающих слоёв
// Запуск: node scripts/generate-all-missing.mjs
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LAYER_REGISTRY } from '../apis/layer-manager/index.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const GEO_DIR = join(__dirname, '..', 'data', 'geo');

// ============================================================
// 1. СПИСОК СТРАН (из geo-countries.json)
// ============================================================
let countries = [];

async function loadCountries() {
  try {
    const geoPath = join(GEO_DIR, 'geo-countries.json');
    const content = await fs.readFile(geoPath, 'utf-8');
    const data = JSON.parse(content);
    if (Array.isArray(data)) {
      countries = data.map(c => c.name || c.country || 'Unknown');
    } else if (data.features) {
      countries = data.features.map(f => f.properties?.name || f.properties?.NAME || 'Unknown');
    }
    if (countries.length === 0) {
      // Запасной список
      countries = ['США', 'Россия', 'Китай', 'Индия', 'Бразилия', 'Великобритания', 'Германия', 'Франция', 'Япония', 'Италия', 'Канада', 'Австралия', 'Мексика', 'Турция', 'Иран', 'Египет', 'ЮАР', 'Аргентина', 'Украина', 'Польша', 'Испания', 'Нидерланды', 'Бельгия', 'Швеция', 'Норвегия', 'Дания', 'Финляндия', 'Ирландия', 'Португалия', 'Греция', 'Швейцария', 'Австрия', 'Чехия', 'Венгрия', 'Румыния', 'Болгария', 'Хорватия', 'Словакия', 'Словения', 'Литва', 'Латвия', 'Эстония', 'Кипр', 'Мальта', 'Люксембург', 'Израиль', 'Саудовская Аравия', 'ОАЭ', 'Катар', 'Кувейт', 'Оман', 'Иордания', 'Ливан', 'Ирак', 'Сирия', 'Йемен', 'Афганистан', 'Пакистан', 'Бангладеш', 'Шри-Ланка', 'Непал', 'Мьянма', 'Таиланд', 'Вьетнам', 'Индонезия', 'Филиппины', 'Малайзия', 'Сингапур', 'Тайвань', 'Новая Зеландия'];
    }
    console.log(`📋 Загружено стран: ${countries.length}`);
  } catch (err) {
    console.warn('⚠️ Не удалось загрузить страны, используем запасной список');
    countries = ['США', 'Россия', 'Китай', 'Индия', 'Бразилия', 'Великобритания', 'Германия', 'Франция', 'Япония'];
  }
}

// ============================================================
// 2. ГЕНЕРАЦИЯ ДАННЫХ ДЛЯ МАРКЕРНЫХ СЛОЁВ
// ============================================================
function generateMarkerData(layerId, count = 10) {
  const centers = {
    'military-exercises': { lat: 40.0, lng: 40.0 },
    'air-quality': { lat: 30.0, lng: 20.0 },
    'thermal': { lat: 30.0, lng: 20.0 },
    'ocean': { lat: 0.0, lng: 0.0 },
    'pipelines': { lat: 40.0, lng: 30.0 },
    'ports': { lat: 30.0, lng: 20.0 },
    'power-grid': { lat: 30.0, lng: 20.0 },
    'undersea-cables': { lat: 30.0, lng: 20.0 },
    'railways': { lat: 30.0, lng: 20.0 },
    'highways': { lat: 30.0, lng: 20.0 },
    'space-debris': { lat: 0.0, lng: 0.0 },
    'oneweb': { lat: 0.0, lng: 0.0 },
    'space': { lat: 0.0, lng: 0.0 },
    'aurora': { lat: 80.0, lng: 0.0 },
    'weather': { lat: 30.0, lng: 20.0 },
    'hurricanes': { lat: 20.0, lng: -80.0 },
    'earthquakes-other': { lat: 30.0, lng: 20.0 },
    'volcanoes': { lat: 30.0, lng: 20.0 },
    'wildfires': { lat: 30.0, lng: 20.0 },
    'drought': { lat: 30.0, lng: 20.0 },
    'ports-maritime': { lat: 30.0, lng: 20.0 },
    'shipping-lanes': { lat: 30.0, lng: 20.0 },
    'tass': { lat: 55.7558, lng: 37.6173 },
    'interfax': { lat: 55.7558, lng: 37.6173 },
    'ria': { lat: 55.7558, lng: 37.6173 },
    'bbc': { lat: 51.5074, lng: -0.1278 },
    'cve': { lat: 40.0, lng: -75.0 },
    'botnets': { lat: 45.0, lng: 35.0 },
    'malware': { lat: 50.0, lng: 10.0 },
    'darkweb': { lat: 40.0, lng: 10.0 },
    'ransomware': { lat: 30.0, lng: 40.0 },
    'phishing': { lat: 35.0, lng: 25.0 },
    'ddos': { lat: 40.0, lng: -70.0 },
  };
  const center = centers[layerId] || { lat: 30.0, lng: 20.0 };
  const data = [];
  for (let i = 0; i < count; i++) {
    const latOffset = (Math.random() - 0.5) * 20;
    const lngOffset = (Math.random() - 0.5) * 20;
    data.push({
      id: `${layerId}-${String(i + 1).padStart(3, '0')}`,
      name: `${layerId} #${i + 1}`,
      lat: center.lat + latOffset,
      lng: center.lng + lngOffset,
      severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
      timestamp: new Date().toISOString()
    });
  }
  return data;
}

// ============================================================
// 3. ГЕНЕРАЦИЯ ДАННЫХ ДЛЯ CHOROPLETH-СЛОЁВ
// ============================================================
function generateChoroplethData(layerId) {
  const now = new Date();
  const data = countries.map((country, index) => {
    let value = 0;
    // Разные диапазоны для разных слоёв
    switch (layerId) {
      case 'urbanization': value = 20 + Math.random() * 70; break;
      case 'renewable': value = 5 + Math.random() * 60; break;
      case 'nuclear': value = 0 + Math.random() * 30; break;
      case 'internet': value = 10 + Math.random() * 80; break;
      case 'mobile': value = 30 + Math.random() * 60; break;
      case 'education': value = 40 + Math.random() * 50; break;
      case 'healthcare': value = 30 + Math.random() * 60; break;
      case 'military-spending': value = 0.5 + Math.random() * 8; break;
      case 'trade-balance': value = -100 + Math.random() * 200; break;
      case 'poverty': value = 2 + Math.random() * 40; break;
      case 'inequality': value = 20 + Math.random() * 40; break;
      case 'democracy': value = 1 + Math.random() * 9; break;
      case 'corruption': value = 10 + Math.random() * 80; break;
      case 'freedom': value = 10 + Math.random() * 90; break;
      case 'press-freedom': value = 10 + Math.random() * 80; break;
      case 'hdi': value = 0.4 + Math.random() * 0.5; break;
      case 'climate': value = 0 + Math.random() * 100; break;
      case 'epidemics': value = 0 + Math.random() * 50; break;
      case 'bls': value = 2 + Math.random() * 15; break;
      case 'drought': value = 0 + Math.random() * 60; break;
      default: value = Math.random() * 100;
    }
    return {
      country: country,
      value: Math.round(value * 100) / 100,
      date: now.toISOString().slice(0, 10)
    };
  });
  return data;
}

// ============================================================
// 4. СПИСОК СЛОЁВ ДЛЯ ГЕНЕРАЦИИ
// ============================================================
const MARKER_LAYERS = [
  'military-exercises',
  'air-quality',
  'thermal',
  'ocean',
  'pipelines',
  'ports',
  'power-grid',
  'undersea-cables',
  'railways',
  'highways',
  'space-debris',
  'oneweb',
  'space',
  'aurora',
  'weather',
  'hurricanes',
  'earthquakes-other',
  'volcanoes',
  'wildfires',
  'drought',
  'ports-maritime',
  'shipping-lanes',
  'tass',
  'interfax',
  'ria',
  'bbc',
  'cve',
  'botnets',
  'malware',
  'darkweb',
  'ransomware',
  'phishing',
  'ddos',
  'epidemics',
  'bls'
];

const CHOROPLETH_LAYERS = [
  'urbanization',
  'renewable',
  'nuclear',
  'internet',
  'mobile',
  'education',
  'healthcare',
  'military-spending',
  'trade-balance',
  'poverty',
  'inequality',
  'democracy',
  'corruption',
  'freedom',
  'press-freedom',
  'hdi',
  'climate',
  'drought',
  'epidemics',
  'bls'
];

// ============================================================
// 5. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================
async function main() {
  console.log('\n📦 ПАКЕТНОЕ СОЗДАНИЕ НЕДОСТАЮЩИХ СЛОЁВ\n');
  console.log('═'.repeat(50));

  await fs.mkdir(BASKET_DIR, { recursive: true });

  // Загружаем страны
  await loadCountries();

  let markerCount = 0, choroplethCount = 0;

  // Маркерные слои
  console.log('\n📍 Генерация маркерных слоёв...');
  for (const layerId of MARKER_LAYERS) {
    const data = generateMarkerData(layerId, 8 + Math.floor(Math.random() * 12));
    const filePath = join(BASKET_DIR, `${layerId}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log(`  ✅ ${layerId} — ${data.length} записей`);
    markerCount++;
  }

  // Choropleth-слои
  if (countries.length > 0) {
    console.log('\n🌍 Генерация choropleth-слоёв...');
    for (const layerId of CHOROPLETH_LAYERS) {
      const data = generateChoroplethData(layerId);
      const filePath = join(BASKET_DIR, `${layerId}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      console.log(`  ✅ ${layerId} — ${data.length} стран`);
      choroplethCount++;
    }
  } else {
    console.warn('\n⚠️ Не удалось загрузить список стран, choropleth-слои пропущены');
  }

  console.log('\n' + '═'.repeat(50));
  console.log(`📊 ИТОГ:`);
  console.log(`  📍 Маркерных слоёв: ${markerCount}`);
  console.log(`  🌍 Choropleth-слоёв: ${choroplethCount}`);
  console.log(`  📦 Всего создано: ${markerCount + choroplethCount}`);
  console.log('\n✅ Готово!');
}

main().catch(console.error);
