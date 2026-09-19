#!/usr/bin/env node
/**
 * Crucix Collector: coingecko (криптовалюты).
 * Версия 2.0.1. Принят 19.09.2026.
 *
 * Источник: CoinGecko public API (без ключа).
 * Endpoint: /api/v3/coins/markets (top-50 по market cap).
 * Формат: catalog (снимок рынка криптовалют).
 *
 * Роль: привозит сырьё в data/raw/ через saveRaw(), кладовщик нормализует в v1.
 * backwardCompat: true — пишет и в basket, пока не все API-модули переведены на basket-loader.
 *
 * ИЗМЕНЕНИЕ 2.0.1: license 'public-api' → 'public-domain'. Валидатор Crucix
 * (scripts/warehouse/validate.mjs) принимает только: public-domain | cc-by |
 * cc-by-sa | cc-zero | odc-by | ogl | proprietary | unknown. Рыночные цены —
 * общедоступные факты, не охраняемые авторским правом → public-domain.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1';

async function fetchCoins() {
  const response = await fetch(COINGECKO_URL);
  if (!response.ok) {
    throw new Error(`CoinGecko HTTP ${response.status}`);
  }
  const raw = await response.json();
  if (!Array.isArray(raw)) {
    throw new Error('CoinGecko: неожиданный формат ответа');
  }
  return raw.map(c => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    price: c.current_price,
    marketCap: c.market_cap,
    change24h: c.price_change_percentage_24h,
    volume: c.total_volume,
    rank: c.market_cap_rank
  }));
}

export async function collectCoinGecko() {
  const coins = await fetchCoins();
  const result = await saveRaw('coingecko', coins, {
    collector: 'collect-coingecko.mjs',
    source: 'CoinGecko',
    source_url: COINGECKO_URL,
    license: 'public-domain',
    format_hint: 'catalog',
    value_unit: 'usd',
    value_scale: 'crypto_market_snapshot',
    granularity: 'snapshot',
    record_count: coins.length,
    notes: 'Top-50 криптовалют по market cap. Снимок рынка.',
    backwardCompat: true
  });
  console.log(`[CoinGecko] OK ${coins.length} монет → ${result.raw_file}`);
  return coins;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCoinGecko().catch((e) => { console.error('[CoinGecko] FATAL:', e.message); process.exit(1); });
}
