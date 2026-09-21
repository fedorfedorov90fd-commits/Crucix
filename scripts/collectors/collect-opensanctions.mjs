#!/usr/bin/env node
/**
 * Crucix Collector: opensanctions (OpenSanctions.org) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://www.opensanctions.org/
 * Формат: [{date, country, type, count}]. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const COUNTRIES = ['Россия', 'Китай', 'Иран', 'Северная Корея', 'Беларусь', 'Мьянма'];
const TYPES = ['Физическое лицо', 'Компания', 'Организация'];
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      country: COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)],
      type: TYPES[Math.floor(Math.random() * TYPES.length)],
      count: Math.floor(Math.random() * 15) + 1,
    });
  }
  return data;
}

export async function collectOpenSanctions() {
  const data = generateData();
  const result = await saveRaw('opensanctions', data, {
    collector: 'collect-opensanctions.mjs',
    source: 'OpenSanctions (demo)',
    source_url: 'https://www.opensanctions.org/',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[OpenSanctions] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOpenSanctions().catch((e) => { console.error('[OpenSanctions] FATAL:', e); process.exit(1); });
}
