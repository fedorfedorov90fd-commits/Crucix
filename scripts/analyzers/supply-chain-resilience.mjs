#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SupplyChainResilience from '../../apis/sources/supply-chain-resilience.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_DIR = join(ANALYTICS, 'flow');
const OUT_FILE = join(OUT_DIR, 'supply-chain-resilience.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const scr = new SupplyChainResilience();
  const sc = await readJson(join(ANALYTICS, 'specialist', 'supply-chain-analysis.json'), { data: {} });
  const rx = await readJson(join(ANALYTICS, 'flow', 'route-explorer.json'), { data: { routes: [] } });
  // Добавляем цепочки из инфраструктуры
  for (const r of (rx.data?.routes || [])) {
    scr.addChain({ id: `${r.from}-${r.to}`, alternatives: r.alternatives, hhiLevel: 'diversified' });
  }
  const all = scr.getAll();
  const payload = { _meta: { id: 'supply-chain-resilience', category: 'flow', version: '1.0.0', schema_version: '1.0.0', sources: ['route-explorer','supply-chain-analysis'], calculator: 'SupplyChainResilience', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { chains: all.length } }, data: { chains: all, weakest: scr.weakest(5), total: all.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('SupplyChainResilience v1.0.0 — chains:', all.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
