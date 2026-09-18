#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import DashboardIndicators from '../../apis/sources/dashboard-indicators.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_DIR = join(ANALYTICS, 'specialist');
const OUT_FILE = join(OUT_DIR, 'dashboard-indicators.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const di = new DashboardIndicators();
  const mc = await readJson(join(ANALYTICS, 'market', 'market-composite.json'), { data: { composite: null } });
  const src = await readJson(join(ANALYTICS, 'specialist', 'strategic-risk-composite.json'), { data: { countries: {} } });
  const tc = await readJson(join(ANALYTICS, 'detector', 'threat-classification.json'), { data: { classifications: [] } });
  if (mc.data?.composite) di.addIndicator('market_score', mc.data.composite.score, { category: 'market', unit: 'score' });
  const topRisks = Object.entries(src.data?.countries || {}).filter(([k, v]) => typeof v.score === 'number').sort((a, b) => b[1].score - a[1].score).slice(0, 5);
  di.addIndicator('top_risk_countries', topRisks.map(([c, r]) => ({ code: c, score: r.score })), { category: 'risk' });
  di.addIndicator('threats_total', (tc.data?.classifications || []).length, { category: 'threats' });
  const payload = {
    _meta: { id: 'dashboard-indicators', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['market-composite','strategic-risk-composite','threat-classification'], calculator: 'DashboardIndicators', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { indicators: di.getAll().length } },
    data: { indicators: di.getAll(), dashboard: di.toDashboard(), generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('DashboardIndicators v1.0.0 — indicators:', di.getAll().length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
