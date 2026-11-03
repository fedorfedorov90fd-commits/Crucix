#!/usr/bin/env node
// Crucix Collector: RSSHub v1.1.0 (fixed)
// Собирает RSS из открытых источников через прямой fetch.
//
// Пишет: data/basket/rsshub.json — { collectedAt, mode, total, sources, success, items }
//
// Формат items: { id, title, link, pubDate, description, source, sourceUrl, category }
//
// Источники: 11+ (ТАСС, РИА, Lenta, Интерфакс, France24, Guardian, NYT, Al Jazeera, Sputnik, Коммерсант, Ведомости)
//
// Запуск: node scripts/collectors/collect-rsshub.mjs

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_FILE = join(BASKET, 'rsshub.json');

// ─── Источники (11 штук, как в rss-latest.json) ───
const SOURCES = [
  { name: 'ТАСС', url: 'https://tass.ru/rss/v2.xml', category: 'russian' },
  { name: 'РИА Новости', url: 'https://ria.ru/export/rss2/archive/index.xml', category: 'russian' },
  { name: 'Lenta.ru', url: 'https://lenta.ru/rss', category: 'russian' },
  { name: 'Интерфакс', url: 'https://www.interfax.ru/rss.asp', category: 'russian' },
  { name: 'Коммерсантъ', url: 'https://www.kommersant.ru/rss/main.xml', category: 'russian' },
  { name: 'Ведомости', url: 'https://www.vedomosti.ru/rss/news', category: 'russian' },
  { name: 'Sputnik', url: 'https://sputniknews.ru/export/rss2/archive/index.xml', category: 'russian' },
  { name: 'The Guardian', url: 'https://www.theguardian.com/world/rss', category: 'western' },
  { name: 'NYT World', url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'western' },
  { name: 'France 24', url: 'https://www.france24.com/en/rss', category: 'western' },
  { name: 'Al Jazeera', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'western' },
];

// ─── Парсер RSS (простой regex, без xml2js) ───
function parseRSS(xml) {
  const items = [];
  // <item>...</item> или <entry>...</entry>
  const itemRegex = /<(item|entry)[\s>]([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const body = m[2];
    const title = extractTag(body, 'title');
    const link = extractTag(body, 'link') || extractAttr(body, 'link', 'href');
    const pubDate = extractTag(body, 'pubDate') || extractTag(body, 'published') || extractTag(body, 'updated') || extractTag(body, 'dc:date');
    const description = extractTag(body, 'description') || extractTag(body, 'summary') || extractTag(body, 'content');
    
    if (title) {
      items.push({ title, link, pubDate, description });
    }
  }
  return items;
}

function extractTag(text, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = text.match(regex);
  if (!m) return '';
  return stripCdata(m[1]).trim();
}

function extractAttr(text, tagName, attrName) {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}=["']([^"']+)["']`, 'i');
  const m = text.match(regex);
  return m ? m[1].trim() : '';
}

function stripCdata(s) {
  if (!s) return '';
  return String(s).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function stripHtml(s) {
  if (!s) return '';
  return s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').trim().slice(0, 500);
}

// ─── Fetch с таймаутом ───
async function fetchRSS(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'application/rss+xml,application/xml,text/xml,*/*',
      },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return { ok: true, xml };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e.message };
  }
}

// ─── Основной цикл ───
async function main() {
  console.log('[rsshub] начало сбора');
  await mkdir(BASKET, { recursive: true });

  const allItems = [];
  let successCount = 0;
  let failCount = 0;
  const sourceResults = [];

  for (const src of SOURCES) {
    console.log(`[rsshub] fetch ${src.name}...`);
    const result = await fetchRSS(src.url);
    if (!result.ok) {
      console.log(`  ❌ ${src.name}: ${result.error}`);
      failCount++;
      sourceResults.push({ name: src.name, ok: false, error: result.error, count: 0 });
      continue;
    }

    const items = parseRSS(result.xml);
    console.log(`  ✅ ${src.name}: ${items.length} items`);

    for (const it of items) {
      allItems.push({
        id: `rss-${allItems.length}-${Date.now()}`,
        title: it.title,
        link: it.link,
        pubDate: it.pubDate,
        description: stripHtml(it.description),
        source: src.name,
        sourceUrl: src.url,
        category: src.category,
        collectedAt: new Date().toISOString(),
      });
    }

    successCount++;
    sourceResults.push({ name: src.name, ok: true, count: items.length });
  }

  // Сортируем по pubDate (новые сверху)
  allItems.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  const payload = {
    collectedAt: new Date().toISOString(),
    mode: 'direct',
    total: allItems.length,
    sources: SOURCES.length,
    success: successCount,
    failed: failCount,
    sourceResults,
    items: allItems,
  };

  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`[rsshub] готово: ${allItems.length} items, ${successCount}/${SOURCES.length} источников OK`);
  console.log(`[rsshub] записано в ${OUT_FILE}`);
}

main().catch(e => {
  console.error('[rsshub] FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
