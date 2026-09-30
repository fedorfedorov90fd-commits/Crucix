#!/usr/bin/env node
/**
 * Crucix Collector: frostbyte (крипто, sample-данные).
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: Frostbyte (для реальных данных — интеграция).
 * Формат: {source, timestamp, crypto:{...}}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

export async function collectFrostbyte() {
  console.log('[Frostbyte] Сбор крипто...');
  const data = {
    source: 'frostbyte',
    timestamp: new Date().toISOString(),
    crypto: {
      bitcoin: { price: 66895.18, change: '+2.3%' },
      ethereum: { price: 2052.04, change: '+1.8%' },
      solana: { price: 145.60, change: '+4.1%' },
    },
  };

  const result = await saveRaw('frostbyte', data, {
    collector: 'collect-frostbyte.mjs',
    source: 'Frostbyte (sample)',
    source_url: 'https://frostbyte.example/',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'price',
    value_unit: 'usd',
    granularity: 'snapshot',
    period: null,
    record_count: Object.keys(data.crypto).length,
    notes: 'Sample-данные 3 криптовалют; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Frostbyte] OK ${Object.keys(data.crypto).length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectFrostbyte().catch((e) => { console.error('[Frostbyte] FATAL:', e); process.exit(1); });
}
