#!/usr/bin/env node
// Crucix Analyzer: AdaptiveNewsClustering v1.0.0
// Читает: data/basket/news.json, gdelt.json, rss.json, newsapi-latest.json
// Пишет: data/analytics/semantic/adaptive-news-clustering.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import AdaptiveNewsClustering from '../../apis/sources/adaptive-news-clustering.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'semantic');
const OUT_FILE = join(OUT_DIR, 'adaptive-news-clustering.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

function extractNews(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.articles) return data.articles;
  if (data.features) return data.features.map(f => ({ ...f.properties, lat: f.geometry?.coordinates?.[1], lon: f.geometry?.coordinates?.[0] }));
  if (data.items) return data.items;
  if (data.data && Array.isArray(data.data)) return data.data;
  return [];
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const sources = {
    news: await readJson(join(BASKET, 'news.json')),
    gdelt: await readJson(join(BASKET, 'gdelt.json')),
    rss: await readJson(join(BASKET, 'rss.json')),
    newsapi: await readJson(join(BASKET, 'newsapi-latest.json')),
  };

  const allNews = [];
  for (const [name, data] of Object.entries(sources)) {
    const items = extractNews(data);
    for (const item of items) {
      allNews.push({
        id: item.id || `${name}_${allNews.length}`,
        title: item.title || item.name || '',
        text: item.text || item.description || item.summary || '',
        source: item.source || item.sourceName || name,
        timestamp: item.timestamp || item.date || item.publishedAt || Date.now(),
        lat: item.lat || null,
        lon: item.lon || item.lng || null,
        countryCode: item.countryCode || item.country || null,
      });
    }
  }

  const anc = new AdaptiveNewsClustering({ simThreshold: 0.30, clusterTTL: 7 * 24 * 3600 * 1000 });
  const actions = { created: 0, merged: 0, skipped: 0 };
  for (const n of allNews) {
    try {
      const r = anc.add(n);
      actions[r.action] = (actions[r.action] || 0) + 1;
    } catch (e) {
      // пропускаем
    }
  }

  const topClusters = anc.topClusters(50);

  const payload = {
    _meta: {
      id: 'adaptive-news-clustering',
      category: 'semantic',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['news', 'gdelt', 'rss', 'newsapi-latest'],
      calculator: 'AdaptiveNewsClustering',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: { total_input: allNews.length, ...actions, total_clusters: anc.clusters.size },
      description: 'Кластеризация новостей по TF-IDF + cosine similarity. Группировка связанных событий по заголовкам.',
    },
    data: {
      clusters: topClusters,
      total: topClusters.length,
      generated_at: now,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('AdaptiveNewsClustering v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Входных новостей:', allNews.length);
  console.log('Created:', actions.created, ', Merged:', actions.merged, ', Skipped:', actions.skipped);
  console.log('Кластеров:', anc.clusters.size);
  console.log('');
  console.log('Топ-5 кластеров:');
  for (const c of topClusters.slice(0, 5)) {
    console.log(`  ${c.id}: size=${c.size}, sources=${c.sourceCount}, "${c.topTitle.slice(0, 60)}"`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
