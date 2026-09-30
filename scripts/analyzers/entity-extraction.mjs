#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import EntityExtraction from '../../apis/sources/entity-extraction.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'semantic');
const OUT_FILE = join(OUT_DIR, 'entity-extraction.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const news = await readJson(join(BASKET, 'news.json'), []);
  const ee = new EntityExtraction();
  const newsArr = Array.isArray(news) ? news : (news.articles || []);
  for (const n of newsArr.slice(0, 100)) {
    if (n.title) ee.extract(n.title);
    if (n.description) ee.extract(n.description);
  }
  const top = ee.topN(50);
  const byType = {};
  for (const e of ee.getAll()) byType[e.type] = (byType[e.type] || 0) + 1;
  const payload = { _meta: { id: 'entity-extraction', category: 'semantic', version: '1.0.0', schema_version: '1.0.0', sources: ['news'], calculator: 'EntityExtraction', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total: ee.entities.size, byType } }, data: { entities: ee.getAll(), top, byType, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('EntityExtraction v1.0.0 — entities:', ee.entities.size);
  console.log('By type:', JSON.stringify(byType));
  console.log('Top-5:', top.slice(0, 5).map(e => `${e.text}(${e.type})`).join(', '));
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
