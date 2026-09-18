#!/usr/bin/env node
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import Watchdog from '../../apis/sources/watchdog.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'watchdog.json');
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const instance = new Watchdog();
  let extra = {};
  if (instance.setLimit) {
    instance.setLimit('worldbank', 20, 3600000);
    instance.setLimit('acled', 10, 60000);
    instance.setLimit('noaa', 30, 60000);
    const testHits = [];
    for (let i = 0; i < 25; i++) testHits.push(instance.hit('worldbank'));
    extra = { allowed: testHits.filter(h => h.allowed).length, blocked: testHits.filter(h => !h.allowed).length };
  }
  if (instance.registerChannel) {
    instance.registerChannel('log', async (a) => console.log('  alert:', a.title || a.type));
    instance.registerChannel('telegram', async (a) => {});
    instance.addRule({ matches: (a) => (a.severity || 0) >= 0.7, channels: ['log', 'telegram'] });
    extra = { testDispatched: await instance.dispatch({ title: 'Test', severity: 0.8, type: 'test' }) };
  }
  if (instance.defineSchema) {
    instance.defineSchema('country', { required: ['code', 'name'], types: { code: 'string', name: 'string', score: 'number' }, min: { score: 0 }, max: { score: 100 } });
    extra = { testValidation: instance.validate('country', { code: 'UKR', name: 'Ukraine', score: 56 }) };
  }
  if (instance.load) {
    const chars = instance.load('country-characteristics');
    const gini = instance.load('gini-index');
    extra = { countries: Object.keys(chars?.countries || {}).length, gini_entries: Object.keys(gini?.gini || {}).length };
  }
  const all = instance.getAll ? instance.getAll() : [];
  const stats = instance.stats ? instance.stats() : { total: all.length };
  const payload = {
    _meta: { id: 'watchdog', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['self'], calculator: 'Watchdog', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats },
    data: { items: all, extra, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('watchdog v1.0.0 — stats:', JSON.stringify(stats));
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
