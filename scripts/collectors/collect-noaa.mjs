#!/usr/bin/env node
/**
 * Crucix Collector: noaa (погода по 7 городам) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{date, value, city, temp, condition}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const CITIES = ['New York', 'London', 'Tokyo', 'Sydney', 'Moscow', 'Dubai', 'Singapore'];
const CONDITIONS = ['sunny', 'cloudy', 'rainy', 'stormy'];
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round((Math.random() * 20 + 10) * 100) / 100,
      city: CITIES[Math.floor(Math.random() * CITIES.length)],
      temp: Math.round((Math.random() * 30 + 5) * 100) / 100,
      condition: CONDITIONS[Math.floor(Math.random() * CONDITIONS.length)],
    });
  }
  return data;
}

export async function collectNOAA() {
  const data = generateData();
  const result = await saveRaw('noaa', data, {
    collector: 'collect-noaa.mjs',
    source: 'NOAA (demo)',
    source_url: 'https://www.noaa.gov/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные (7 городов); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[NOAA] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectNOAA().catch((e) => { console.error('[NOAA] FATAL:', e); process.exit(1); });
}
