#!/usr/bin/env node
/**
 * Crucix Collector: sp500-vix.
 * Версия 2.0.0. Принят 19.09.2026.
 *
 * Демо-данные SP500 и VIX. Тип — timeseries.
 * Формат: [{date, value: vix, sp500, vix}].
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const sp500 = 4500 + i * 5 + (Math.random() - 0.5) * 50;
    const vix = 18 + (i / 30) * 15 + (Math.random() - 0.5) * 3;
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round(vix * 100) / 100,
      sp500: Math.round(sp500 * 100) / 100,
      vix: Math.round(vix * 100) / 100
    });
  }
  return data;
}

export async function collectSP500VIX() {
  const data = generateData();
  const result = await saveRaw('sp500-vix', data, {
    collector: 'collect-sp500-vix.mjs',
    source: 'Crucix SP500-VIX (demo)',
    source_url: 'local://demo',
    license: 'proprietary',
    format_hint: 'timeseries',
    value_unit: 'index',
    granularity: 'daily',
    record_count: data.length,
    notes: 'Демо-данные, реальный источник не подключён',
    backwardCompat: true
  });
  console.log(`[SP500-VIX] OK ${data.length} записей → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectSP500VIX().catch((e) => { console.error('[SP500-VIX] FATAL:', e.message); process.exit(1); });
}
