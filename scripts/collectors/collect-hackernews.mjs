#!/usr/bin/env node
/**
 * Crucix Collector: hackernews (топ-30 HN, реальный API).
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://hacker-news.firebaseio.com/v0/topstories.json
 * Формат: {source, updated, count, items:[{id,title,url,score,by,time}]}. Тип — events.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const TOP_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const ITEM_URL = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
const TOP_LIMIT = 30;
const TIMEOUT_MS = 15000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export async function collectHackerNews() {
  console.log('[HN] Загрузка top-30...');
  let basketData;
  try {
    const ids = (await fetchJson(TOP_URL)).slice(0, TOP_LIMIT);
    const items = [];
    for (const id of ids) {
      try {
        const d = await fetchJson(ITEM_URL(id));
        if (d) items.push({ id: d.id, title: d.title, url: d.url, score: d.score, by: d.by, time: d.time });
      } catch { /* skip */ }
    }
    basketData = { source: 'HackerNews', updated: new Date().toISOString(), count: items.length, items };
    console.log(`[HN] ${items.length} топ-новостей`);
  } catch (e) {
    console.error('[HN] ⚠️ Ошибка:', e.message);
    basketData = { source: 'HackerNews', updated: new Date().toISOString(), count: 0, items: [], error: e.message };
  }

  const result = await saveRaw('hackernews', basketData, {
    collector: 'collect-hackernews.mjs',
    source: 'Hacker News API',
    source_url: TOP_URL,
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.items.length,
    notes: 'Реальные топ-30 HackerNews; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[HN] OK → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectHackerNews().catch((e) => { console.error('[HN] FATAL:', e); process.exit(1); });
}
