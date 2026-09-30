#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import DerivedMarketAnalytics from '../../apis/sources/derived-market-analytics.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'market');
const OUT_FILE = join(OUT_DIR, 'derived-market-analytics.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
function v(obj) { if (!obj) return null; return obj.value ?? obj.close ?? obj.price ?? obj.latest ?? null; }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const gold = await readJson(join(BASKET, 'gold.json'));
  const oil = await readJson(join(BASKET, 'oil.json'));
  const silver = await readJson(join(BASKET, 'gold-silver.json'));
  const vix = await readJson(join(BASKET, 'vix.json'));
  const sp500 = await readJson(join(BASKET, 'sp500.json'));
  const copperGold = await readJson(join(BASKET, 'copper-gold.json'));
  const dma = new DerivedMarketAnalytics();
  const r = dma.compute({
    gold: v(gold), oil: v(oil), vix: v(vix), sp500: v(sp500),
    silver: v(silver), copper: v(copperGold),
  });
  const payload = { _meta: { id: 'derived-market-analytics', category: 'market', version: '1.0.0', schema_version: '1.0.0', sources: ['gold','oil','vix','sp500','silver','copper-gold'], calculator: 'DerivedMarketAnalytics', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { signals: r.signals.length } }, data: { derived: r, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('DerivedMarketAnalytics v1.0.0');
  console.log('Ratios:', JSON.stringify({ go: r.goldOilRatio, cg: r.copperGoldRatio, vs: r.vixSp500Ratio, gs: r.goldSilverRatio }));
  console.log('Signals:', r.signals.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
