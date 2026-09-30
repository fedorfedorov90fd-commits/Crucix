#!/usr/bin/env node
/**
 * Crucix Collector: crypto-fear (BTC/ETH, demo).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Формат: [{date, btc, eth, ratio}]. Тип — timeseries.
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
    const btc = 60000 + i * 100 + (Math.random() - 0.5) * 2000;
    const eth = 3000 + i * 20 + (Math.random() - 0.5) * 150;
    data.push({
      date: date.toISOString().split('T')[0],
      btc: Math.round(btc * 100) / 100,
      eth: Math.round(eth * 100) / 100,
      ratio: Math.round((btc / eth) * 100) / 100,
    });
  }
  return data;
}

export async function collectCryptoFear() {
  const data = generateData();
  const result = await saveRaw('crypto-fear', data, {
    collector: 'collect-crypto-fear.mjs',
    source: 'Crypto (demo)',
    source_url: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'price',
    value_unit: 'usd',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[CRYPTO-FEAR] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCryptoFear().catch((e) => { console.error('[CRYPTO-FEAR] FATAL:', e); process.exit(1); });
}
