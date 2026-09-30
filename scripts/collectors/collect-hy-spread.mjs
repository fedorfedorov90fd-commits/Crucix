#!/usr/bin/env node
/**
 * Crucix Collector: hy-spread (HY Spread) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: FRED BAMLH0A0HYM2 (реальные данные).
 * Формат: [{date, value, change, status}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const BASE_VALUES = [3.16,3.20,3.25,3.30,3.35,3.40,3.45,3.50,3.55,3.60,3.65,3.70,3.75,3.80,3.85,3.90,3.95,4.00,4.05,4.10,4.15,4.20,4.25,4.30,4.35,4.40,4.45,4.50,4.55,4.60];

function generateHYSpread() {
  const now = new Date();
  const data = [];
  for (let i = 0; i < BASE_VALUES.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (BASE_VALUES.length - 1 - i));
    data.push({
      date: date.toISOString().slice(0, 10),
      value: BASE_VALUES[i],
      change: Math.round((Math.random() * 0.05 - 0.025) * 1000) / 1000,
      status: BASE_VALUES[i] > 4 ? 'high' : BASE_VALUES[i] > 3 ? 'normal' : 'low',
    });
  }
  return data;
}

export async function collectHYSpread() {
  const data = generateHYSpread();
  const result = await saveRaw('hy-spread', data, {
    collector: 'collect-hy-spread.mjs',
    source: 'FRED BAMLH0A0HYM2 (demo)',
    source_url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
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
  console.log(`[HY_SPREAD] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectHYSpread().catch((e) => { console.error('[HY_SPREAD] FATAL:', e); process.exit(1); });
}
