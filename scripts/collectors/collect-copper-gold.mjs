#!/usr/bin/env node
/**
 * Crucix Collector: copper-gold.
 * Версия 2.0.0. Принят 19.09.2026.
 *
 * Демо-данные индекса Медь/Золото. Тип — timeseries.
 * Формат: [{date, value: ratio, copper, gold}].
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const base = 12 + (i / 30) * 3 + (Math.random() - 0.5) * 1.5;
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round(base * 100) / 100,
      copper: Math.round((420 + i * 1.5 + (Math.random() - 0.5) * 10) * 100) / 100,
      gold: Math.round((1900 + i * 2 + (Math.random() - 0.5) * 15) * 100) / 100
    });
  }
  return data;
}

export async function collectCopperGold() {
  const data = generateData();
  const result = await saveRaw('copper-gold', data, {
    collector: 'collect-copper-gold.mjs',
    source: 'Crucix copper-gold (demo)',
    source_url: 'local://demo',
    license: 'proprietary',
    format_hint: 'timeseries',
    value_unit: 'ratio',
    value_scale: 'copper_usd_per_gold_usd',
    granularity: 'daily',
    record_count: data.length,
    notes: 'Демо-данные',
    backwardCompat: true
  });
  console.log(`[COPPER-GOLD] OK ${data.length} записей → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCopperGold().catch((e) => { console.error('[COPPER-GOLD] FATAL:', e.message); process.exit(1); });
}
