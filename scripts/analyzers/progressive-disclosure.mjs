#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import ProgressiveDisclosure from '../../apis/sources/progressive-disclosure.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_DIR = join(ANALYTICS, 'specialist');
const OUT_FILE = join(OUT_DIR, 'progressive-disclosure.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const pd = new ProgressiveDisclosure();
  const src = await readJson(join(ANALYTICS, 'specialist', 'strategic-risk-composite.json'), { data: { countries: {} } });
  const top10 = Object.entries(src.data?.countries || {})
    .filter(([k, v]) => typeof v.score === 'number')
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 10);
  for (const [code, r] of top10) {
    pd.define(code, [
      { level: 'summary', data: { code, score: r.score } },
      { level: 'medium', data: { code, score: r.score, tier: r.tier, regime: r.regime } },
      { level: 'full', data: r },
    ]);
  }
  const items = pd.getAll();
  const payload = {
    _meta: { id: 'progressive-disclosure', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['strategic-risk-composite'], calculator: 'ProgressiveDisclosure', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { items: items.length } },
    data: { items: items.map(id => ({ id, levels: pd.getDetailLevels(id) })), generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('ProgressiveDisclosure v1.0.0 — items:', items.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
