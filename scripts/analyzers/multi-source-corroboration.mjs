#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import MultiSourceCorroboration from '../../apis/sources/multi-source-corroboration.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'semantic');
const OUT_FILE = join(OUT_DIR, 'multi-source-corroboration.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const news = await readJson(join(BASKET, 'news.json'), []);
  const gdelt = await readJson(join(BASKET, 'gdelt.json'), []);
  const msc = new MultiSourceCorroboration();
  const newsArr = Array.isArray(news) ? news : (news.articles || []);
  const gdeltArr = Array.isArray(gdelt) ? gdelt : (gdelt.articles || []);
  for (const n of newsArr.slice(0, 30)) msc.addClaim({ id: `claim_news_${n.id || Math.random()}`, text: n.title, source: 'news', credibility: 0.7, supports: true });
  for (const g of gdeltArr.slice(0, 30)) msc.addClaim({ id: `claim_gdelt_${g.id || Math.random()}`, text: g.title || g.name, source: 'gdelt', credibility: 0.6, supports: true });
  const claims = msc.getAll();
  const byVerdict = {};
  for (const c of claims) byVerdict[c.verdict] = (byVerdict[c.verdict] || 0) + 1;
  const payload = { _meta: { id: 'multi-source-corroboration', category: 'semantic', version: '1.0.0', schema_version: '1.0.0', sources: ['news', 'gdelt'], calculator: 'MultiSourceCorroboration', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total_claims: claims.length, byVerdict } }, data: { claims, byVerdict, total: claims.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('MultiSourceCorroboration v1.0.0 — claims:', claims.length);
  console.log('By verdict:', JSON.stringify(byVerdict));
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
