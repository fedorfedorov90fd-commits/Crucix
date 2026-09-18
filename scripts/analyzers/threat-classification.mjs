#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import ThreatClassification from '../../apis/sources/threat-classification.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'detector');
const OUT_FILE = join(OUT_DIR, 'threat-classification.json');

async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const acled = await readJson(join(BASKET, 'acled.json'), { events: [] });
  const cyber = await readJson(join(BASKET, 'cyber-attacks.json'), []);
  const events = acled.events || (Array.isArray(acled) ? acled : []);

  const tc = new ThreatClassification();
  let i = 0;
  for (const ev of events) {
    tc.classify({
      id: ev.id || `acled_${++i}`,
      region: ev.country || ev.region || 'GLOBAL',
      types: ['military'],
      severity: Math.min((ev.fatalities || 0) / 50, 1),
      timestamp: ev.event_date ? new Date(ev.event_date).getTime() : Date.now(),
    });
  }
  for (const c of (cyber || [])) {
    tc.classify({
      id: c.id || `cyber_${++i}`,
      region: c.country || 'GLOBAL',
      types: ['cyber'],
      severity: 0.6,
      timestamp: c.timestamp || Date.now(),
    });
  }

  const all = tc.getAll();
  const byLevel = {};
  for (const c of all) byLevel[c.level] = (byLevel[c.level] || 0) + 1;

  const payload = {
    _meta: { id: 'threat-classification', category: 'detector', version: '1.0.0', schema_version: '1.0.0', sources: ['acled', 'cyber-attacks'], calculator: 'ThreatClassification', updated_at: now, period: 'latest', duration_ms: Date.now() - t0, checksum: '', stats: { total: all.length, byLevel }, description: 'Классификация угроз по типам и уровням опасности.' },
    data: { classifications: all, top: tc.topN(20), total: all.length, byLevel, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('ThreatClassification v1.0.0 — обработано:', all.length);
  console.log('По уровням:', JSON.stringify(byLevel));
  console.log('Топ-3:');
  for (const c of tc.topN(3)) console.log(`  ${c.id} (${c.region}): ${c.weightedSeverity} [${c.level}] types=${c.types.join(',')}`);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
