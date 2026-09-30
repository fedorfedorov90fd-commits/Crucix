#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import DiplomaticTracker from '../../apis/sources/diplomatic-tracker.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'flow');
const OUT_FILE = join(OUT_DIR, 'diplomatic-tracker.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const instance = new DiplomaticTracker();
  const data = await readJson(join(BASKET, 'events.json'), null);
  const items = Array.isArray(data) ? data : (data?.items || data?.events || data?.data || []);
  let count = 0;
  for (const item of items.slice(0, 500)) {
    if (instance.add) { instance.add(item); count++; }
    else if (instance.update) { instance.update(item.country || item.code || item.id || 'GLOBAL', item); count++; }
  }
  const all = (instance.getAll ? instance.getAll() : []) || [];
  const payload = {
    _meta: { id: 'diplomatic-tracker', category: 'flow', version: '1.0.0', schema_version: '1.0.0', sources: ['events.json'], calculator: 'DiplomaticTracker', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { items_processed: count, total_result: all.length } },
    data: { items: all, top: (instance.topBySeverity ? instance.topBySeverity(20) : instance.topAnomalies ? instance.topAnomalies(20) : all.slice(0, 20)), total: all.length, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('diplomatic-tracker v1.0.0 — items:', count, ', result:', all.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
