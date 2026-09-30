#!/usr/bin/env node
/**
 * Crucix Collector: USGS earthquakes.
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: генерирует сырьё (демо-режим) и сдаёт его на склад через
 * collector-helper. Сборщик НЕ пишет в basket — только в raw + накладную.
 * Кладовщик managerbasket.mjs нормализует и укладывает в basket.
 *
 * Реальный источник: USGS Earthquake API
 * https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = ['Калифорния', 'Япония', 'Индонезия', 'Чили', 'Турция', 'Иран'];
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const magnitude = Math.round((Math.random() * 6 + 1) * 10) / 10;
    const depth = Math.round(Math.random() * 100 + 5);
    data.push({
      date: date.toISOString().slice(0, 10),
      magnitude,
      depth,
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)]
    });
  }
  return data;
}

export async function collectUSGS() {
  const data = generateData();
  const result = await saveRaw('usgs', data, {
    collector: 'collect-usgs.mjs',
    source: 'USGS Earthquake API',
    source_url: 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_unit: 'magnitude',
    value_scale: 'richter',
    period: 'P30D',
    granularity: 'event',
    record_count: data.length,
    backwardCompat: true
  });
  console.log(`[USGS] OK ${data.length} записей → ${result.raw_file}`);
  console.log(`[USGS] Накладная: ${result.incoming_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectUSGS().catch((e) => { console.error('[USGS] FAIL:', e); process.exit(1); });
}
