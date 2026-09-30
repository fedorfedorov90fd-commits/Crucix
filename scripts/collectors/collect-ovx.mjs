#!/usr/bin/env node
/**
 * Crucix Collector: ovx (OVX — волатильность нефти) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: CBOE OVX (реальные — Yahoo Finance ^OVX).
 * Формат: [{date, value, change, status}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const BASE_VALUES = [28.5,29.0,29.5,30.0,30.5,31.0,31.5,32.0,32.5,33.0,33.5,34.0,34.5,35.0,35.5,36.0,36.5,37.0,37.5,38.0,38.5,39.0,39.5,40.0,40.5,41.0,41.5,42.0,42.5,43.0];

function generateOVX() {
  const now = new Date();
  const data = [];
  for (let i = 0; i < BASE_VALUES.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (BASE_VALUES.length - 1 - i));
    data.push({
      date: date.toISOString().slice(0, 10),
      value: BASE_VALUES[i],
      change: Math.round((Math.random() * 0.6 - 0.3) * 100) / 100,
      status: BASE_VALUES[i] > 40 ? 'high' : BASE_VALUES[i] > 30 ? 'normal' : 'low',
    });
  }
  return data;
}

export async function collectOVX() {
  const data = generateOVX();
  const result = await saveRaw('ovx', data, {
    collector: 'collect-ovx.mjs',
    source: 'CBOE OVX (demo)',
    source_url: 'https://www.cboe.com/us/futures/market_statistics/historical_data/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[OVX] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOVX().catch((e) => { console.error('[OVX] FATAL:', e); process.exit(1); });
}
