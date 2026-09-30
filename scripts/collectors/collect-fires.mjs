#!/usr/bin/env node
/**
 * Crucix Collector: fires (пожары, FIRMS-совместимые) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo с реальными координатами пожароопасных зон → saveRaw.
 * Источник: NASA FIRMS (https://firms.modaps.eosdis.nasa.gov/).
 * Формат: [{name, region, lat, lng, date, fires, intensity, severity, frp, confidence}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = [
  { name: 'Amazon', lat: -5.0, lng: -60.0 },
  { name: 'California', lat: 37.0, lng: -120.0 },
  { name: 'Siberia', lat: 60.0, lng: 100.0 },
  { name: 'Australia', lat: -25.0, lng: 135.0 },
  { name: 'Greece', lat: 38.0, lng: 23.0 },
  { name: 'Turkey', lat: 39.0, lng: 35.0 },
  { name: 'Canada', lat: 55.0, lng: -100.0 },
  { name: 'Indonesia', lat: -3.0, lng: 118.0 },
  { name: 'Brazil', lat: -15.0, lng: -55.0 },
  { name: 'Spain', lat: 40.0, lng: -4.0 },
  { name: 'Portugal', lat: 39.5, lng: -8.0 },
  { name: 'Italy', lat: 42.0, lng: 12.0 },
  { name: 'Russia', lat: 55.0, lng: 40.0 },
  { name: 'South Africa', lat: -30.0, lng: 25.0 },
  { name: 'India', lat: 20.0, lng: 78.0 },
  { name: 'China', lat: 35.0, lng: 105.0 },
  { name: 'Japan', lat: 36.0, lng: 138.0 },
  { name: 'Mexico', lat: 23.0, lng: -102.0 },
  { name: 'Argentina', lat: -35.0, lng: -65.0 },
];

function generateData() {
  const now = new Date();
  const features = [];
  for (let i = 0; i < 60; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const intensity = Math.floor(20 + Math.random() * 180);
    const severity = intensity > 120 ? 'critical' : intensity > 80 ? 'high' : intensity > 40 ? 'medium' : 'low';
    features.push({
      name: `Пожар в ${region.name}`,
      region: region.name,
      lat: region.lat,
      lng: region.lng,
      date: date.toISOString().slice(0, 10),
      fires: intensity,
      intensity,
      severity,
      frp: Math.round((Math.random() * 100 + 10) * 100) / 100,
      confidence: Math.round((50 + Math.random() * 50) * 10) / 10,
    });
  }
  return features;
}

export async function collectFires() {
  console.log('[FIRES] Начинаем сбор...');
  const data = generateData();
  const result = await saveRaw('fires', data, {
    collector: 'collect-fires.mjs',
    source: 'NASA FIRMS (demo)',
    source_url: 'https://firms.modaps.eosdis.nasa.gov/',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'fires',
    granularity: 'event',
    period: 'P60D',
    record_count: data.length,
    notes: 'Демо-данные с реальными координатами пожароопасных зон; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[FIRES] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectFires().catch((e) => { console.error('[FIRES] FATAL:', e); process.exit(1); });
}
