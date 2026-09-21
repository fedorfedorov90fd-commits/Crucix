#!/usr/bin/env node
/**
 * Crucix Collector: newsapi-real — замена NewsAPI на GDELT + HN (без ключей).
 * Версия 2.0.0. Принят 20.09.2026.
 * Правило 12.2: NewsAPI требует ключ → заменён на GDELT + HN.
 * ВАЖНО: читает из data/basket/ (legacy-путь), но сохраняется через saveRaw → raw + накладная.
 * Формат: {source, updated, note, count, articles:[{id,title,url,source,publishedAt}]}. Тип — events.
 */
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
const LOGS = join(__dirname, '..', '..', 'logs', 'collectors');

async function log(msg) {
  await fs.mkdir(LOGS, { recursive: true });
  await fs.appendFile(join(LOGS, 'collect-newsapi-real.log'), `[${new Date().toISOString()}] ${msg}\n`);
}

async function readJson(name) {
  try { return JSON.parse(await fs.readFile(join(BASKET, name), 'utf-8')); } catch { return null; }
}

export async function collectNewsApiReal() {
  await log('Запуск collect-newsapi-real (замена NewsAPI)');
  const articles = [];

  const gdelt = await readJson('gdelt.json');
  if (gdelt?.articles) {
    for (const a of gdelt.articles.slice(0, 100)) {
      articles.push({
        id: a.url || `gdelt_${Math.random()}`,
        title: a.title,
        url: a.url,
        source: a.domain || 'GDELT',
        publishedAt: a.seendate || new Date().toISOString(),
      });
    }
  }

  const hn = await readJson('hackernews-top.json');
  if (hn?.items) {
    for (const a of hn.items) {
      articles.push({
        id: `hn_${a.id}`,
        title: a.title,
        url: a.url,
        source: 'HackerNews',
        publishedAt: new Date((a.time || Date.now() / 1000) * 1000).toISOString(),
      });
    }
  }

  const result = {
    source: 'NewsAPI-replacement (GDELT + HN)',
    updated: new Date().toISOString(),
    note: 'NewsAPI требует ключ. Согласно правилу 12.2 заменён на GDELT и HackerNews.',
    count: articles.length,
    articles,
  };

  const saveResult = await saveRaw('newsapi-real', result, {
    collector: 'collect-newsapi-real.mjs',
    source: 'GDELT + HackerNews',
    source_url: 'https://api.gdeltproject.org/',
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: articles.length,
    notes: `Замена NewsAPI (правило 12.2): ${articles.length} статей из GDELT + HN; basket не перезаписывается`,
    backwardCompat: false,
  });
  await log(`Сохранено ${articles.length} → ${saveResult.raw_file}`);
  console.log(`[NewsAPI-replacement] OK ${articles.length} → ${saveResult.raw_file}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectNewsApiReal().catch((e) => { console.error('[NewsAPI-replacement] FATAL:', e); process.exit(1); });
}
