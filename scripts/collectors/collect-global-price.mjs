#!/usr/bin/env node
/**
 * Crucix Collector: global-price (цены на сырьё) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: GlobalPrice API (не работает, fallback demo).
 * Формат: {source, lastUpdated, commodities:[{name,price,unit,change}], note}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://api.globalprice.info/v1/commodities';
const TIMEOUT_MS = 8000;

const FALLBACK = {
  source: 'GlobalPrice (DEMO)',
  lastUpdated: new Date().toISOString(),
  commodities: [
    { name: 'Gold', price: 1920, unit: 'USD/oz', change: '+1.2%' },
    { name: 'Silver', price: 23.5, unit: 'USD/oz', change: '+0.8%' },
    { name: 'Crude Oil (WTI)', price: 78.5, unit: 'USD/bbl', change: '+2.1%' },
    { name: 'Brent Oil', price: 82.3, unit: 'USD/bbl', change: '+1.9%' },
    { name: 'Natural Gas', price: 3.2, unit: 'USD/MMBtu', change: '-0.5%' },
    { name: 'Copper', price: 4.2, unit: 'USD/lb', change: '+0.3%' },
    { name: 'Wheat', price: 6.8, unit: 'USD/bu', change: '-1.2%' },
    { name: 'Corn', price: 5.5, unit: 'USD/bu', change: '-0.8%' },
  ],
  note: 'Демо-данные (GlobalPrice API недоступен)',
};

export async function collectGlobalPrice() {
  console.log('[GlobalPrice] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    basketData = { source: 'GlobalPrice', lastUpdated: new Date().toISOString(), commodities: d || [], note: 'Данные загружены через GlobalPrice API' };
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[GlobalPrice] ⚠️ Ошибка:', e.message);
    basketData = { ...FALLBACK, lastUpdated: new Date().toISOString() };
  }

  const result = await saveRaw('global-price', basketData, {
    collector: 'collect-global-price.mjs',
    source: ok ? 'GlobalPrice API' : 'GlobalPrice (demo)',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'price',
    value_unit: 'usd',
    granularity: 'snapshot',
    period: null,
    record_count: (basketData.commodities || []).length,
    notes: ok ? 'Реальные данные GlobalPrice' : 'Fallback demo; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[GlobalPrice] OK ${(basketData.commodities || []).length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectGlobalPrice().catch(e => { console.error('[GlobalPrice] FATAL:', e.message); process.exit(1); });
}
