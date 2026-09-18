#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SurgeDetection from '../../apis/sources/surge-detection.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'detector');
const OUT_FILE = join(OUT_DIR, 'surge-detection.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const sd = new SurgeDetection({ windowSize: 10, threshold: 1.5 });
  // VIX серия
  const vix = await readJson(join(BASKET, 'vix.json'));
  const gold = await readJson(join(BASKET, 'gold.json'));
  const oil = await readJson(join(BASKET, 'oil.json'));
  const dxy = await readJson(join(BASKET, 'dxy.json'));
  const addSeries = (key, obj) => {
    if (!obj) return;
    const arr = obj.history || obj.data || obj.values || (obj.value ? [{ value: obj.value, timestamp: Date.now() }] : []);
    for (const point of (Array.isArray(arr) ? arr : [])) {
      const v = typeof point === 'number' ? point : (point.value ?? point.close);
      if (typeof v === 'number') sd.add(key, v, point.timestamp || Date.now());
    }
    if (obj.value && !sd.series.has(key)) sd.add(key, obj.value);
  };
  addSeries('vix', vix);
  addSeries('gold', gold);
  addSeries('oil', oil);
  addSeries('dxy', dxy);
  const detections = sd.getAllDetections();
  const payload = { _meta: { id: 'surge-detection', category: 'detector', version: '1.0.0', schema_version: '1.0.0', sources: ['vix','gold','oil','dxy'], calculator: 'SurgeDetection', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { series: sd.series.size, detections: detections.length } }, data: { detections, total: detections.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('SurgeDetection v1.0.0 — series:', sd.series.size, ', detections:', detections.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
