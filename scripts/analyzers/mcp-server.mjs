#!/usr/bin/env node
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import MCPServer from '../../apis/sources/mcp-server.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'mcp-server.json');
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const mcp = new MCPServer();
  // Регистрируем ключевые инструменты
  mcp.registerTool('get_country_risk', 'Get country risk score', { type: 'object', properties: { code: { type: 'string' } } }, async (args) => ({ code: args.code, score: 50 }));
  mcp.registerTool('get_top_risks', 'Get top risk countries', { type: 'object', properties: { n: { type: 'number' } } }, async (args) => ({ top: [] }));
  mcp.registerTool('get_market_score', 'Get market composite score', {}, async () => ({ score: 45 }));
  mcp.registerTool('get_infrastructure', 'Get infrastructure stats', {}, async () => ({ nodes: 114 }));
  mcp.registerTool('get_conflicts', 'Get active conflicts', {}, async () => ({ conflicts: [] }));
  const tools = mcp.listTools();
  const payload = {
    _meta: { id: 'mcp-server', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['self'], calculator: 'MCPServer', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: mcp.stats() },
    data: { tools, resources: mcp.listResources(), stats: mcp.stats(), generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('MCPServer v1.0.0 — tools:', mcp.stats().tools, ', resources:', mcp.stats().resources);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
