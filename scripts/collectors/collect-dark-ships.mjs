#!/usr/bin/env node
/**
 * Crucix Collector: dark-ships.
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: генерирует демо-данные тёмного флота и сдаёт через saveRaw.
 * Сборщик НЕ пишет в basket напрямую — только raw + накладная.
 *
 * Формат данных: [{date, region, ships}]. Тип — timeseries
 * (есть date + числовое ships, нет координат). Регион текстовый (море),
 * в справочнике стран его нет — уйдёт в extra.unmapped_regions.
 *
 * Реальный источник — не подключён (демо-режим).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = ['Black Sea', 'Mediterranean', 'South China Sea', 'Persian Gulf', 'Baltic Sea'];
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      ships: Math.floor(Math.random() * 10) + 1
    });
  }
  return data;
}

export async function collectDarkShips() {
  const data = generateData();
  const result = await saveRaw('dark-ships', data, {
    collector: 'collect-dark-ships.mjs',
    source: 'Crucix dark-ships (demo)',
    source_url: 'local://demo',
    license: 'proprietary',
    format_hint: 'timeseries',
    value_unit: 'count',
    granularity: 'event',
    record_count: data.length,
    notes: 'Демо-данные, реальный источник не подключён',
    backwardCompat: true
  });

  console.log(`[Dark Ships] OK ${data.length} записей → ${result.raw_file}`);
  console.log(`[Dark Ships] Накладная: ${result.incoming_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectDarkShips().catch((e) => { console.error('[Dark Ships] FATAL:', e.message); process.exit(1); });
}
