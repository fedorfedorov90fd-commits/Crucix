#!/usr/bin/env node
/**
 * Crucix Collector: nuclear-monitor (ядерный мониторинг) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{date, value, site, status}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const BASE_VALUES = [33.9,34.5,35.0,35.5,36.0,36.5,37.0,37.5,38.0,38.5,39.0,39.5,40.0,40.5,41.0,41.5,42.0,42.5,43.0,43.5,44.0,44.5,45.0,45.5,46.0,46.5,47.0,47.5,48.0,48.5];
const SITES = ['Фукусима', 'Чернобыль', 'Три-Майл-Айленд', 'Маяк', 'Селлафилд'];

function generateNuclearMonitor() {
  const now = new Date();
  const data = [];
  for (let i = 0; i < BASE_VALUES.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (BASE_VALUES.length - 1 - i));
    data.push({
      date: date.toISOString().slice(0, 10),
      value: BASE_VALUES[i],
      site: SITES[i % SITES.length],
      status: BASE_VALUES[i] > 40 ? 'high' : BASE_VALUES[i] > 30 ? 'normal' : 'low',
    });
  }
  return data;
}

export async function collectNuclearMonitor() {
  const data = generateNuclearMonitor();
  const result = await saveRaw('nuclear-monitor', data, {
    collector: 'collect-nuclear-monitor.mjs',
    source: 'Nuclear monitor (demo)',
    source_url: 'https://www.iaea.org/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные (5 АЭС); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[NUCLEAR_MONITOR] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectNuclearMonitor().catch((e) => { console.error('[NUCLEAR_MONITOR] FATAL:', e); process.exit(1); });
}
