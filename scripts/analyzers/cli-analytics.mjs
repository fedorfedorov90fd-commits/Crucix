#!/usr/bin/env node
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import CLIAnalytics from '../../apis/sources/cli-analytics.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'cli-analytics.json');
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const cli = new CLIAnalytics();
  cli.register('top-risks', 'Top risk countries', async () => ({ cmd: 'top-risks' }));
  cli.register('market', 'Market composite', async () => ({ cmd: 'market' }));
  cli.register('infra', 'Infrastructure stats', async () => ({ cmd: 'infra' }));
  cli.register('conflicts', 'Active conflicts', async () => ({ cmd: 'conflicts' }));
  const commands = cli.listCommands();
  const payload = {
    _meta: { id: 'cli-analytics', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['self'], calculator: 'CLIAnalytics', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { commands: commands.length } },
    data: { commands, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('CLIAnalytics v1.0.0 — commands:', commands.length);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
