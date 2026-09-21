#!/usr/bin/env node
/**
 * Crucix Collector: consumer-confidence (индекс потребительского доверия) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Реальный источник: FRED / Conference Board (CONCCONF).
 * Формат: [{date, value, change, status}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const BASE_VALUES = [95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124];

function generateConsumerConfidence() {
  const now = new Date();
  const data = [];
  for (let i = 0; i < BASE_VALUES.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (BASE_VALUES.length - 1 - i));
    data.push({
      date: date.toISOString().slice(0, 10),
      value: BASE_VALUES[i],
      change: Math.round((Math.random() * 0.5 - 0.25) * 100) / 100,
      status: BASE_VALUES[i] > 110 ? 'high' : BASE_VALUES[i] > 90 ? 'normal' : 'low',
    });
  }
  return data;
}

export async function collectConsumerConfidence() {
  const data = generateConsumerConfidence();
  const result = await saveRaw('consumer-confidence', data, {
    collector: 'collect-consumer-confidence.mjs',
    source: 'FRED / Conference Board (demo)',
    source_url: 'https://fred.stlouisfed.org/series/CONCCONF',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные, FRED API не подключён; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[CONSUMER_CONFIDENCE] OK ${data.length} → ${result.raw_file}`);
  console.log(`[CONSUMER_CONFIDENCE] Накладная: ${result.incoming_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectConsumerConfidence().catch((e) => { console.error('[CONSUMER_CONFIDENCE] FATAL:', e); process.exit(1); });
}
