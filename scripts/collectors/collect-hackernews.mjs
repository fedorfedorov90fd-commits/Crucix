#!/usr/bin/env node
// collect-hackernews.mjs — HN top (без ключа)
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
async function main() {
  const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  const ids = (await idsRes.json()).slice(0, 30);
  const items = [];
  for (const id of ids) {
    try {
      const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      const d = await r.json();
      items.push({ id: d.id, title: d.title, url: d.url, score: d.score, by: d.by, time: d.time });
    } catch {}
  }
  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'hackernews-top.json'), JSON.stringify({ source: 'HackerNews', updated: new Date().toISOString(), count: items.length, items }, null, 2));
  console.log(`[HN] ${items.length} топ-новостей`);
}
main().catch(e => { console.error(e.message); process.exit(1); });
