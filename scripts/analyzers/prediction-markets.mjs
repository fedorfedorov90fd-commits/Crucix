#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import PredictionMarkets from '../../apis/sources/prediction-markets.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'market');
const OUT_FILE = join(OUT_DIR, 'prediction-markets.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const pm = new PredictionMarkets();
  const data = await readJson(join(BASKET, 'predictions.json'), { markets: [] });
  const markets = data.markets || (Array.isArray(data) ? data : []);
  for (const m of markets) pm.addMarket(m);
  const all = pm.getAll();
  const payload = { _meta: { id: 'prediction-markets', category: 'market', version: '1.0.0', schema_version: '1.0.0', sources: ['predictions'], calculator: 'PredictionMarkets', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total: all.length } }, data: { markets: all, top: pm.topByVolume(10), highCertainty: pm.highCertainty(), total: all.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('PredictionMarkets v1.0.0 — markets:', all.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
