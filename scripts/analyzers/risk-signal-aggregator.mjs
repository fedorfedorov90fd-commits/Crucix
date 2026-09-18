#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import RiskSignalAggregator from '../../apis/sources/risk-signal-aggregator.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_DIR = join(ANALYTICS, 'flow');
const OUT_FILE = join(OUT_DIR, 'risk-signal-aggregator.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const rsa = new RiskSignalAggregator();
  const sr = await readJson(join(ANALYTICS, 'specialist', 'strategic-risk-composite.json'), { data: { countries: {} } });
  for (const [code, c] of Object.entries(sr.data?.countries || {})) {
    if (typeof c.score === 'number') rsa.add({ region: code, severity: c.score / 100, source: 'src' });
  }
  const top = rsa.topRegions(20);
  const payload = { _meta: { id: 'risk-signal-aggregator', category: 'flow', version: '1.0.0', schema_version: '1.0.0', sources: ['strategic-risk-composite'], calculator: 'RiskSignalAggregator', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { signals: rsa.total(), regions: top.length } }, data: { regions: top, total_signals: rsa.total(), total_regions: top.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('RiskSignalAggregator v1.0.0 — signals:', rsa.total(), ', regions:', top.length);
  for (const r of top.slice(0, 5)) console.log(`  ${r.region}: riskScore=${r.riskScore.toFixed(1)}`);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
