#!/usr/bin/env node
/**
 * Crucix Collector: gold-silver (золото/серебро, ratio) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: демо (реальные — Yahoo Finance GC=F + SI=F).
 * Формат: [{date, gold, silver, ratio}]. Тип — timeseries.
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
    const gold = 1900 + Math.random() * 200;
    const silver = 22 + Math.random() * 8;
    data.push({
      date: date.toISOString().slice(0, 10),
      gold: Math.round(gold * 100) / 100,
      silver: Math.round(silver * 100) / 100,
      ratio: Math.round((gold / silver) * 100) / 100,
    });
  }
  return data;
}

export async function collectGoldSilver() {
  const data = generateData();
  const result = await saveRaw('gold-silver', data, {
    collector: 'collect-gold-silver.mjs',
    source: 'Gold/Silver (demo)',
    source_url: 'https://finance.yahoo.com/quote/GC=F',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'price',
    value_unit: 'ratio',
    value_scale: 'gold_usd_per_silver_usd',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[GOLD-SILVER] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectGoldSilver().catch((e) => { console.error('[GOLD-SILVER] FATAL:', e); process.exit(1); });
}
