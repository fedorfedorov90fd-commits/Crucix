#!/usr/bin/env node
/**
 * Crucix Collector: firms (NASA FIRMS — пожары).
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: генерирует демо-данные пожаров и сдаёт через saveRaw.
 * Сборщик НЕ пишет в basket напрямую — только raw + накладная.
 *
 * Формат данных: [{date, value, region, frp, confidence}]. Тип — timeseries.
 * Регион текстовый (Amazon, Siberia и т.п.) — не страна, уйдёт в unmapped.
 *
 * Реальный источник: NASA FIRMS API (не подключён, демо-режим).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = ['Amazon', 'California', 'Siberia', 'Australia', 'Greece', 'Turkey', 'Canada', 'Indonesia', 'Brazil'];
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.floor(20 + Math.random() * 180),
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      frp: Math.round((Math.random() * 100 + 10) * 100) / 100,
      confidence: Math.round((50 + Math.random() * 50) * 10) / 10
    });
  }
  return data;
}

export async function collectFIRMS() {
  const data = generateData();
  const result = await saveRaw('firms', data, {
    collector: 'collect-firms.mjs',
    source: 'NASA FIRMS (demo)',
    source_url: 'local://demo',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_unit: 'count',
    granularity: 'event',
    record_count: data.length,
    notes: 'Демо-данные, NASA FIRMS API не подключён',
    backwardCompat: true
  });
  console.log(`[FIRMS] OK ${data.length} записей → ${result.raw_file}`);
  console.log(`[FIRMS] Накладная: ${result.incoming_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectFIRMS().catch((e) => { console.error('[FIRMS] FATAL:', e.message); process.exit(1); });
}
