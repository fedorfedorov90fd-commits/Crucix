#!/usr/bin/env node
/**
 * Crucix Collector: starlink (18 спутников) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{name, lat, lng, type, status, severity, collected}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const SATS = [
  { name: 'Starlink-1001', lat: 53.0, lng: -80.0 }, { name: 'Starlink-1002', lat: 45.0, lng: -120.0 },
  { name: 'Starlink-1003', lat: 30.0, lng: -100.0 }, { name: 'Starlink-1004', lat: 20.0, lng: -60.0 },
  { name: 'Starlink-1005', lat: -15.0, lng: -40.0 }, { name: 'Starlink-1006', lat: -30.0, lng: -20.0 },
  { name: 'Starlink-1007', lat: 40.0, lng: 80.0 }, { name: 'Starlink-1008', lat: 35.0, lng: 120.0 },
  { name: 'Starlink-1009', lat: 25.0, lng: 150.0 }, { name: 'Starlink-1010', lat: -20.0, lng: 140.0 },
  { name: 'Starlink-1011', lat: 55.0, lng: 10.0 }, { name: 'Starlink-1012', lat: 50.0, lng: -10.0 },
  { name: 'Starlink-1013', lat: 60.0, lng: -50.0 }, { name: 'Starlink-1014', lat: 65.0, lng: -30.0 },
  { name: 'Starlink-1015', lat: 70.0, lng: 0.0 }, { name: 'Starlink-1016', lat: 75.0, lng: 20.0 },
  { name: 'Starlink-1017', lat: 80.0, lng: 40.0 }, { name: 'Starlink-1018', lat: 85.0, lng: 60.0 },
];

export async function collectStarlink() {
  console.log('[Starlink] Сбор...');
  const now = new Date().toISOString();
  const data = SATS.map(s => ({ ...s, type: 'starlink', status: 'active', severity: 'low', collected: now }));
  const result = await saveRaw('starlink', data, {
    collector: 'collect-starlink.mjs',
    source: 'Starlink constellation (demo)',
    source_url: 'https://www.starlink.com/',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'satellites',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Demo: 18 спутников Starlink; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Starlink] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectStarlink().catch(e => { console.error('[Starlink] FATAL:', e.message); process.exit(1); });
}
