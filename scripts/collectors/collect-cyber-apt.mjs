#!/usr/bin/env node
/**
 * Crucix Collector: cyber-apt (реальные данные APT-групп).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: справочник APT → saveRaw. Сборщик НЕ пишет в basket.
 * Формат: [{name, country, lat, lng, type, active, collected}]. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const APT_DATA = [
  { name: 'APT28 (Fancy Bear)', country: 'Россия', lat: 55.7558, lng: 37.6173, type: 'кибершпионаж', active: true },
  { name: 'APT29 (Cozy Bear)', country: 'Россия', lat: 55.7558, lng: 37.6173, type: 'кибершпионаж', active: true },
  { name: 'Lazarus Group', country: 'Северная Корея', lat: 39.019, lng: 125.755, type: 'хакерская', active: true },
  { name: 'Sandworm', country: 'Россия', lat: 55.7558, lng: 37.6173, type: 'деструктивная', active: true },
  { name: 'Turla', country: 'Россия', lat: 55.7558, lng: 37.6173, type: 'кибершпионаж', active: true },
  { name: 'Equation Group', country: 'США', lat: 38.9072, lng: -77.0369, type: 'кибершпионаж', active: true },
  { name: 'DarkSide', country: 'Россия', lat: 55.7558, lng: 37.6173, type: 'вымогатели', active: true },
  { name: 'REvil', country: 'Россия', lat: 55.7558, lng: 37.6173, type: 'вымогатели', active: false },
];

export async function collectCyberAPT() {
  const now = new Date().toISOString();
  const data = APT_DATA.map(a => ({ ...a, collected: now }));
  const result = await saveRaw('cyber-apt', data, {
    collector: 'collect-cyber-apt.mjs',
    source: 'Crucix APT reference',
    source_url: 'local://reference',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Справочник APT-групп (8 записей); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[CYBER-APT] OK ${data.length} группировок → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCyberAPT().catch((e) => { console.error('[CYBER-APT] FATAL:', e); process.exit(1); });
}
