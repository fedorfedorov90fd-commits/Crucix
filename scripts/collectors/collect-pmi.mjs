#!/usr/bin/env node
/**
 * Crucix Collector: pmi (PMI — индекс менеджеров по закупкам) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: ISM PMI (реальные — Trading Economics).
 * Формат: [{date, value}]. Тип — timeseries.
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
      value: Math.round((45 + Math.random() * 15) * 100) / 100,
    });
  }
  return data;
}

export async function collectPMI() {
  const data = generateData();
  const result = await saveRaw('pmi', data, {
    collector: 'collect-pmi.mjs',
    source: 'ISM PMI (demo)',
    source_url: 'https://tradingeconomics.com/united-states/manufacturing-pmi',
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
  console.log(`[PMI] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectPMI().catch((e) => { console.error('[PMI] FATAL:', e); process.exit(1); });
}
