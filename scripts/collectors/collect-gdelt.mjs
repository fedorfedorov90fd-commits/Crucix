#!/usr/bin/env node
/**
 * Crucix Collector: GDELT news events.
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: собирает статьи из GDELT Doc API (8 тематических запросов),
 * дедуплицирует по URL, сдаёт на склад через collector-helper.
 * Сборщик НЕ пишет в basket — только raw + накладная.
 *
 * API: https://api.gdeltproject.org/api/v2/doc/doc (mode=artlist)
 * Особенности: rate limit 429 → браузерный UA, пауза ≥5 сек между запросами,
 * timeout 30 сек (GDELT отвечает 10-12 сек).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const GDELT_TIMEOUT_MS = 30000;
const GDELT_PAUSE_MS = 5500;

const QUERIES = [
  'ukraine', 'russia', 'china taiwan', 'israel gaza',
  'iran nuclear', 'north korea', 'sanctions', 'oil energy'
];

async function fetchQuery(q) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=50&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GDELT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 6000));
      const res2 = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(GDELT_TIMEOUT_MS)
      });
      if (!res2.ok) throw new Error(`HTTP ${res2.status} (retry)`);
      const text2 = await res2.text();
      if (!text2.trim().startsWith('{') && !text2.trim().startsWith('[')) {
        throw new Error(`GDELT не JSON (retry): ${text2.slice(0, 80)}`);
      }
      const data2 = JSON.parse(text2);
      return data2.articles || [];
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim().startsWith('{') && !text.trim().startsWith('[')) {
      throw new Error(`GDELT не JSON: ${text.slice(0, 80)}`);
    }
    const data = JSON.parse(text);
    return data.articles || [];
  } catch (e) {
    clearTimeout(timer);
    console.warn(`[GDELT] Запрос "${q}" — ошибка: ${e.message}`);
    return [];
  }
}

export async function collectGDELT() {
  const start = Date.now();
  console.log('[GDELT] Запуск (browser UA, 8 запросов)');

  const allArticles = [];
  const seenIds = new Set();
  for (const q of QUERIES) {
    const articles = await fetchQuery(q);
    for (const a of articles) {
      const key = a.url || a.id || (a.title + (a.seendate || ''));
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      allArticles.push(a);
    }
    console.log(`[GDELT] "${q}": ${articles.length} статей (итого ${allArticles.length})`);
    await new Promise(r => setTimeout(r, GDELT_PAUSE_MS));
  }

  const result = {
    source: 'GDELT',
    lastUpdated: new Date().toISOString(),
    queries: QUERIES,
    articles: allArticles,
    count: allArticles.length
  };

  const saveResult = await saveRaw('gdelt', result, {
    collector: 'collect-gdelt.mjs',
    source: 'GDELT Doc API',
    source_url: 'https://api.gdeltproject.org/api/v2/doc/doc?mode=artlist',
    license: 'cc-by',
    format_hint: 'events',
    value_unit: 'count',
    granularity: 'event',
    record_count: allArticles.length,
    notes: `${QUERIES.length} тематических запросов, дедупликация по URL`,
    backwardCompat: true
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[GDELT] OK ${allArticles.length} статей за ${elapsed}с → ${saveResult.raw_file}`);
  console.log(`[GDELT] Накладная: ${saveResult.incoming_file}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectGDELT().catch((e) => { console.error('[GDELT] FATAL:', e); process.exit(1); });
}
