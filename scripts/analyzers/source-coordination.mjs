#!/usr/bin/env node
// Crucix Analyzer: SourceCoordination v1.0.0
// Читает: news.json, gdelt_news.json
// Пишет: data/analytics/specialist/source-coordination.json
// Назначение: обнаружение координированных публикаций. Когда N формально
// независимых источников публикуют схожий по смыслу заголовок в узком
// временном окне — это сигнал координации (информационная операция).
//
// Отличие от adaptive-news-clustering: тот кластеризует по смыслу без
// анализа времени и источников. Здесь пересечение двух измерений:
// смысловое сходство (cosine > 0.7) И временная синхронность (окно ±30 мин).

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SourceCoordination from '../../apis/sources/source-coordination.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'source-coordination.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

function asArray(d) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  if (Array.isArray(d.articles)) return d.articles;
  if (Array.isArray(d.news)) return d.news;
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.records)) return d.records;
  if (Array.isArray(d.features)) return d.features;
  if (d.data) return asArray(d.data);
  return [];
}

function parseTs(v) {
  if (v == null) return Date.now();
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const news = asArray(await readJson(join(BASKET, 'news.json'), null));
  const gdelt = asArray(await readJson(join(BASKET, 'gdelt_news.json'), null));

  const sc = new SourceCoordination({ windowMinutes: 30, simThreshold: 0.7, minClusterSize: 2 });

  for (const n of news) {
    sc.addPublication({
      id: n.id || null,
      title: n.title || n.name || '',
      description: n.description || n.content || '',
      source: n.source || n.author || 'unknown',
      timestamp: parseTs(n.publishedAt || n.timestamp),
    });
  }
  for (const n of gdelt) {
    sc.addPublication({
      id: n.id || null,
      title: n.title || '',
      description: n.description || '',
      source: n.source || (n.country ? `gdelt-${n.country}` : 'gdelt'),
      timestamp: parseTs(n.timestamp),
    });
  }

  const clusters = sc.detectCoordination();
  const bySource = sc.bySource();
  const stats = sc.stats();

  const payload = {
    _meta: {
      id: 'source-coordination',
      category: 'specialist',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['news', 'gdelt_news'],
      calculator: 'SourceCoordination',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: { publications: sc.publications.length, clusters: clusters.length, by_source: bySource },
      description: 'Координированные публикации: N источников, схожий смысл, узкое временное окно.',
    },
    data: { clusters, by_source: bySource, stats, generated_at: now },
  };

  const body = JSON.stringify({ ...payload, _meta: { ...payload._meta, checksum: '' } });
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('SourceCoordination v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Публикаций:', sc.publications.length);
  console.log('Кластеров координации:', clusters.length);
  console.log('');
  console.log('По источникам:');
  for (const [src, cnt] of Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${src.padEnd(25)} ${cnt}`);
  }
  console.log('');
  console.log('Топ-5 координированных групп:');
  for (const c of clusters.slice(0, 5)) {
    console.log(`  ${c.clusterId}: sources=${c.sourceCount}, size=${c.size}, span=${c.timeSpanMin.toFixed(1)}мин, sim=${c.avgSimilarity.toFixed(2)}, "${c.topTitle.slice(0, 60)}"`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
