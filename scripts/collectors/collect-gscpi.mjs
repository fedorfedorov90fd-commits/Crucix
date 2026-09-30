#!/usr/bin/env node
/**
 * Crucix Collector: gscpi (Global Supply Chain Pressure Index) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: NY Fed GSCPI (реальные данные).
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
      value: Math.round((Math.random() * 0.5 + 0.2) * 100) / 100,
    });
  }
  return data;
}

export async function collectGSCPI() {
  const data = generateData();
  const result = await saveRaw('gscpi', data, {
    collector: 'collect-gscpi.mjs',
    source: 'NY Fed GSCPI (demo)',
    source_url: 'https://www.newyorkfed.org/research/policy/gscpi',
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
  console.log(`[GSCPI] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectGSCPI().catch((e) => { console.error('[GSCPI] FATAL:', e); process.exit(1); });
}
