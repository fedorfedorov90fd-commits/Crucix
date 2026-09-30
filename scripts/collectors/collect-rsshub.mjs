#!/usr/bin/env node
/**
 * Crucix Collector: rsshub (RSS через прямой парсинг или RSSHub).
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: читает OPML (data/feeds/feeds.opml), парсит RSS-ленты,
 * дедуплицирует по id, сдаёт через saveRaw.
 * Сборщик НЕ пишет в basket напрямую — только raw + накладная.
 *
 * Формат: {collectedAt, mode, total, sources, success, items: [{id, title, link, pubDate, source, category}]}.
 * Тип — events (items с pubDate).
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import { saveRaw } from './lib/collector-helper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const CONFIG = {
  mode: process.env.RSS_MODE || 'direct',
  rsshubUrl: process.env.RSSHUB_URL || 'http://localhost:1200',
  opmlPath: join(ROOT, 'data', 'feeds', 'feeds.opml')
};

function parseOpml(xml) {
  const feeds = [];
  const regex = /<outline[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    feeds.push({ name: match[1], url: match[2] });
  }
  return feeds;
}

async function fetchFeedDirect(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseRSS(text);
  } catch (e) {
    console.warn(`[RSS] Ошибка ${url}: ${e.message}`);
    return [];
  }
}

async function fetchFeedViaRSSHub(sourceName, sourceUrl) {
  try {
    const encodedUrl = encodeURIComponent(sourceUrl);
    const rsshubUrl = `${CONFIG.rsshubUrl}/feed/${encodedUrl}`;
    const res = await fetch(rsshubUrl, {
      headers: { 'User-Agent': 'Crucix-RSS-Collector/1.0' },
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) return [];
    const text = await res.text();
    return parseRSS(text);
  } catch (e) {
    console.warn(`[RSS] RSSHub недоступен для ${sourceName}, fallback на прямой парсинг`);
    return fetchFeedDirect(sourceUrl);
  }
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch;
  while ((itemMatch = itemRegex.exec(xml)) !== null) {
    const content = itemMatch[1];
    const title = (content.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'Без заголовка';
    const link = (content.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (content.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const description = (content.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
    const id = createHash('md5').update(link || title).digest('hex');
    items.push({ id, title: title.trim(), link, pubDate, description: description.trim() });
  }
  return items;
}

export async function collectAllFeeds() {
  let xml;
  try {
    xml = await readFile(CONFIG.opmlPath, 'utf-8');
  } catch {
    throw new Error(`Файл OPML не найден: ${CONFIG.opmlPath}`);
  }

  const feeds = parseOpml(xml);
  console.log(`[RSS] Найдено ${feeds.length} источников, режим: ${CONFIG.mode}`);

  const allItems = [];
  let successCount = 0;

  for (const [index, feed] of feeds.entries()) {
    if ((index + 1) % 10 === 0) console.log(`[RSS] Обработано ${index + 1}/${feeds.length}`);
    const items = CONFIG.mode === 'rsshub'
      ? await fetchFeedViaRSSHub(feed.name, feed.url)
      : await fetchFeedDirect(feed.url);
    if (items.length > 0) {
      successCount++;
      for (const item of items) {
        allItems.push({ ...item, source: feed.name, collectedAt: new Date().toISOString(), category: 'news' });
      }
    }
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  const unique = new Map();
  for (const item of allItems) if (!unique.has(item.id)) unique.set(item.id, item);
  const final = Array.from(unique.values()).slice(0, 500);

  const output = {
    collectedAt: new Date().toISOString(),
    mode: CONFIG.mode,
    total: final.length,
    sources: feeds.length,
    success: successCount,
    items: final
  };

  const result = await saveRaw('rsshub', output, {
    collector: 'collect-rsshub.mjs',
    source: 'RSS via OPML / RSSHub',
    source_url: 'local://feeds.opml',
    license: 'unknown',
    format_hint: 'events',
    value_unit: 'count',
    granularity: 'event',
    record_count: final.length,
    notes: `${feeds.length} источников, успешных ${successCount}`,
    backwardCompat: true
  });

  console.log(`[RSS] OK ${final.length} новостей (${successCount}/${feeds.length} источников) → ${result.raw_file}`);
  console.log(`[RSS] Накладная: ${result.incoming_file}`);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectAllFeeds().catch((e) => { console.error('[RSS] FATAL:', e.message); process.exit(1); });
}
