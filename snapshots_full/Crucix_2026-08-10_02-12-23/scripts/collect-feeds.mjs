#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data', 'raw');
const FEEDS_FILE = join(ROOT, 'data', 'feeds', 'feeds.opml');

// Убедимся, что папка существует
await fs.mkdir(DATA_DIR, { recursive: true });

// Парсинг OPML
function parseOpml(xml) {
  const feeds = [];
  const regex = /<outline[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    feeds.push({ name: match[1], url: match[2] });
  }
  return feeds;
}

// Парсинг RSS-ленты
async function fetchFeed(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'Crucix-Collector/1.0' },
      signal: AbortSignal.timeout(10000) 
    });
    if (!res.ok) return [];
    const text = await res.text();
    
    // Простой парсинг RSS (без библиотек)
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

// Основная функция
async function collectAllFeeds() {
  console.log('[Collector] Чтение списка RSS-лент...');
  const xml = await fs.readFile(FEEDS_FILE, 'utf-8');
  const feeds = parseOpml(xml);
  console.log(`[Collector] Найдено ${feeds.length} лент`);

  const allItems = [];
  let processed = 0;

  for (const feed of feeds) {
    processed++;
    if (processed % 10 === 0) {
      console.log(`[Collector] Обработано ${processed}/${feeds.length}`);
    }
    const items = await fetchFeed(feed.url);
    for (const item of items) {
      allItems.push({
        ...item,
        source: feed.name,
        collectedAt: new Date().toISOString(),
        category: 'news'
      });
    }
    // Задержка, чтобы не перегружать серверы
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Сохраняем в файл с ротацией по дням
  const today = new Date().toISOString().slice(0, 10);
  const outputFile = join(DATA_DIR, `feeds_${today}.json`);
  
  // Читаем существующий файл, если есть (для избежания дубликатов)
  let existing = [];
  try {
    const old = await fs.readFile(outputFile, 'utf-8');
    existing = JSON.parse(old);
  } catch (e) {
    // Файла нет — нормально
  }

  // Объединяем и удаляем дубликаты по id
  const combined = [...existing, ...allItems];
  const unique = new Map();
  for (const item of combined) {
    if (!unique.has(item.id)) {
      unique.set(item.id, item);
    }
  }

  const final = Array.from(unique.values());
  await fs.writeFile(outputFile, JSON.stringify(final, null, 2));
  console.log(`[Collector] Сохранено ${final.length} записей в ${outputFile}`);
}

// Запуск
collectAllFeeds().catch(console.error);
