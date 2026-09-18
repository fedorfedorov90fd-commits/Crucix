#!/usr/bin/env node
// Crucix Analyzer: AINewsSynthesis v1.0.0
// Читает: data/basket/news.json, gdelt.json, rss.json
// Пишет: data/analytics/semantic/ai-news-synthesis.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import AINewsSynthesis from '../../apis/sources/ai-news-synthesis.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'semantic');
const OUT_FILE = join(OUT_DIR, 'ai-news-synthesis.json');

async function readJson(p, fallback = null) {
  try { return JSON.parse(await readFile(p, 'utf-8')); }
  catch { return fallback; }
}

function extract(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.articles) return data.articles;
  if (data.items) return data.items;
  if (data.features) return data.features.map(f => ({ ...f.properties, lat: f.geometry?.coordinates?.[1] }));
  return [];
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const news = await readJson(join(BASKET, 'news.json'), []);
  const gdelt = await readJson(join(BASKET, 'gdelt.json'), []);
  const rss = await readJson(join(BASKET, 'rss.json'), []);

  const all = [...extract(news), ...extract(gdelt), ...extract(rss)].slice(0, 50);

  const ai = new AINewsSynthesis();
  const result = await ai.synthesize(all);

  const payload = {
    _meta: {
      id: 'ai-news-synthesis',
      category: 'semantic',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['news', 'gdelt', 'rss'],
      calculator: 'AINewsSynthesis',
      provider: result.provider,
      updated_at: now,
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: { news_count: all.length, provider: result.provider },
      description: 'AI-синтез новостей через Ollama. Группировка, выделение главного, аналитический вывод.',
    },
    data: {
      synthesis: result.synthesis,
      provider: result.provider,
      newsCount: result.newsCount,
      generated_at: now,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('AINewsSynthesis v1.0.0');
  console.log('════════════════════════════════════════════');
  console.log('Новостей:', all.length);
  console.log('Провайдер:', result.provider);
  console.log('Синтез (первые 300):');
  console.log(result.synthesis.slice(0, 300));
  console.log('');
  console.log('Файл:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
