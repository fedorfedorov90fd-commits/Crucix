#!/usr/bin/env node
/**
 * Crucix Collector: trading-economics (5 макро-индикаторов) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Правило 12.2: Trading Economics требует ключ → demo-fallback.
 * Формат: {source, lastUpdated, indicators:{...}, note}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

export async function collectTradingEconomics() {
  console.log('[TradingEconomics] Запуск...');
  const basketData = {
    source: 'TradingEconomics',
    lastUpdated: new Date().toISOString(),
    indicators: {
      us_inflation: { value: 3.2, year: 2024, note: 'Демо-данные' },
      us_unemployment: { value: 3.9, year: 2024, note: 'Демо-данные' },
      fed_rate: { value: 5.5, year: 2024, note: 'Демо-данные' },
      eu_inflation: { value: 2.6, year: 2024, note: 'Демо-данные' },
      china_gdp: { value: 4.8, year: 2024, note: 'Демо-данные' },
    },
    note: 'Для реальных данных установите TRADING_ECONOMICS_KEY в .env (правило 12.2)',
  };
  const result = await saveRaw('trading-economics', basketData, {
    collector: 'collect-trading-economics.mjs',
    source: 'Trading Economics (demo)',
    source_url: 'https://tradingeconomics.com/',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'index',
    value_unit: 'index',
    granularity: 'snapshot',
    period: null,
    record_count: Object.keys(basketData.indicators).length,
    notes: 'Demo: 5 макро-индикаторов; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[TradingEconomics] OK ${Object.keys(basketData.indicators).length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectTradingEconomics().catch(e => { console.error('[TradingEconomics] FATAL:', e.message); process.exit(1); });
}
