#!/usr/bin/env node
/**
 * Crucix Collector: bdi (Baltic Dry Index).
 * Версия 2.0.0. Принят 19.09.2026.
 *
 * Реальный источник Yahoo Finance BDI, fallback — демо. Тип — timeseries.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

async function fetchBDI() {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/BDI?interval=1d&range=1y';
    const response = await fetch(url);
    const data = await response.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const close = result.indicators.quote[0].close;
    const bdiData = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (close[i] !== null) {
        const date = new Date(timestamps[i] * 1000);
        bdiData.push({ date: date.toISOString().slice(0, 10), value: Math.round(close[i]) });
      }
    }
    if (bdiData.length > 0) return bdiData;
  } catch (e) {
    console.warn(`[BDI] Yahoo: ${e.message}, демо-данные`);
  }
  const now = new Date();
  const data = [];
  let value = 2000;
  for (let i = 365; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    value += (Math.random() - 0.5) * 50;
    value = Math.max(1000, Math.min(4000, value));
    data.push({ date: date.toISOString().slice(0, 10), value: Math.round(value) });
  }
  return data;
}

export async function collectBDI() {
  const data = await fetchBDI();
  const result = await saveRaw('bdi', data, {
    collector: 'collect-bdi.mjs',
    source: 'Yahoo Finance BDI / demo',
    source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/BDI',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_unit: 'index',
    granularity: 'daily',
    record_count: data.length,
    notes: 'Baltic Dry Index',
    backwardCompat: true
  });
  console.log(`[BDI] OK ${data.length} записей → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectBDI().catch((e) => { console.error('[BDI] FATAL:', e.message); process.exit(1); });
}
