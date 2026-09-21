#!/usr/bin/env node
/**
 * Crucix Collector: dxy (индекс доллара США) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Реальный источник: Yahoo Finance (DX-Y.NYB), FRED (DTWEXBGS).
 * Формат: [{date, value, change, status}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const BASE_VALUES = [105.2,105.5,105.8,106.1,106.0,105.7,105.3,104.9,104.6,104.2,104.0,103.8,103.5,103.2,103.0,102.8,102.5,102.2,102.0,101.8,101.5,101.2,101.0,100.8,100.5,100.2,100.0,99.8,99.5,99.2];

function generateDXY() {
  const now = new Date();
  const data = [];
  for (let i = 0; i < BASE_VALUES.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (BASE_VALUES.length - 1 - i));
    data.push({
      date: date.toISOString().slice(0, 10),
      value: BASE_VALUES[i],
      change: Math.round((Math.random() * 0.4 - 0.2) * 100) / 100,
      status: BASE_VALUES[i] > 108 ? 'high' : BASE_VALUES[i] > 103 ? 'normal' : 'low',
    });
  }
  return data;
}

export async function collectDXY() {
  const data = generateDXY();
  const result = await saveRaw('dxy', data, {
    collector: 'collect-dxy.mjs',
    source: 'DXY (demo)',
    source_url: 'https://finance.yahoo.com/quote/DX-Y.NYB',
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
  console.log(`[DXY] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectDXY().catch((e) => { console.error('[DXY] FATAL:', e); process.exit(1); });
}
