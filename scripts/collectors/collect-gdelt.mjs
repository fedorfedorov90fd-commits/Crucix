#!/usr/bin/env node
// ============================================================
// collect-gdelt.mjs — Реальный сбор данных из GDELT API
// ============================================================
// API: https://api.gdeltproject.org/api/v2/doc/doc
// Формат: JSON (mode=artlist)
// Сохраняет: data/basket/gdelt.json
// Логи: logs/collectors/collect-gdelt.log
//
// ИСПРАВЛЕНО 12.09.2026:
// - GDELT возвращает 429 для curl User-Agent → browser UA.
// - GDELT не принимает query=* → используем ключевые слова.
// - GDELT отвечает за 10-12с → timeout 30с.
// - Обязателен mode=artlist.
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const FILE_PATH = join(BASKET_DIR, 'gdelt.json');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE = join(LOGS_DIR, 'collect-gdelt.log');

const BROWSER_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const GDELT_TIMEOUT_MS = 30000;
const GDELT_PAUSE_MS = 5500;  // GDELT требует ≥5 сек между запросами

// Ключевые запросы — по одному на каждую тему, склеиваем статьи.
const QUERIES = [
  'ukraine',
  'russia',
  'china taiwan',
  'israel gaza',
  'iran nuclear',
  'north korea',
  'sanctions',
  'oil energy',
];

async function logMessage(msg) {
  const ts = new Date().toISOString();
  await fs.mkdir(LOGS_DIR, { recursive: true });
  await fs.appendFile(LOG_FILE, `[${ts}] ${msg}\n`);
}

async function fetchQuery(q) {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=50&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GDELT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.status === 429) {
      // Rate limit — ждём 6 секунд и повторяем
      await new Promise(r => setTimeout(r, 6000));
      const res2 = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(GDELT_TIMEOUT_MS),
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
    await logMessage(`Запрос "${q}" — ошибка: ${e.message}`);
    return [];
  }
}

async function fetchGDELT() {
  const start = Date.now();
  await logMessage('Запуск сборщика GDELT (browser UA, 8 запросов)');

  const allArticles = [];
  const seenIds = new Set();
  for (const q of QUERIES) {
    const articles = await fetchQuery(q);
    for (const a of articles) {
      const key = a.url || a.id || (a.title + a.seendate);
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      allArticles.push(a);
    }
    await logMessage(`"${q}": ${articles.length} статей (итого ${allArticles.length})`);
    // Пауза между запросами — не бомбим GDELT
    await new Promise(r => setTimeout(r, GDELT_PAUSE_MS));
  }

  const result = {
    source: 'GDELT',
    lastUpdated: new Date().toISOString(),
    queries: QUERIES,
    articles: allArticles,
    count: allArticles.length,
  };

  await fs.mkdir(BASKET_DIR, { recursive: true });
  await fs.writeFile(FILE_PATH, JSON.stringify(result, null, 2));

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  await logMessage(`Сохранено ${allArticles.length} статей за ${elapsed}с`);
  console.log(`[GDELT] ✅ ${allArticles.length} статей за ${elapsed}с`);
}

fetchGDELT().catch(e => {
  console.error('[GDELT] FATAL:', e.message);
  process.exit(1);
});
