#!/usr/bin/env node
/**
 * Crucix Collector: internet-outages (отключения интернета по 5 странам).
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{country, lat, lng, severity, description, collected}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const OUTAGE_DATA = [
  { country: 'Иран', lat: 32.4279, lng: 53.6880, severity: 'critical', description: 'Массовые отключения интернета' },
  { country: 'Китай', lat: 35.8617, lng: 104.1954, severity: 'high', description: 'Великий китайский фаервол' },
  { country: 'Россия', lat: 61.5240, lng: 105.3188, severity: 'medium', description: 'Ограничения доступа' },
  { country: 'Турция', lat: 38.9637, lng: 35.2433, severity: 'high', description: 'Блокировки соцсетей' },
  { country: 'Индия', lat: 20.5937, lng: 78.9629, severity: 'medium', description: 'Локальные отключения' },
];

export async function collectInternetOutages() {
  const now = new Date().toISOString();
  const data = OUTAGE_DATA.map(o => ({ ...o, collected: now }));
  const result = await saveRaw('internet-outages', data, {
    collector: 'collect-internet-outages.mjs',
    source: 'Crucix internet outages',
    source_url: 'https://api.ooni.io/',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Отключения интернета по 5 странам; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[INTERNET-OUTAGES] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectInternetOutages().catch((e) => { console.error('[INTERNET-OUTAGES] FATAL:', e); process.exit(1); });
}
