#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SignalAggregator from '../../apis/sources/signal-aggregator.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ANALYTICS = join(ROOT, 'data', 'analytics');
const OUT_DIR = join(ANALYTICS, 'flow');
const OUT_FILE = join(OUT_DIR, 'signal-aggregator.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const sa = new SignalAggregator({ weights: { conflict: 1.2, market: 1.0, cyber: 0.9, geo: 1.1, infra: 1.0 } });
  // Собираем сигналы из готовых анализаторов
  const cii = await readJson(join(ANALYTICS, 'index', 'country-instability.json'), { data: { countries: {} } });
  const cs = await readJson(join(ANALYTICS, 'flow', 'cross-stream-correlation.json'), { data: { regions: [] } });
  const tc = await readJson(join(ANALYTICS, 'detector', 'threat-classification.json'), { data: { classifications: [] } });
  const gc = await readJson(join(ANALYTICS, 'detector', 'geo-convergence.json'), { data: { hotspots: [] } });
  const mc = await readJson(join(ANALYTICS, 'market', 'market-composite.json'), { data: { composite: null } });
  for (const [code, c] of Object.entries(cii.data?.countries || {})) {
    if (typeof c.score === 'number') sa.add({ category: 'conflict', source: 'cii', entity: code, weight: c.score / 100 });
  }
  for (const r of cs.data?.regions || []) sa.add({ category: 'geo', source: 'csc', entity: r.region, weight: (r.convergenceScore || 0) / 100 });
  for (const t of tc.data?.classifications || []) sa.add({ category: 'cyber', source: 'tc', entity: t.region, weight: t.weightedSeverity / 100 });
  for (const h of gc.data?.hotspots || []) sa.add({ category: 'infra', source: 'gc', entity: h.cellId, weight: h.avgSeverity || 0 });
  if (mc.data?.composite) sa.add({ category: 'market', source: 'mc', entity: 'GLOBAL', weight: mc.data.composite.score / 100 });
  const top = sa.topN(20);
  const byCat = sa.byCategory();
  const payload = { _meta: { id: 'signal-aggregator', category: 'flow', version: '1.0.0', schema_version: '1.0.0', sources: ['country-instability', 'cross-stream-correlation', 'threat-classification', 'geo-convergence', 'market-composite'], calculator: 'SignalAggregator', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total_signals: sa.signals.length, byCategory: byCat } }, data: { top, byCategory: byCat, aggregatedScores: { conflict: sa.aggregatedScore('conflict'), market: sa.aggregatedScore('market'), cyber: sa.aggregatedScore('cyber'), geo: sa.aggregatedScore('geo'), infra: sa.aggregatedScore('infra') }, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('SignalAggregator v1.0.0 — signals:', sa.signals.length);
  console.log('By category:', JSON.stringify(byCat));
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
