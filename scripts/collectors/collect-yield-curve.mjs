#!/usr/bin/env node
/**
 * Crucix Collector: yield-curve.
 * Версия 2.0.0. Принят 19.09.2026.
 *
 * Демо-данные кривой доходности. Тип — timeseries.
 * Формат: [{date, value: spread, y10, y2, inverted}].
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const y10 = 3.5 + Math.random() * 1.5;
    const y2 = 3.0 + Math.random() * 2;
    const spread = Math.round((y10 - y2) * 100) / 100;
    data.push({
      date: date.toISOString().slice(0, 10),
      value: spread,
      y10: Math.round(y10 * 100) / 100,
      y2: Math.round(y2 * 100) / 100,
      inverted: spread < 0
    });
  }
  return data;
}

export async function collectYieldCurve() {
  const data = generateData();
  const result = await saveRaw('yield-curve', data, {
    collector: 'collect-yield-curve.mjs',
    source: 'Crucix yield-curve (demo)',
    source_url: 'local://demo',
    license: 'proprietary',
    format_hint: 'timeseries',
    value_unit: 'percent',
    value_scale: '10y_minus_2y',
    granularity: 'daily',
    record_count: data.length,
    notes: 'Демо-данные',
    backwardCompat: true
  });
  console.log(`[YIELD-CURVE] OK ${data.length} записей → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectYieldCurve().catch((e) => { console.error('[YIELD-CURVE] FATAL:', e.message); process.exit(1); });
}
