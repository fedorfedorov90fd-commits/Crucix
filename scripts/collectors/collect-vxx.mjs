#!/usr/bin/env node
/**
 * Crucix Collector: vxx (VXX — волатильность).
 * Версия 1.0.0. Принят 19.09.2026.
 *
 * Роль: генерирует демо-данные VXX и сдаёт через saveRaw.
 * Восстановлен с нуля — сборщика не существовало, но слой (vxx в layers.js, №41),
 * API (apis/sources/vxx-api.mjs) и basket (data/basket/vxx.json) были.
 *
 * Формат данных: [{date, value}]. Тип — timeseries.
 * Значения: 20–45 (типичный диапазон VXX).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

function generateData() {
  const now = new Date();
  const data = [];
  let value = 25;
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    value = Math.max(15, Math.min(45, value + (Math.random() - 0.5) * 4));
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round(value * 100) / 100
    });
  }
  return data;
}

export async function collectVXX() {
  const data = generateData();
  const result = await saveRaw('vxx', data, {
    collector: 'collect-vxx.mjs',
    source: 'Crucix VXX (demo)',
    source_url: 'local://demo',
    license: 'proprietary',
    format_hint: 'timeseries',
    value_unit: 'index',
    value_scale: 'vxx_volatility',
    granularity: 'daily',
    record_count: data.length,
    notes: 'Восстановлен с нуля. Демо-данные. Реальный источник — iPath Series B S&P 500 VIX Short-Term Futures ETN',
    backwardCompat: true
  });
  console.log(`[VXX] OK ${data.length} записей → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectVXX().catch((e) => { console.error('[VXX] FATAL:', e.message); process.exit(1); });
}
