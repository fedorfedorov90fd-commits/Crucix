#!/usr/bin/env node
/**
 * Crucix Collector: oil-gas (нефть/газ, ratio) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{date, oil, gas, ratio}]. Тип — timeseries.
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
    const oil = 70 + Math.random() * 20;
    const gas = 3 + Math.random() * 2;
    data.push({
      date: date.toISOString().slice(0, 10),
      oil: Math.round(oil * 100) / 100,
      gas: Math.round(gas * 100) / 100,
      ratio: Math.round((oil / gas) * 100) / 100,
    });
  }
  return data;
}

export async function collectOilGas() {
  const data = generateData();
  const result = await saveRaw('oil-gas', data, {
    collector: 'collect-oil-gas.mjs',
    source: 'Oil/Gas (demo)',
    source_url: 'https://finance.yahoo.com/quote/CL=F',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'price',
    value_unit: 'ratio',
    value_scale: 'oil_usd_per_gas_usd',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[OIL-GAS] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOilGas().catch((e) => { console.error('[OIL-GAS] FATAL:', e); process.exit(1); });
}
