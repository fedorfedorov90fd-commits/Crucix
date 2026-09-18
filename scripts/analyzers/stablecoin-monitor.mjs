#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import StablecoinMonitor from '../../apis/sources/stablecoin-monitor.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'market');
const OUT_FILE = join(OUT_DIR, 'stablecoin-monitor.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const sm = new StablecoinMonitor();
  const coingecko = await readJson(join(BASKET, 'coingecko-latest.json'), {});
  const coins = coingecko.coins || (Array.isArray(coingecko) ? coingecko : []);
  for (const c of coins) {
    const symbol = String(c.symbol || '').toUpperCase();
    if (['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FRAX', 'USDD'].includes(symbol)) {
      sm.update({ symbol, price: c.current_price || c.price, marketCap: c.market_cap, volume24h: c.total_volume });
    }
  }
  const all = sm.getAll();
  const depegged = sm.depegged();
  const payload = { _meta: { id: 'stablecoin-monitor', category: 'market', version: '1.0.0', schema_version: '1.0.0', sources: ['coingecko-latest'], calculator: 'StablecoinMonitor', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total: all.length, depegged: depegged.length } }, data: { stablecoins: all, depegged, total: all.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('StablecoinMonitor v1.0.0 — coins:', all.length, ', depegged:', depegged.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
