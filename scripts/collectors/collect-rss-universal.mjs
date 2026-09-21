#!/usr/bin/env node
/**
 * Crucix Collector: rss-universal (универсальный RSS).
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * Три режима: direct | rsshub-public | rsshub-local (автовыбор по числу источников).
 * УБРАН setInterval — сборщик запускается ОДИН РАЗ (для cron).
 * Читает OPML из data/feeds/feeds.opml, пишет через saveRaw.
 * Формат: {collectedAt, mode, modeDescription, totalSources, successCount, failCount, totalItems, items}. Тип — events.
 */
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createHash } from 'crypto';
import { saveRaw } from './lib/collector-helper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const OPML_PATH = join(ROOT, 'data', 'feeds', 'feeds.opml');

const CONFIG = {
  DIRECT_LIMIT: 50,
  PUBLIC_LIMIT: 200,
  RSSHUB_LOCAL: 'http://localhost:1200',
  RSSHUB_PUBLIC: 'https://rsshub.app',
  TIMEOUT: 30000,
  DELAY: 500,
  MAX_TOTAL: 500,
};

function parseOpml(xml) {
  const feeds = [];
  const regex = /<outline[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) feeds.push({ name: match[1], url: match[2] });
  return feeds;
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const content = m[1];
    const title = (content.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'Без заголовка';
    const link = (content.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (content.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const description = (content.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';
    const id = createHash('md5').update(link || title).digest('hex');
    items.push({ id, title: title.trim(), link, pubDate, description: description.trim() });
  }
  return items;
}

async function fetchDirect(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      signal: AbortSignal.timeout(CONFIG.TIMEOUT),
    });
    if (!res.ok) return [];
    return parseRSS(await res.text());
  } catch (e) { return []; }
}

async function fetchViaRSSHub(url, rsshubUrl) {
  try {
    // Правильный роут: /rss/<encoded_url>
    const fullUrl = `${rsshubUrl}/rss/${encodeURIComponent(url)}`;
    const res = await fetch(fullUrl, {
      headers: { 'User-Agent': 'Crucix-RSS-Collector/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(CONFIG.TIMEOUT),
    });
    if (!res.ok) return [];
    const text = await res.text();
    if (text.includes('<html')) return [];
    return parseRSS(text);
  } catch (e) { return []; }
}

async function checkRSSHub(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'Crucix-RSS-Collector/1.0' } });
    return res.ok;
  } catch { return false; }
}

async function detectBestMode(feedCount) {
  if (feedCount <= CONFIG.DIRECT_LIMIT) return { mode: 'direct', url: null };
  if (feedCount <= CONFIG.PUBLIC_LIMIT) {
    if (await checkRSSHub(CONFIG.RSSHUB_PUBLIC)) return { mode: 'public', url: CONFIG.RSSHUB_PUBLIC };
  }
  if (await checkRSSHub(CONFIG.RSSHUB_LOCAL)) return { mode: 'local', url: CONFIG.RSSHUB_LOCAL };
  return { mode: 'direct', url: null };
}

export async function collectRSSUniversal() {
  console.log('[RSS Universal] Запуск...');
  let xml;
  try { xml = await fs.readFile(OPML_PATH, 'utf-8'); }
  catch (e) { console.error(`OPML не найден: ${e.message}`); process.exit(1); }

  const feeds = parseOpml(xml);
  console.log(`[RSS Universal] Источников: ${feeds.length}`);

  const { mode, url: rsshubUrl } = await detectBestMode(feeds.length);
  console.log(`[RSS Universal] Режим: ${mode.toUpperCase()}`);

  const allItems = [];
  let successCount = 0, failCount = 0;

  for (const [i, feed] of feeds.entries()) {
    if ((i + 1) % 10 === 0) console.log(`  Прогресс: ${i + 1}/${feeds.length}`);
    let items = mode === 'direct' ? await fetchDirect(feed.url) : await fetchViaRSSHub(feed.url, rsshubUrl);
    if (items.length === 0 && mode !== 'direct') items = await fetchDirect(feed.url);
    if (items.length > 0) {
      successCount++;
      for (const item of items) allItems.push({ ...item, source: feed.name, sourceUrl: feed.url, collectedAt: new Date().toISOString(), category: 'news', mode });
    } else failCount++;
    await new Promise(r => setTimeout(r, CONFIG.DELAY));
  }

  allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  const unique = new Map();
  for (const item of allItems) if (!unique.has(item.id)) unique.set(item.id, item);
  const final = Array.from(unique.values()).slice(0, CONFIG.MAX_TOTAL);

  const output = {
    collectedAt: new Date().toISOString(),
    mode,
    modeDescription: mode === 'direct' ? 'Прямой парсинг RSS' : mode === 'public' ? 'Публичный RSSHub' : 'Локальный RSSHub',
    totalSources: feeds.length, successCount, failCount, totalItems: final.length, items: final,
  };

  const result = await saveRaw('rss-universal', output, {
    collector: 'collect-rss-universal.mjs',
    source: `RSS Universal (${mode})`,
    source_url: 'file://data/feeds/feeds.opml',
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: final.length,
    notes: `Универсальный RSS: режим=${mode}, источников=${feeds.length}, успешно=${successCount}, провалов=${failCount}; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[RSS Universal] OK ${final.length} → ${result.raw_file}`);
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectRSSUniversal().catch((e) => { console.error('[RSS Universal] FATAL:', e); process.exit(1); });
}
