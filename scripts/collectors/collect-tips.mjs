#!/usr/bin/env node
/**
 * Crucix Collector: tips (ставки TIPS) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: US Treasury TIPS (реальные — FRED DFII10).
 * Формат: [{date, value, change, status}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const BASE_VALUES = [1.8,1.9,2.0,2.1,2.2,2.1,2.0,1.9,1.8,1.7,1.6,1.5,1.4,1.3,1.2,1.1,1.0,0.9,0.8,0.7,0.6,0.5,0.4,0.3,0.2,0.1,0.0,-0.1,-0.2,-0.3];

function generateTIPS() {
  const now = new Date();
  const data = [];
  for (let i = 0; i < BASE_VALUES.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (BASE_VALUES.length - 1 - i));
    data.push({
      date: date.toISOString().slice(0, 10),
      value: BASE_VALUES[i],
      change: Math.round((Math.random() * 0.1 - 0.05) * 100) / 100,
      status: BASE_VALUES[i] > 2 ? 'high' : BASE_VALUES[i] > 0 ? 'normal' : 'low',
    });
  }
  return data;
}

export async function collectTIPS() {
  const data = generateTIPS();
  const result = await saveRaw('tips', data, {
    collector: 'collect-tips.mjs',
    source: 'US Treasury TIPS (demo)',
    source_url: 'https://fred.stlouisfed.org/series/DFII10',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'percent',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные (ставки TIPS); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[TIPS] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectTIPS().catch(e => { console.error('[TIPS] FATAL:', e.message); process.exit(1); });
}
