#!/usr/bin/env node
/**
 * Crucix Collector: viirs (ночные огни, 5 регионов × 31 день) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{date, region, lat, lon, brightness}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = [
  { name: 'Украина', lat: 49, lon: 31 },
  { name: 'Россия', lat: 60, lon: 90 },
  { name: 'США', lat: 40, lon: -100 },
  { name: 'Китай', lat: 35, lon: 105 },
  { name: 'Европа', lat: 50, lon: 10 },
];

function generateData() {
  const now = new Date();
  const data = [];
  for (const region of REGIONS) {
    for (let i = 30; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const brightness = Math.round((50 + (i / 30) * 20 + (Math.random() - 0.5) * 15) * 100) / 100;
      data.push({
        date: date.toISOString().split('T')[0],
        region: region.name,
        lat: region.lat,
        lon: region.lon,
        brightness: Math.max(0, brightness),
      });
    }
  }
  return data;
}

export async function collectVIIRS() {
  const data = generateData();
  const result = await saveRaw('viirs', data, {
    collector: 'collect-viirs.mjs',
    source: 'VIIRS night lights (demo)',
    source_url: 'https://www.earthdata.nasa.gov/',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'index',
    value_unit: 'brightness',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: `Demo: ${REGIONS.length} регионов × 31 день = ${data.length}; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[VIIRS] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectVIIRS().catch(e => { console.error('[VIIRS] FATAL:', e.message); process.exit(1); });
}
