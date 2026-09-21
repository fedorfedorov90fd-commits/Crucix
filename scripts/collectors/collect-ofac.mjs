#!/usr/bin/env node
/**
 * Crucix Collector: ofac (санкционные данные OFAC по странам) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{date, country, type, count}]. Тип — catalog.
 * ПРИМЕЧАНИЕ: отдельный от collect-ofac-sdn.mjs (тот — реальный SDN XML, 19393 записей).
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const COUNTRIES = ['Россия', 'Иран', 'Северная Корея', 'Сирия', 'Венесуэла', 'Куба'];
const TYPES = ['Финансовые', 'Торговые', 'Персональные', 'Отраслевые'];
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
      count: Math.floor(Math.random() * 20) + 1,
    });
  }
  return data;
}

export async function collectOFAC() {
  const data = generateData();
  const result = await saveRaw('ofac', data, {
    collector: 'collect-ofac.mjs',
    source: 'OFAC (demo)',
    source_url: 'https://ofac.treasury.gov/',
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
  console.log(`[OFAC] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOFAC().catch((e) => { console.error('[OFAC] FATAL:', e); process.exit(1); });
}
