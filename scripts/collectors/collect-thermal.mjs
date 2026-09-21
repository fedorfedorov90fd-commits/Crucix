#!/usr/bin/env node
/**
 * Crucix Collector: thermal (FIRMS-совместимый, 3 региона) — demo.
 * Версия 2.0.1. Принят 20.09.2026.
 *
 * Изменения от 2.0.0:
 *   - regions переименовано в meta.regions, perRegion в meta.perRegion.
 *     Это освобождает ключ regions для unwrapWrapper (чтобы адаптер нашёл
 *     daily, а не regions с {id,lat,lon,radius}).
 *   - daily остаётся в корне как основной временной ряд.
 *   - perRegion остаётся как справочные метаданные.
 *
 * ВЫХОД: data/raw/thermal-<timestamp>.json + накладная.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = [
  { id: 'ukraine', lat: 48.5, lon: 31.5, radius: 500 },
  { id: 'middle_east', lat: 30.0, lon: 45.0, radius: 800 },
  { id: 'russia', lat: 60.0, lon: 90.0, radius: 1000 },
];

const DAYS_BACK = 30;

function generateTestThermal(region) {
  const data = [];
  const now = new Date();
  for (let i = DAYS_BACK; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const base = 50 + Math.sin(i / 5) * 30;
    const value = Math.round((base + Math.random() * 40) * 100) / 100;
    data.push({ date, value, region: region.id });
  }
  return data;
}

export async function collectThermal() {
  console.log('[Thermal] Сбор...');
  const allData = [];
  for (const region of REGIONS) {
    const data = generateTestThermal(region);
    allData.push(...data);
  }

  const daily = {};
  for (const item of allData) {
    if (!daily[item.date]) daily[item.date] = 0;
    daily[item.date] += item.value;
  }
  const aggregated = Object.entries(daily)
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const payload = {
    source: 'NASA FIRMS (demo)',
    daily: aggregated,
    meta: {
      regions: REGIONS,
      perRegion: allData,
      total: aggregated.length,
    },
  };

  const result = await saveRaw('thermal', payload, {
    collector: 'collect-thermal.mjs',
    source: 'NASA FIRMS (demo)',
    source_url: 'https://firms.modaps.eosdis.nasa.gov/api/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'count',
    value_unit: 'detections',
    granularity: 'daily',
    period: 'P30D',
    record_count: aggregated.length,
    notes: 'Demo: 3 региона × 31 день; regions/perRegion в meta; daily в корне; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Thermal] OK ${aggregated.length}
агрегировано. длина}
 → ${result.raw_file}
результат. raw_file}
`);
  return payload;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectThermal().catch(e => { console.error('[Thermal] FATAL:', e.message); process.exit(1); });
}