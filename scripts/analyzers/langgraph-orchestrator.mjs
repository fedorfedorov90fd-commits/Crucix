#!/usr/bin/env node
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import LangGraphOrchestrator from '../../apis/sources/langgraph-orchestrator.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'langgraph-orchestrator.json');
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const lgo = new LangGraphOrchestrator();
  lgo.addNode('start', async () => ({ ok: true }));
  lgo.addNode('process', async (state) => ({ ...state, processed: true }));
  lgo.addNode('finish', async (state) => ({ ...state, done: true }));
  lgo.addEdge('start', 'process');
  lgo.addEdge('process', 'finish');
  const result = await lgo.execute('start', { initial: 'data' });
  const payload = {
    _meta: { id: 'langgraph-orchestrator', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['self'], calculator: 'LangGraphOrchestrator', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: lgo.stats() },
    data: { executionResult: result, stats: lgo.stats(), generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('LangGraphOrchestrator v1.0.0 — nodes:', lgo.stats().nodes, ', edges:', lgo.stats().edges);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
