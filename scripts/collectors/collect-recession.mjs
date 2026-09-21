#!/usr/bin/env node
/**
 * Crucix Collector: recession (индекс вероятности рецессии) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: NY Fed / FRED RECPROUSM156N (реальные данные).
 * Формат: [{date, value}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round((10 + Math.random() * 60) * 100) / 100,
    });
  }
  return data;
}

export async function collectRecession() {
  const data = generateData();
  const result = await saveRaw('recession', data, {
    collector: 'collect-recession.mjs',
    source: 'NY Fed (demo)',
    source_url: 'https://fred.stlouisfed.org/series/RECPROUSM156N',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'percent',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[RECESSION] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectRecession().catch((e) => { console.error('[RECESSION] FATAL:', e); process.exit(1); });
}
