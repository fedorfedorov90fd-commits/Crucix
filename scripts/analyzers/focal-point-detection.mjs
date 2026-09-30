#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import FocalPointDetection from '../../apis/sources/focal-point-detection.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'detector');
const OUT_FILE = join(OUT_DIR, 'focal-point-detection.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const acled = await readJson(join(BASKET, 'acled.json'), { events: [] });
  const quakes = await readJson(join(BASKET, 'earthquakes.json'), []);
  const fpd = new FocalPointDetection({ radiusKm: 300, minSignals: 2 });
  for (const ev of (acled.events || acled || [])) {
    if (ev.lat && ev.lon) fpd.ingest({ id: ev.id, lat: ev.lat, lon: ev.lon, stream: 'conflict', severity: Math.min((ev.fatalities || 0) / 50, 1) });
  }
  for (const eq of (quakes || [])) {
    if (eq.lat && eq.lng) fpd.ingest({ id: eq.id, lat: eq.lat, lon: eq.lng, stream: 'earthquake', severity: Math.min((eq.magnitude || 0) / 8, 1) });
  }
  const top = fpd.topFocalPoints(20);
  const payload = { _meta: { id: 'focal-point-detection', category: 'detector', version: '1.0.0', schema_version: '1.0.0', sources: ['acled', 'earthquakes'], calculator: 'FocalPointDetection', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total_points: fpd.points.size, focal_points: top.length } }, data: { focalPoints: top, total: top.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('FocalPointDetection v1.0.0 — точек:', fpd.points.size, ', фокусных:', top.length);
  for (const p of top.slice(0, 5)) console.log(`  ${p.id}: count=${p.signalCount}, streams=${p.streamCount}, score=${p.focalScore}`);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
