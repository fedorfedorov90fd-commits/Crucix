#!/usr/bin/env node
// Crucix Analyzer: RssConvergence v1.0.0
// Читает: rss-latest.json (500 записей), rss.json, newsapi-latest.json, newsapi-real.json
// Пишет: data/analytics/semantic/rss-convergence.json
//
// Назначение: обнаружение convergent stories — новостных тем, которые
// независимо подхватили 5+ источников в узком временном окне.
//
// ОТЛИЧИЕ ОТ СОСЕДНИХ МОДУЛЕЙ:
//   adaptive-news-clustering — кластеризация по смыслу БЕЗ времени.
//   source-coordination — координация (кто синхронно публикует, окно ±30 мин).
//   rss-convergence — массовость (сколько источников подхватили, окно 6 часов).
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Convergent story — тема, которую независимо подхватили N источников.
//   Чем больше независимых источников и чем короче окно — тем сильнее
//   сигнал. Это классический принцип «мультиисточникового подтверждения».
//   Один источник может ошибиться, пять независимых — нет.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import RssConvergence from '../../apis/sources/rss-convergence.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'semantic');
const OUT_FILE = join(OUT_DIR, 'rss-convergence.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

function asArray(d) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.articles)) return d.articles;
  if (Array.isArray(d.news)) return d.news;
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

function stripCdata(s) {
  if (!s) return '';
  return String(s).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const rssLatest = asArray(await readJson(join(BASKET, 'rss-latest.json'), null));
  const rss = asArray(await readJson(join(BASKET, 'rss.json'), null));
  const newsapiLatest = asArray(await readJson(join(BASKET, 'newsapi-latest.json'), null));
  const newsapiReal = asArray(await readJson(join(BASKET, 'newsapi-real.json'), null));

  const rc = new RssConvergence({
    windowHours: 168,
    simThreshold: 0.35,
    minSources: 3,
    mode: 'auto',
  });

  const loaded = {};

  for (const n of rssLatest) {
    rc.addArticle({
      id: n.id || null,
      title: stripCdata(n.title || ''),
      description: stripCdata(n.description || ''),
      source: n.source || 'rss',
      sourceUrl: stripCdata(n.sourceUrl || ''),
      timestamp: parseTs(n.pubDate || n.collectedAt),
    });
  }
  loaded['rss-latest'] = rssLatest.length;

  for (const n of rss) {
    rc.addArticle({
      id: n.id || null,
      title: n.title || '',
      description: n.description || n.content || '',
      source: n.source || n.author || 'rss',
      timestamp: parseTs(n.publishedAt),
    });
  }
  loaded['rss'] = rss.length;

  for (const n of newsapiLatest) {
    rc.addArticle({
      id: n.id || null,
      title: n.title || '',
      description: n.description || '',
      source: n.source || 'newsapi',
      timestamp: parseTs(n.publishedAt),
    });
  }
  loaded['newsapi-latest'] = newsapiLatest.length;

  for (const n of newsapiReal) {
    rc.addArticle({
      id: n.id || null,
      title: n.title || '',
      description: n.description || '',
      source: n.source || 'newsapi-real',
      timestamp: parseTs(n.publishedAt),
    });
  }
  loaded['newsapi-real'] = newsapiReal.length;

  const stories = rc.detectConvergentStories();
  const bySource = rc.bySource();
  const stats = rc.stats();

  const payload = {
    _meta: {
      id: 'rss-convergence',
      category: 'semantic',
      version: '1.0.3',
      schema_version: '1.0.3',
      sources: ['rss-latest', 'rss', 'newsapi-latest', 'newsapi-real'],
      calculator: 'RssConvergence',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: {
        articles: rc.articles.length,
        unique_sources: Object.keys(bySource).length,
        convergent_stories: stories.length,
        by_source: loaded,
      },
      description: 'RSS-convergence: новостные сюжеты, которые независимо подхватили 5+ источников в окне 6 часов.',
    },
    data: {
      stories,
      total: stories.length,
      by_source: bySource,
      stats,
      generated_at: now,
    },
  };

  const body = JSON.stringify({ ...payload, _meta: { ...payload._meta, checksum: '' } });
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('RssConvergence v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Статей загружено:', rc.articles.length);
  console.log('Режим:', rc.mode, '| effectiveNow:', rc.stats().effectiveNow);
  console.log('Уникальных источников:', Object.keys(bySource).length);
  console.log('Convergent stories (5+ источников):', stories.length);
  console.log('');
  console.log('По источникам (топ-10):');
  const topSources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [src, cnt] of topSources) {
    console.log(`  ${src.padEnd(25)} ${cnt}`);
  }
  console.log('');
  console.log('Топ-5 convergent stories:');
  for (const s of stories.slice(0, 5)) {
    console.log(`  sources=${s.sourceCount}, window=${s.timeSpanHours.toFixed(1)}h, sim=${s.avgSimilarity.toFixed(2)}, "${s.topTitle.slice(0, 60)}"`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
