#!/usr/bin/env node
/**
 * Crucix Collector: safecast (радиация, 5 АЭС) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: Safecast (реальные — https://api.safecast.org/).
 * Формат: [{date, value, site, cpm}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const SITES = ['Fukushima', 'Chernobyl', 'Three Mile Island', 'Fukushima Daiichi', 'Mayak'];
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round((Math.random() * 50 + 10) * 100) / 100,
      site: SITES[Math.floor(Math.random() * SITES.length)],
      cpm: Math.round((Math.random() * 40 + 20) * 100) / 100,
    });
  }
  return data;
}

export async function collectSafecast() {
  const data = generateData();
  const result = await saveRaw('safecast', data, {
    collector: 'collect-safecast.mjs',
    source: 'Safecast (demo)',
    source_url: 'https://api.safecast.org/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'cpm',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные (5 АЭС); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[SAFECAST] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectSafecast().catch((e) => { console.error('[SAFECAST] FATAL:', e); process.exit(1); });
}
