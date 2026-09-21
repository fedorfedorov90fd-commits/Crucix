#!/usr/bin/env node
/**
 * Crucix Collector: uranium (цена урана) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: UxC / Cameco (реальные требуют подписки).
 * Формат: [{date, price}]. Тип — timeseries.
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
    const base = 45 + (i / 30) * 15 + (Math.random() - 0.5) * 8;
    data.push({
      date: date.toISOString().split('T')[0],
      price: Math.round(base * 100) / 100,
    });
  }
  return data;
}

export async function collectUranium() {
  const data = generateData();
  const result = await saveRaw('uranium', data, {
    collector: 'collect-uranium.mjs',
    source: 'Uranium (demo)',
    source_url: 'https://www.uxc.com/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'price',
    value_unit: 'usd_per_lb',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные (цена урана); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[URANIUM] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectUranium().catch(e => { console.error('[URANIUM] FATAL:', e.message); process.exit(1); });
}
