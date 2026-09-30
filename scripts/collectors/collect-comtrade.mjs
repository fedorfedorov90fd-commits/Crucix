#!/usr/bin/env node
/**
 * Crucix Collector: UN Comtrade (международная торговля) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Реальный источник: https://comtradeapi.un.org/ (без ключа — лимит).
 * Формат: [{date, value, exports, imports}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.floor(Math.random() * 100000) + 50000,
      exports: Math.floor(Math.random() * 50000) + 20000,
      imports: Math.floor(Math.random() * 50000) + 20000,
    });
  }
  return data;
}

export async function collectComtrade() {
  const data = generateData();
  const result = await saveRaw('comtrade', data, {
    collector: 'collect-comtrade.mjs',
    source: 'UN Comtrade (demo)',
    source_url: 'https://comtradeapi.un.org/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'count',
    value_unit: 'usd',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные, UN Comtrade API не подключён; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[COMTRADE] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectComtrade().catch((e) => { console.error('[COMTRADE] FATAL:', e); process.exit(1); });
}
