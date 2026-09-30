#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import ETFFlowAnalysis from '../../apis/sources/etf-flow-analysis.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'market');
const OUT_FILE = join(OUT_DIR, 'etf-flow-analysis.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const etf = new ETFFlowAnalysis();
  const fred = await readJson(join(BASKET, 'fred.json'), {});
  const sp500 = await readJson(join(BASKET, 'sp500.json'));
  const gold = await readJson(join(BASKET, 'gold.json'));
  const oil = await readJson(join(BASKET, 'oil.json'));
  const vix = await readJson(join(BASKET, 'vix.json'));
  // Синтетические потоки на основе текущих цен
  if (sp500?.value || sp500?.close) etf.addFlow('SPY', (sp500.value || sp500.close) * 1000000, Date.now());
  if (gold?.value || gold?.close) etf.addFlow('GLD', (gold.value || gold.close) * 500000, Date.now());
  if (oil?.value || oil?.close) etf.addFlow('USO', (oil.value || oil.close) * 10000, Date.now());
  if (vix?.value || vix?.close) etf.addFlow('VXX', (vix.value || vix.close) * 100000, Date.now());
  const all = etf.getAll();
  const payload = {
    _meta: { id: 'etf-flow-analysis', category: 'market', version: '1.0.0', schema_version: '1.0.0', sources: ['sp500','gold','oil','vix'], calculator: 'ETFFlowAnalysis', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total: all.length } },
    data: { flows: all, top: etf.topInflows(5), topOutflows: etf.topOutflows(5), total: all.length, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('ETFFlowAnalysis v1.0.0 — flows:', all.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
