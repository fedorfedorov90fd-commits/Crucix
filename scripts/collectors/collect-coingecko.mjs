#!/usr/bin/env node
// collect-coingecko.mjs — крипта (без ключа, rate-limited)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
async function main() {
  const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1');
  const d = await r.json();
  const coins = (d || []).map(c => ({ id: c.id, symbol: c.symbol, name: c.name, price: c.current_price, marketCap: c.market_cap, change24h: c.price_change_percentage_24h, volume: c.total_volume }));
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'coingecko-latest.json'), JSON.stringify({ source: 'CoinGecko', updated: new Date().toISOString(), count: coins.length, coins }, null, 2));
  console.log(`[CoinGecko] ${coins.length} монет`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
