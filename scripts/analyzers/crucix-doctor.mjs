#!/usr/bin/env node
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import CrucixDoctor from '../../apis/sources/crucix-doctor.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'crucix-doctor.json');
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const doctor = new CrucixDoctor({ root: ROOT });
  const diag = doctor.diagnose();
  const payload = {
    _meta: { id: 'crucix-doctor', category: 'specialist', version: '1.0.0', schema_version: '1.0.0', sources: ['apis/sources'], calculator: 'CrucixDoctor', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total_issues: diag.total, bySeverity: diag.bySeverity } },
    data: { issues: diag.issues, total: diag.total, bySeverity: diag.bySeverity, generated_at: now },
  };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('CrucixDoctor v1.0.0 — issues:', diag.total, ', by severity:', JSON.stringify(diag.bySeverity));
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
