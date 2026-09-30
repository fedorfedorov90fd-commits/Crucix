#!/usr/bin/env node
/**
 * Crucix Collector: debt-gdp (долг/ВВП по странам) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Реальный источник: IMF WEO, World Bank.
 * Формат: [{date, Россия, США, ...}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const COUNTRIES = ['Россия', 'США', 'Китай', 'Япония', 'Германия', 'Франция', 'Великобритания', 'Индия', 'Бразилия', 'Италия'];
const DEBT = { 'Россия': 25, 'США': 120, 'Китай': 60, 'Япония': 250, 'Германия': 70, 'Франция': 115, 'Великобритания': 100, 'Индия': 85, 'Бразилия': 90, 'Италия': 150 };
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const entry = { date: date.toISOString().split('T')[0] };
    for (const country of COUNTRIES) {
      const base = DEBT[country] || 60;
      entry[country] = Math.round((base + (Math.random() - 0.5) * 5) * 100) / 100;
    }
    data.push(entry);
  }
  return data;
}

export async function collectDebtGDP() {
  const data = generateData();
  const result = await saveRaw('debt-gdp', data, {
    collector: 'collect-debt-gdp.mjs',
    source: 'IMF WEO / World Bank (demo)',
    source_url: 'https://www.imf.org/en/Publications/WEO',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'percent_gdp',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные, IMF API не подключён; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[DEBT-GDP] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectDebtGDP().catch((e) => { console.error('[DEBT-GDP] FATAL:', e); process.exit(1); });
}
