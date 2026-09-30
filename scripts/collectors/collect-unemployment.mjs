#!/usr/bin/env node
/**
 * Crucix Collector: unemployment (безработица) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: FRED UNRATE (реальные).
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
    const value = 3.5 + Math.random() * 3.0;
    data.push({ date: date.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
  }
  return data;
}

export async function collectUnemployment() {
  const data = generateData();
  const result = await saveRaw('unemployment', data, {
    collector: 'collect-unemployment.mjs',
    source: 'FRED UNRATE (demo)',
    source_url: 'https://fred.stlouisfed.org/series/UNRATE',
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
  console.log(`[UNEMPLOYMENT] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectUnemployment().catch(e => { console.error('[UNEMPLOYMENT] FATAL:', e.message); process.exit(1); });
}
