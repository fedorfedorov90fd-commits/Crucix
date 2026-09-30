#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SanctionsPressure from '../../apis/sources/sanctions-pressure.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'sanctions-pressure.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const sp = new SanctionsPressure();
  const ofac = await readJson(join(BASKET, 'ofac.json'), []);
  const ofacData = await readJson(join(BASKET, 'ofac-data.json'), {});
  const sanctions = await readJson(join(BASKET, 'sanction-list.json'), []);
  const all = [...(Array.isArray(ofac) ? ofac : []), ...(Array.isArray(sanctions) ? sanctions : [])];
  for (const s of all) {
    sp.addSanction({ country: s.country || s.entity || s.name, type: s.type || 'sanctions', source: s.source || 'ofac', weight: s.weight || 1 });
  }
  const entries = sp.getAll();
  const payload = { _meta: { id: 'sanctions-pressure', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['ofac','sanction-list'], calculator: 'SanctionsPressure', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { entities: entries.length } }, data: { entities: entries, top: sp.topN(20), total: entries.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('SanctionsPressure v1.0.0 — entities:', entries.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
