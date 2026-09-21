#!/usr/bin/env node
/**
 * Crucix Collector: feeds (RSS через OPML) — реальный сборщик.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: RSS-агрегация → saveRaw. Сборщик НЕ пишет в basket.
 * Источник: data/feeds/feeds.opml (список RSS).
 * Формат: [{id, title, link, pubDate, description, source, collectedAt, category}]. Тип — events.
 */
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import { saveRaw } from './lib/collector-helper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const FEEDS_FILE = join(ROOT, 'data', 'feeds', 'feeds.opml');

function parseOpml(xml) {
  const feeds = [];
  const regex = /<outline[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    feeds.push({ name: match[1], url: match[2] });
  }
  return feeds;
}

async function fetchFeed(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return [];
    const text = await res.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(text)) !== null) {
      const content = itemMatch[1];
      const title = (content.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'Без заголовка';
      const link = (content.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
      const pubDate = (content.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
      const description = (content.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
      const id = createHash('md5').update(link).digest('hex');
      items.push({ id, title: title.trim(), link, pubDate, description: description.trim() });
    }
    return items;
  } catch (e) {
    console.error(`Ошибка при загрузке ${url}:`, e.message);
    return [];
  }
}

export async function collectFeeds() {
  console.log('[Collector] Чтение списка RSS-лент...');
  let xml;
  try {
    xml = await fs.readFile(FEEDS_FILE, 'utf-8');
  } catch (e) {
    console.error(`[Collector] FATAL: не могу прочитать ${FEEDS_FILE}: ${e.message}`);
    process.exit(1);
  }
  const feeds = parseOpml(xml);
  console.log(`[Collector] Найдено ${feeds.length} лент`);

  const allItems = [];
  let processed = 0;
  let successCount = 0;

  for (const feed of feeds) {
    processed++;
    if (processed % 10 === 0) {
      console.log(`[Collector] Обработано ${processed}/${feeds.length}`);
    }
    const items = await fetchFeed(feed.url);
    if (items.length > 0) {
      successCount++;
      for (const item of items) {
        allItems.push({
          ...item,
          source: feed.name,
          collectedAt: new Date().toISOString(),
          category: 'news',
        });
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[Collector] Успешно ${successCount} из ${feeds.length} источников, всего ${allItems.length} записей`);

  const result = await saveRaw('feeds', allItems, {
    collector: 'collect-feeds.mjs',
    source: 'RSS via OPML',
    source_url: 'file://data/feeds/feeds.opml',
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'event',
    period: null,
    record_count: allItems.length,
    notes: `${successCount}/${feeds.length} источников; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[Collector] OK → ${result.raw_file}`);
  return allItems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectFeeds().catch((e) => { console.error('[Collector] FATAL:', e); process.exit(1); });
}
