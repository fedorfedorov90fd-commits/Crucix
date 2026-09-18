#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SnapshotSystem from '../../apis/sources/snapshot-system.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_DIR = join(ANALYTICS, 'detector');
const OUT_FILE = join(OUT_DIR, 'snapshot-system.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const ss = new SnapshotSystem();
  // Снимок ключевых данных
  const vix = await readJson(join(BASKET, 'vix.json'));
  const gold = await readJson(join(BASKET, 'gold.json'));
  const oil = await readJson(join(BASKET, 'oil.json'));
  const dxy = await readJson(join(BASKET, 'dxy.json'));
  const quakes = await readJson(join(BASKET, 'earthquakes.json'), []);
  const snapshotData = {
    vix: vix?.value ?? vix?.close ?? null,
    gold: gold?.value ?? gold?.close ?? null,
    oil: oil?.value ?? oil?.close ?? null,
    dxy: dxy?.value ?? dxy?.close ?? null,
    earthquakes_count: Array.isArray(quakes) ? quakes.length : 0,
  };
  const snap = ss.take(`snapshot_${Date.now()}`, snapshotData);
  const payload = {
    _meta: { id: 'snapshot-system', category: 'detector', version: '1.0.0', schema_version: '1.0.0', sources: ['vix','gold','oil','dxy','earthquakes'], calculator: 'SnapshotSystem', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { snapshots: ss.snapshots.size, current_checksum: snap.checksum } },
    data: { snapshots: ss.list(), current: { id: snap.id, checksum: snap.checksum, data: snap.data }, total: ss.snapshots.size, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('SnapshotSystem v1.0.0 — снимок создан');
  console.log('Checksum:', snap.checksum);
  console.log('Data:', JSON.stringify(snapshotData));
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
