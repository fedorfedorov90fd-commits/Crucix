#!/usr/bin/env node

/**
 * Сборщик RSS через RSSHub
 * Поддерживает:
 * - Прямой парсинг RSS (fallback)
 * - RSSHub прокси
 * - Сохранение в корзину
 * - Интервалы обновления (настраиваемые)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// === КОНФИГУРАЦИЯ ===
const CONFIG = {
    // Режим: 'direct' — прямой парсинг RSS, 'rsshub' — через RSSHub
    mode: process.env.RSS_MODE || 'direct',

    // Адрес RSSHub (если режим rsshub)
    rsshubUrl: process.env.RSSHUB_URL || 'http://localhost:1200',

    // Интервал обновления в минутах (по умолчанию 60)
    intervalMinutes: parseInt(process.env.RSS_INTERVAL) || 60,

    // Пути
    opmlPath: join(ROOT, 'data', 'feeds', 'feeds.opml'),
    basketPath: join(ROOT, 'data', 'basket', 'rss-latest.json'),
    logPath: join(ROOT, 'logs', 'collectors', 'collect-rsshub.log')
};

// === ЛОГИРОВАНИЕ ===
async function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    await fs.mkdir(dirname(CONFIG.logPath), { recursive: true });
    await fs.appendFile(CONFIG.logPath, line + '\n').catch(() => {});
}

// === ПАРСИНГ OPML ===
function parseOpml(xml) {
    const feeds = [];
    const regex = /<outline[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        feeds.push({ name: match[1], url: match[2] });
    }
    return feeds;
}

// === ПРЯМОЙ ПАРСИНГ RSS ===
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
        await log(`⚠️ Ошибка загрузки ${url}: ${e.message}`);
        return [];
    }
}

// === ПАРСИНГ RSS ЧЕРЕЗ RSSHub ===
async function fetchFeedViaRSSHub(sourceName, sourceUrl) {
    try {
        // RSSHub принимает запросы вида: /feed/:source
        // Но можно передать и прямой URL через параметр
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
        // Если RSSHub не отвечает — пробуем прямой парсинг
        await log(`⚠️ RSSHub недоступен для ${sourceName}, пробую прямой парсинг...`);
        return fetchFeedDirect(sourceUrl);
    }
}

// === ПАРСИНГ RSS/XML ===
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
        items.push({
            id,
            title: title.trim(),
            link,
            pubDate,
            description: description.trim()
        });
    }
    return items;
}

// === ОСНОВНАЯ ФУНКЦИЯ СБОРА ===
async function collectAllFeeds() {
    await log('🚀 Запуск сборщика RSS...');
    await log(`📋 Режим: ${CONFIG.mode}`);
    await log(`⏱️ Интервал: ${CONFIG.intervalMinutes} минут`);

    // Читаем OPML
    let xml;
    try {
        xml = await fs.readFile(CONFIG.opmlPath, 'utf-8');
    } catch {
        await log(`❌ Файл OPML не найден: ${CONFIG.opmlPath}`);
        return;
    }

    const feeds = parseOpml(xml);
    await log(`📋 Найдено ${feeds.length} источников`);

    const allItems = [];
    let successCount = 0;

    for (const [index, feed] of feeds.entries()) {
        if ((index + 1) % 10 === 0) {
            await log(`📡 Обработано ${index + 1}/${feeds.length}`);
        }

        let items = [];
        if (CONFIG.mode === 'rsshub') {
            items = await fetchFeedViaRSSHub(feed.name, feed.url);
        } else {
            items = await fetchFeedDirect(feed.url);
        }

        if (items.length > 0) {
            successCount++;
            for (const item of items) {
                allItems.push({
                    ...item,
                    source: feed.name,
                    collectedAt: new Date().toISOString(),
                    category: 'news'
                });
            }
        }

        // Небольшая задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    await log(`✅ Успешно загружено ${successCount} из ${feeds.length} источников`);
    await log(`📊 Всего записей: ${allItems.length}`);

    // === СОХРАНЕНИЕ В КОРЗИНУ ===
    // Сортировка по дате (новые сверху)
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    // Удаление дубликатов по id
    const unique = new Map();
    for (const item of allItems) {
        if (!unique.has(item.id)) {
            unique.set(item.id, item);
        }
    }
    const final = Array.from(unique.values());

    // Сохраняем в корзину
    const output = {
        collectedAt: new Date().toISOString(),
        mode: CONFIG.mode,
        total: final.length,
        sources: feeds.length,
        success: successCount,
        items: final.slice(0, 500) // Ограничиваем 500 последними новостями
    };

    await fs.mkdir(dirname(CONFIG.basketPath), { recursive: true });
    await fs.writeFile(CONFIG.basketPath, JSON.stringify(output, null, 2));
    await log(`✅ Сохранено ${final.length} новостей в корзину`);

    // Также сохраняем сырой архив в raw (для истории)
    const today = new Date().toISOString().slice(0, 10);
    const rawPath = join(ROOT, 'data', 'raw', `feeds_${today}.json`);
    await fs.mkdir(dirname(rawPath), { recursive: true });
    await fs.writeFile(rawPath, JSON.stringify(final, null, 2));
    await log(`📁 Архив сохранен: ${rawPath}`);
}

// === ЗАПУСК С ПОДДЕРЖКОЙ ИНТЕРВАЛОВ ===
async function run() {
    await collectAllFeeds();

    // Если интервал > 0, запускаем периодический сбор
    if (CONFIG.intervalMinutes > 0) {
        await log(`⏳ Следующий сбор через ${CONFIG.intervalMinutes} минут`);
        setInterval(async () => {
            await collectAllFeeds();
            await log(`⏳ Следующий сбор через ${CONFIG.intervalMinutes} минут`);
        }, CONFIG.intervalMinutes * 60 * 1000);
    }
}

// === ОБРАБОТКА ОСТАНОВКИ ===
process.on('SIGINT', async () => {
    await log('🛑 Сборщик остановлен пользователем');
    process.exit(0);
});

run().catch(async (e) => {
    await log(`❌ Критическая ошибка: ${e.message}`);
    console.error(e);
});
