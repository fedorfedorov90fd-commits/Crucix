#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import ScenarioSimulationEngine from '../../apis/sources/scenario-simulation-engine.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const INFRA = join(ROOT, 'data', 'infrastructure');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'scenario-simulation-engine.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const sse = new ScenarioSimulationEngine();
  const infra = await readJson(join(INFRA, 'objects.json'), { objects: [] });
  for (const obj of infra.objects || []) sse.addNode(obj.id, { type: obj.type, cascade: obj.cascade || [] });
  // Несколько сценариев
  sse.defineScenario('taiwan-blockade', { name: 'Блокада Тайваня', severity: 0.95, initialNodes: ['chokepoint-taiwan'] });
  sse.defineScenario('hormuz-closure', { name: 'Закрытие Ормуза', severity: 0.9, initialNodes: ['chokepoint-hormuz'] });
  sse.defineScenario('sevastopol-strike', { name: 'Удар по Севастополю', severity: 0.85, initialNodes: ['mil-sevastopol'] });
  const results = [];
  for (const sc of sse.getAll()) {
    const r = await sse.run(sc.id);
    results.push(r);
  }
  const payload = {
    _meta: { id: 'scenario-simulation-engine', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['infrastructure/objects'], calculator: 'ScenarioSimulationEngine', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: sse.stats() },
    data: { results, stats: sse.stats(), generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('ScenarioSimulationEngine v1.0.0 — nodes:', sse.stats().nodes, ', scenarios:', sse.stats().scenarios);
  for (const r of results) console.log(`  ${r.scenarioId}: ${r.nodesAffected} nodes affected`);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
