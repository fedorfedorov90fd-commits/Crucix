#!/usr/bin/env node
/**
 * Crucix Collector: BLS (Bureau of Labor Statistics) — demo-режим.
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * Роль: генерирует сырьё (демо-режим) и сдаёт его на склад через
 * collector-helper. Сборщик НЕ пишет в basket — только в raw + накладную.
 * Кладовщик managerbasket.mjs нормализует и укладывает в basket.
 *
 * Реальный источник (для будущего перехода): BLS Public Data API
 * https://api.bls.gov/publicAPI/v2/timeseries/data/ (без ключа — 25 запросов/сутки).
 *
 * ВАЖНО: backwardCompat: false — существующий data/basket/bls.json
 * (там данные по странам, 9 записей) НЕ перезаписывается. Сырьё идёт
 * только в data/raw/ + накладную.
 *
 * Формат: массив {date, value, unemployment, jobs} за 30 дней.
 * Тип — timeseries (значения по времени).
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
      value: Math.round((Math.random() * 5 + 3) * 100) / 100,
      unemployment: Math.round((Math.random() * 4 + 3) * 100) / 100,
      jobs: Math.floor(Math.random() * 50000) + 100000,
    });
  }
  return data;
}

export async function collectBLS() {
  const data = generateData();
  const result = await saveRaw('bls', data, {
    collector: 'collect-bls.mjs',
    source: 'BLS (demo)',
    source_url: 'https://api.bls.gov/publicAPI/v2/timeseries/data/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    value_scale: null,
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные, BLS API не подключён; basket/bls.json не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[BLS] OK ${data.length} записей → ${result.raw_file}`);
  console.log(`[BLS] Накладная: ${result.incoming_file}`);
  console.log(`[BLS] basket/bls.json НЕ перезаписан (backwardCompat: false)`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectBLS().catch((e) => { console.error('[BLS] FATAL:', e); process.exit(1); });
}
