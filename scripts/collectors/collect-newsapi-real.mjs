#!/usr/bin/env node
// collect-newsapi-real.mjs — заменён на RSS + GDELT + HN (без ключей).
// Правило 12.2: NewsAPI требует ключ → заменён.
// Собирает из:
//   - data/basket/rss.json (если есть)
//   - data/basket/gdelt.json (свежий GDELT)
//   - data/basket/hackernews-top.json (технические новости)

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

async function main() {
  await log('Запуск collect-newsapi-real (замена на RSS + GDELT + HN)');
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

  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'newsapi-real.json'), JSON.stringify(result, null, 2));
  await log(`Сохранено. Статей: ${articles.length}`);
  console.log(`[NewsAPI-replacement] ${articles.length} статей из GDELT + HN`);
}
main().catch(async (e) => { await log(`FATAL: ${e.message}`); console.error(e.message); process.exit(1); });
