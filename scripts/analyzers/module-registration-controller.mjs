#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import ModuleRegistrationController from '../../apis/sources/module-registration-controller.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'module-registration-controller.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const mrc = new ModuleRegistrationController();
  const modules = await readJson(join(ROOT, 'server', 'modules.json'), []);
  const entries = Array.isArray(modules) ? modules : (modules.modules || []);
  for (const m of entries) {
    try { mrc.register({ id: m.id, file: m.path, isActive: true }); } catch {}
  }
  const health = mrc.healthCheck();
  const payload = {
    _meta: { id: 'module-registration-controller', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['modules.json'], calculator: 'ModuleRegistrationController', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: mrc.stats() },
    data: { modules: mrc.getAll(), health, stats: mrc.stats(), generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('ModuleRegistrationController v1.0.0 — total:', mrc.stats().total, ', active:', mrc.stats().active);
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
