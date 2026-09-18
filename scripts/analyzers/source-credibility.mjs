#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SourceCredibility from '../../apis/sources/source-credibility.mjs';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'semantic');
const OUT_FILE = join(OUT_DIR, 'source-credibility.json');
async function readJson(p, fb = null) { try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return fb; } }
async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();
  const sc = new SourceCredibility();
  // Известные источники + стартовые scores
  const known = { 'reuters': 0.9, 'bbc': 0.85, 'ap': 0.88, 'afp': 0.85, 'associated press': 0.88, 'cnn': 0.7, 'fox news': 0.55, 'rt': 0.35, 'tass': 0.45, 'xinhua': 0.55, 'interfax': 0.6, 'bloomberg': 0.85, 'wsj': 0.8, 'ft': 0.82, 'economist': 0.85, 'al jazeera': 0.75, 'dw': 0.8, 'guardian': 0.78, 'washington post': 0.75, 'nytimes': 0.78 };
  for (const [s, score] of Object.entries(known)) sc.register(s, score);
  // Загружаем новости и наблюдаем источники
  const news = await readJson(join(BASKET, 'news.json'), []);
  const newsArr = Array.isArray(news) ? news : (news.articles || []);
  for (const n of newsArr.slice(0, 100)) {
    const src = String(n.source || n.sourceName || '').toLowerCase().trim();
    if (src && !sc.sources.has(src)) sc.register(src, 0.5);
  }
  const all = sc.getAll();
  const payload = { _meta: { id: 'source-credibility', category: 'semantic', version: '1.0.0', schema_version: '1.0.0', sources: ['news'], calculator: 'SourceCredibility', updated_at: now, duration_ms: Date.now() - t0, checksum: '', stats: { total_sources: all.length } }, data: { sources: all, top: sc.topN(20), bottom: sc.bottomN(10), total: all.length, generated_at: now } };
  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log('SourceCredibility v1.0.0 — источников:', all.length);
  console.log('Top-3:', sc.topN(3).map(s => `${s.source}=${s.score.toFixed(2)}`).join(', '));
}
main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
