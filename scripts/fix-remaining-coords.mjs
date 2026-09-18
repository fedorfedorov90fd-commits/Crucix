#!/usr/bin/env node

// ============================================================
// FIX-REMAINING-COORDS.MJS — Исправление noaa, safecast, usgs
// ============================================================

import fs from 'fs/promises';
import path from 'path';

const BASKET_DIR = path.join(process.cwd(), 'data', 'basket');

const LAYERS = ['noaa', 'safecast', 'usgs'];

async function fixLayer(layerId) {
  const filePath = path.join(BASKET_DIR, `${layerId}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    console.log(`\n📂 ${layerId}:`);
    
    // Проверяем структуру
    if (data.data && data.data.stations) {
      // noaa
      const features = data.data.stations.map(station => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [station.lng || station.lon || 0, station.lat || 0]
        },
        properties: {
          name: station.name || 'Станция',
          id: station.id,
          temp: station.temp,
          condition: station.condition,
          wind: station.wind,
          severity: 'low'
        }
      }));
      const result = {
        type: 'FeatureCollection',
        features: features,
        _meta: { source: layerId, updated: new Date().toISOString() }
      };
      await fs.writeFile(filePath, JSON.stringify(result, null, 2));
      console.log(`  ✅ Сохранено ${features.length} станций`);
      return true;
    }
    
    if (data.data && data.data.sites) {
      // safecast
      const features = data.data.sites.map(site => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [site.lng || site.lon || 0, site.lat || 0]
        },
        properties: {
          name: site.name || 'Станция',
          reading: site.reading,
          level: site.level,
          severity: site.level === 'critical' ? 'high' : 'medium'
        }
      }));
      const result = {
        type: 'FeatureCollection',
        features: features,
        _meta: { source: layerId, updated: new Date().toISOString() }
      };
      await fs.writeFile(filePath, JSON.stringify(result, null, 2));
      console.log(`  ✅ Сохранено ${features.length} объектов`);
      return true;
    }
    
    if (data.data && data.data.earthquakes) {
      // usgs
      const features = data.data.earthquakes.map(eq => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [eq.lng || eq.lon || 0, eq.lat || 0]
        },
        properties: {
          name: eq.place || 'Землетрясение',
          magnitude: eq.magnitude,
          depth: eq.depth,
          time: eq.time,
          severity: eq.magnitude > 5 ? 'high' : eq.magnitude > 3 ? 'medium' : 'low'
        }
      }));
      const result = {
        type: 'FeatureCollection',
        features: features,
        _meta: { source: layerId, updated: new Date().toISOString() }
      };
      await fs.writeFile(filePath, JSON.stringify(result, null, 2));
      console.log(`  ✅ Сохранено ${features.length} землетрясений`);
      return true;
    }
    
    console.log(`  ⚠️ Структура не распознана`);
    return false;
  } catch (err) {
    console.error(`  ❌ Ошибка: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🔧 ИСПРАВЛЕНИЕ noaa, safecast, usgs\n');
  console.log('═'.repeat(50));
  
  let fixed = 0;
  for (const layerId of LAYERS) {
    const result = await fixLayer(layerId);
    if (result) fixed++;
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`✅ Исправлено слоёв: ${fixed}/${LAYERS.length}`);
}

main().catch(console.error);
