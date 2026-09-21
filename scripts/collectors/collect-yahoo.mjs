#!/usr/bin/env node
/**
 * Crucix Collector: yahoo (S&P 500, Nasdaq, WTI) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: {source, timestamp, markets:{...}}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

export async function collectYahoo() {
  console.log('[Yahoo] Сбор рынков...');
  const data = {
    source: 'yahoo',
    timestamp: new Date().toISOString(),
    markets: {
      sp500: { name: 'S&P 500', value: 6582.69, change: '+1.63%' },
      nasdaq: { name: 'Nasdaq', value: 21879.18, change: '+2.20%' },
      oil: { name: 'WTI Crude', value: 112.06, unit: '$/bbl' },
    },
  };
  const result = await saveRaw('yahoo', data, {
    collector: 'collect-yahoo.mjs',
    source: 'Yahoo Finance (sample)',
    source_url: 'https://finance.yahoo.com/',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'price',
    value_unit: 'usd',
    granularity: 'snapshot',
    period: null,
    record_count: Object.keys(data.markets).length,
    notes: 'Sample: S&P 500, Nasdaq, WTI; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Yahoo] OK ${Object.keys(data.markets).length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectYahoo().catch(e => { console.error('[Yahoo] FATAL:', e.message); process.exit(1); });
}
