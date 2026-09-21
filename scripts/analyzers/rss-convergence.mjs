#!/usr/bin/env node
// Crucix Analyzer: RssConvergence v2.0.1
// Читает: rsshub.json (basket.v1, 500 documents — основной),
//         rss-universal.json (basket.v1 — fallback),
//         newsapi-latest.json, newsapi-real.json (дополнительные каналы).
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
//
// СИНТЕЗ ИЗ ДУБЛЕЙ (21.09.2026):
//   - scripts/analyzers/rss-convergence-дубль.mjs (10890 б)
//   - scripts/analysis/rss-convergence-дубль.mjs (11294 б)
//   Взят код с защитой typeof source === 'string' из analyzers/дубля,
//   полные комментарии из analysis/дубля.
//
// История версий:
//   v1.0.0 (18.09.2026): источники rss-latest.json + rss.json (мёртвые).
//   v2.0.0 (20.09.2026): источники переключены на rsshub.json + rss-universal.json.
//     Чтение через basket-loader.mjs (loadWithFallback). Защита от [object Object]
//     в toArticleFromRsshub через typeof source === 'string'.
//   v2.0.1 (21.09.2026): синтез двух дублей в канон scripts/analyzers/.

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import RssConvergence from '../../apis/sources/rss-convergence.mjs';
import { loadWithFallback } from '../../apis/sources/lib/basket-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'semantic');
const OUT_FILE = join(OUT_DIR, 'rss-convergence.json');

// ───────────────────────────────────────────────────────────
//  Загрузка через basket-loader
// ───────────────────────────────────────────────────────────

async function loadBasket(fileName) {
  const basketFile = join(BASKET, fileName);
  const res = await loadWithFallback({
    basketFile,
    fallbackData: null,
    hint: `сборщик для ${fileName} не найден или файл отсутствует`,
  });
  if (res.source === 'basket-v1' && res.data) return { data: res.data, source: 'basket-v1' };
  if (res.source === 'basket-legacy' && res.legacy) return { data: res.legacy, source: 'legacy' };
  return { data: null, source: res.source || 'absent' };
}

// Универсальное извлечение массива из разных форматов:
// basket.v1 {documents:[]} | легаси {items:[]}, {articles:[]}, {news:[]}, [] | {data:{...}}.
function asArray(d) {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d !== 'object') return [];
  if (Array.isArray(d.documents)) return d.documents;
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

// ───────────────────────────────────────────────────────────
//  Нормализация записи под RssConvergence.addArticle
//  Совместимость: basket.v1 (documents) + легаси (items/articles)
// ───────────────────────────────────────────────────────────

function toArticleFromRsshub(it) {
  const source = (it.extra && it.extra.source) || it.source || it.sourceUrl || 'rsshub';
  const rawTs = it.timestamp || it.pubDate || it.publishedAt || it.date || null;
  const text = stripCdata(it.text || it.description || '');
  const title = stripCdata(it.title || (text ? text.slice(0, 120) : ''));
  return {
    id: it.id || null,
    title,
    description: text,
    // Защита от [object Object]: source может быть объектом {id, name}
    source: typeof source === 'string' ? source : String((source && source.name) || 'rsshub'),
    sourceUrl: it.url || it.link || '',
    timestamp: parseTs(rawTs),
  };
}

function toArticleFromLegacy(it, fallbackSource) {
  const raw = it.source || it.author || fallbackSource;
  // Защита от [object Object]: source может быть объектом {id, name}
  const source = typeof raw === 'string' ? raw : String((raw && raw.name) || fallbackSource);
  const rawTs = it.pubDate || it.publishedAt || it.collectedAt || null;
  return {
    id: it.id || null,
    title: stripCdata(it.title || ''),
    description: stripCdata(it.description || it.content || ''),
    source,
    sourceUrl: stripCdata(it.sourceUrl || it.url || ''),
    timestamp: parseTs(rawTs),
  };
}

// ───────────────────────────────────────────────────────────
//  main
// ───────────────────────────────────────────────────────────

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  // Загрузка свежих источников (basket.v1)
  const rsshubRes = await loadBasket('rsshub.json');
  const rssUniversalRes = await loadBasket('rss-universal.json');
  // Загрузка старых каналов (легаси / дополнительных)
  const newsapiLatestRes = await loadBasket('newsapi-latest.json');
  const newsapiRealRes = await loadBasket('newsapi-real.json');

  const rsshubArr = asArray(rsshubRes.data);
  const rssUniversalArr = asArray(rssUniversalRes.data);
  const newsapiLatestArr = asArray(newsapiLatestRes.data);
  const newsapiRealArr = asArray(newsapiRealRes.data);

  const rc = new RssConvergence({
    windowHours: 168,
    simThreshold: 0.35,
    minSources: 3,
    mode: 'auto',
  });

  const loaded = {};

  // Основной источник: rsshub.json (basket.v1, 500 documents)
  for (const it of rsshubArr) rc.addArticle(toArticleFromRsshub(it));
  loaded['rsshub'] = { count: rsshubArr.length, source: rsshubRes.source };

  // Дополнительный: rss-universal.json
  for (const it of rssUniversalArr) rc.addArticle(toArticleFromRsshub(it));
  loaded['rss-universal'] = { count: rssUniversalArr.length, source: rssUniversalRes.source };

  // Дополнительные каналы (легаси)
  for (const it of newsapiLatestArr) rc.addArticle(toArticleFromLegacy(it, 'newsapi-latest'));
  loaded['newsapi-latest'] = { count: newsapiLatestArr.length, source: newsapiLatestRes.source };

  for (const it of newsapiRealArr) rc.addArticle(toArticleFromLegacy(it, 'newsapi-real'));
  loaded['newsapi-real'] = { count: newsapiRealArr.length, source: newsapiRealRes.source };

  // Расчёт
  const stories = rc.detectConvergentStories();
  const bySource = rc.bySource();
  const stats = rc.stats();

  const payload = {
    _meta: {
      id: 'rss-convergence',
      category: 'semantic',
      version: '2.0.1',
      schema_version: '2.0.1',
      sources: ['rsshub', 'rss-universal', 'newsapi-latest', 'newsapi-real'],
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
  console.log('RssConvergence v2.0.1 (синтез) — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Статей загружено:', rc.articles.length);
  console.log('  rsshub         :', loaded['rsshub'].count, '(' + loaded['rsshub'].source + ')');
  console.log('  rss-universal  :', loaded['rss-universal'].count, '(' + loaded['rss-universal'].source + ')');
  console.log('  newsapi-latest :', loaded['newsapi-latest'].count, '(' + loaded['newsapi-latest'].source + ')');
  console.log('  newsapi-real   :', loaded['newsapi-real'].count, '(' + loaded['newsapi-real'].source + ')');
  console.log('Режим:', rc.mode, '| effectiveNow:', rc.stats().effectiveNow);
  console.log('Уникальных источников:', Object.keys(bySource).length);
  console.log('Convergent stories (5+ источников):', stories.length);
  console.log('');
  console.log('По источникам (топ-10):');
  const topSources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [src, cnt] of topSources) {
    console.log('  ' + src.padEnd(30) + ' ' + cnt);
  }
  console.log('');
  console.log('Топ-5 convergent stories:');
  for (const s of stories.slice(0, 5)) {
    console.log('  sources=' + s.sourceCount + ', window=' + s.timeSpanHours.toFixed(1) + 'h, sim=' + s.avgSimilarity.toFixed(2) + ', "' + s.topTitle.slice(0, 60) + '"');
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
