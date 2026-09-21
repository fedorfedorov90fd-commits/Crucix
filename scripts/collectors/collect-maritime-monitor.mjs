#!/usr/bin/env node
/**
 * Crucix Collector: maritime-monitor (морской трафик) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{date, region, vessels}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = ['Mediterranean', 'South China Sea', 'Persian Gulf', 'Black Sea', 'Baltic Sea'];
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      vessels: Math.floor(Math.random() * 100) + 20,
    });
  }
  return data;
}

export async function collectMaritimeMonitor() {
  const data = generateData();
  const result = await saveRaw('maritime-monitor', data, {
    collector: 'collect-maritime-monitor.mjs',
    source: 'Maritime (demo)',
    source_url: 'https://www.marinetraffic.com/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'count',
    value_unit: 'vessels',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Maritime Monitor] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectMaritimeMonitor().catch((e) => { console.error('[Maritime Monitor] FATAL:', e); process.exit(1); });
}
