#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import BaselineAlerting from '../../apis/sources/baseline-alerting.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'detector');
const OUT_FILE = join(OUT_DIR, 'baseline-alerting.json');

async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const vix = await readJson(join(BASKET, 'vix.json'));
  const dxy = await readJson(join(BASKET, 'dxy.json'));
  const gold = await readJson(join(BASKET, 'gold.json'));
  const oil = await readJson(join(BASKET, 'oil.json'));

  // Исторические baseline — упрощённо (реальные значения из долгосрочных данных)
  const BASELINES = {
    vix: { mean: 18, stddev: 5, samples: 365 },
    dxy: { mean: 100, stddev: 3, samples: 365 },
    gold: { mean: 2000, stddev: 200, samples: 365 },
    oil: { mean: 75, stddev: 12, samples: 365 },
  };

  const ba = new BaselineAlerting();
  for (const [k, v] of Object.entries(BASELINES)) ba.setBaseline(k, v);

  const inputs = {
    vix: vix?.value ?? vix?.close ?? null,
    dxy: dxy?.value ?? dxy?.close ?? null,
    gold: gold?.value ?? gold?.close ?? null,
    oil: oil?.value ?? oil?.close ?? null,
  };

  for (const [k, v] of Object.entries(inputs)) {
    if (typeof v === 'number') ba.check(k, v);
  }

  const alerts = ba.getAllAlerts();
  const byLevel = { critical: 0, alert: 0, warn: 0 };
  for (const a of alerts) byLevel[a.level] = (byLevel[a.level] || 0) + 1;

  const payload = {
    _meta: { id: 'baseline-alerting', category: 'detector', version: '1.0.0', schema_version: '1.0.0', sources: ['vix', 'dxy', 'gold', 'oil'], calculator: 'BaselineAlerting', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { alerts: alerts.length, byLevel }, description: 'Пороговые уведомления: отклонение от baseline (z-score).' },
    data: { alerts, byLevel, baselines: Object.fromEntries(ba.baselines), currentValues: inputs, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('BaselineAlerting v1.0.0 — алертов:', alerts.length);
  console.log('По уровням:', JSON.stringify(byLevel));
  for (const a of alerts) console.log(`  ${a.level.toUpperCase()} ${a.key}: ${a.currentValue} (baseline ${a.baselineMean}, z=${a.zScore})`);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
