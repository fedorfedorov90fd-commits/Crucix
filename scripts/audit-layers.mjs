#!/usr/bin/env node

// ============================================================
// AUDIT-LAYERS.MJS — Детальный аудит всех слоёв
// Запуск: node scripts/audit-layers.mjs
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import { LAYER_REGISTRY } from '../apis/layer-manager/index.mjs';

const BASKET_DIR = path.join(process.cwd(), 'data', 'basket');

async function auditLayer(layerId, meta) {
  const filePaths = [
    path.join(BASKET_DIR, `${layerId}.json`),
    path.join(BASKET_DIR, `${layerId}-latest.json`),
    path.join(BASKET_DIR, `${layerId}-data.json`),
    path.join(BASKET_DIR, `${layerId}.geojson`)
  ];
  
  let fileExists = false;
  let fileSize = 0;
  let hasCoords = false;
  let hasCountry = false;
  let sampleData = null;
  
  for (const filePath of filePaths) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        fileExists = true;
        fileSize = stat.size;
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        sampleData = data;
        
        // Проверяем наличие координат
        if (Array.isArray(data)) {
          hasCoords = data.some(item => item.lat || item.latitude || item.lng || item.lon || item.longitude);
          hasCountry = data.some(item => item.country || item.name);
        } else if (data.features) {
          hasCoords = data.features.some(f => f.geometry?.coordinates || f.lat || f.lng);
          hasCountry = data.features.some(f => f.properties?.country || f.properties?.name);
        } else if (data.data && data.data.entities) {
          hasCountry = true;
        }
        break;
      }
    } catch (err) {}
  }
  
  const vizType = meta.visualizationType || 'marker';
  const defaultLat = meta.defaultLat || 0;
  const defaultLng = meta.defaultLng || 0;
  
  let status = '⚠️ Нет данных';
  let reason = '';
  
  if (!fileExists) {
    status = '❌ Нет файла';
    reason = 'Требуется создать файл';
  } else if (vizType === 'marker' && !hasCoords && (defaultLat === 0 && defaultLng === 0)) {
    status = '⚠️ Нет координат';
    reason = 'Добавить координаты или задать defaultLat/defaultLng';
  } else if (vizType === 'choropleth' && !hasCountry) {
    status = '⚠️ Нет данных по странам';
    reason = 'Добавить country/value';
  } else {
    status = '✅ OK';
    reason = 'Данные есть и корректны';
  }
  
  return {
    id: layerId,
    name: meta.name,
    category: meta.category || 'other',
    vizType,
    fileExists,
    fileSize,
    hasCoords,
    hasCountry,
    defaultLat,
    defaultLng,
    status,
    reason,
    sampleData: sampleData ? JSON.stringify(sampleData).slice(0, 200) : null
  };
}

async function main() {
  console.log('\n📋 АУДИТ ВСЕХ СЛОЁВ CRUCIX\n');
  console.log('═'.repeat(80));
  
  const layers = Object.entries(LAYER_REGISTRY);
  console.log(`Всего слоёв: ${layers.length}\n`);
  
  const results = [];
  let ok = 0, noFile = 0, noCoords = 0, noCountry = 0;
  
  for (const [id, meta] of layers) {
    const audit = await auditLayer(id, meta);
    results.push(audit);
    if (audit.status === '✅ OK') ok++;
    else if (audit.status === '❌ Нет файла') noFile++;
    else if (audit.status === '⚠️ Нет координат') noCoords++;
    else if (audit.status === '⚠️ Нет данных по странам') noCountry++;
  }
  
  // Вывод сводки
  console.log('📊 СТАТИСТИКА:');
  console.log(`  ✅ OK: ${ok}`);
  console.log(`  ❌ Нет файла: ${noFile}`);
  console.log(`  ⚠️ Нет координат: ${noCoords}`);
  console.log(`  ⚠️ Нет данных по странам: ${noCountry}`);
  console.log(`  Всего: ${layers.length}`);
  
  // Детали по проблемным слоям
  console.log('\n🔴 ПРОБЛЕМНЫЕ СЛОИ:');
  console.log('═'.repeat(80));
  
  const problems = results.filter(r => r.status !== '✅ OK');
  for (const r of problems) {
    console.log(`\n[${r.status}] ${r.id} (${r.name})`);
    console.log(`  Категория: ${r.category}, Тип: ${r.vizType}`);
    console.log(`  Файл: ${r.fileExists ? `есть (${r.fileSize} байт)` : 'отсутствует'}`);
    if (r.vizType === 'marker') {
      console.log(`  Координаты: ${r.hasCoords ? 'есть' : 'нет'}`);
      console.log(`  defaultLat/Lng: ${r.defaultLat}, ${r.defaultLng}`);
    }
    if (r.vizType === 'choropleth') {
      console.log(`  Данные по странам: ${r.hasCountry ? 'есть' : 'нет'}`);
    }
    console.log(`  Причина: ${r.reason}`);
    if (r.sampleData) {
      console.log(`  Образец: ${r.sampleData}...`);
    }
  }
  
  console.log('\n✅ Аудит завершён.');
}

main().catch(console.error);
