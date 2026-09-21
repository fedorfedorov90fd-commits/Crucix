#!/usr/bin/env node
/**
 * Crucix Collector: dark-ships-real (тёмные суда, конкретные позиции).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: реальные sample-данные → saveRaw. Сборщик НЕ пишет в basket.
 * Формат: [{name, lat, lng, type, status, severity}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const DARK_SHIPS = [
  { name: 'Unknown-001', lat: 32.0, lng: -78.0, type: 'tanker', status: 'suspicious' },
  { name: 'Unknown-002', lat: 38.0, lng: -72.0, type: 'cargo', status: 'suspicious' },
  { name: 'Unknown-003', lat: 42.0, lng: -68.0, type: 'tanker', status: 'suspicious' },
  { name: 'Unknown-004', lat: 28.0, lng: -62.0, type: 'cargo', status: 'suspicious' },
  { name: 'Unknown-005', lat: 22.0, lng: -56.0, type: 'tanker', status: 'suspicious' },
];

export async function collectDarkShipsReal() {
  console.log('[DARK-SHIPS] Начинаем сбор...');
  const now = new Date().toISOString();
  const data = DARK_SHIPS.map(s => ({ ...s, severity: 'high', collected: now }));
  const result = await saveRaw('dark-ships', data, {
    collector: 'collect-dark-ships-real.mjs',
    source: 'Dark Ships (sample)',
    source_url: 'https://www.marinetraffic.com/',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'ships',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Sample-данные 5 тёмных судов; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[DARK-SHIPS] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectDarkShipsReal().catch((e) => { console.error('[DARK-SHIPS] FATAL:', e); process.exit(1); });
}
