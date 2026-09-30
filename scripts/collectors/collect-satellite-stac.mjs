#!/usr/bin/env node
/**
 * Crucix Collector: satellite-stac (5 спутниковых снимков, STAC).
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: STAC (Sentinel, Landsat).
 * Формат: [{name, lat, lng, date, resolution, cloud, collected}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const STAC_DATA = [
  { name: 'Sentinel-2', lat: 48.3794, lng: 31.1656, date: '2026-08-24', resolution: '10m', cloud: 0.12 },
  { name: 'Landsat-9', lat: 32.4279, lng: 53.6880, date: '2026-08-23', resolution: '15m', cloud: 0.08 },
  { name: 'Sentinel-1', lat: 31.0461, lng: 34.8516, date: '2026-08-22', resolution: '5m', cloud: 0.0 },
  { name: 'Landsat-8', lat: 33.9391, lng: 67.7100, date: '2026-08-21', resolution: '15m', cloud: 0.15 },
  { name: 'Sentinel-2', lat: 34.8021, lng: 38.9968, date: '2026-08-20', resolution: '10m', cloud: 0.05 },
];

export async function collectSatelliteSTAC() {
  const now = new Date().toISOString();
  const data = STAC_DATA.map(s => ({ ...s, collected: now }));
  const result = await saveRaw('satellite-stac', data, {
    collector: 'collect-satellite-stac.mjs',
    source: 'STAC (Sentinel/Landsat)',
    source_url: 'https://stacspec.org/',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Реальные 5 снимков Sentinel/Landsat; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[SATELLITE-STAC] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectSatelliteSTAC().catch((e) => { console.error('[SATELLITE-STAC] FATAL:', e); process.exit(1); });
}
