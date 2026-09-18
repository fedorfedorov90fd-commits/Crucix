#!/usr/bin/env node

/**
 * Универсальный сборщик RSS для Crucix
 * Поддерживает три режима:
 *   1. Прямой парсинг (direct) — для 1-50 источников
 *   2. RSSHub локальный (rsshub-local) — для 50-200 источников
 *   3. RSSHub публичный (rsshub-public) — для 200+ источников, не требует установки
 *
 * Автоматический выбор режима:
 *   - до 50 источников → direct
 *   - 50-200 → public rsshub
 *   - 200+ → локальный rsshub (если установлен)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// ============================================================
// КОНФИГУРАЦИЯ
// ============================================================

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Пути
const OPML_PATH = join(ROOT, 'data', 'feeds', 'feeds.opml');
const BASKET_PATH = join(ROOT, 'data', 'basket', 'rss-latest.json');
const LOGS_DIR = join(ROOT, 'logs', 'collectors');
const LOG_FILE = join(LOGS_DIR, 'collect-rss-universal.log');

// Настройки режимов
const CONFIG = {
    // Пороги для автоматического выбора режима
    DIRECT_LIMIT: 50,       // до 50 источников — прямой парсинг
    PUBLIC_LIMIT: 200,      // до 200 — публичный RSSHub
    // RSSHub адреса
    RSSHUB_LOCAL: 'http://localhost:1200',
    RSSHUB_PUBLIC: 'https://rsshub.app',
    // Таймауты
    TIMEOUT: 30000,
    // Задержка между запросами (мс)
    DELAY: 500,
    // Максимум новостей на источник
    MAX_PER_SOURCE: 20,
    // Максимум всего новостей в корзине
    MAX_TOTAL: 500,
    // Интервал обновления (минуты), 0 = однократно
    INTERVAL_MINUTES: 60
};

// ============================================================
// ЛОГИРОВАНИЕ
// ============================================================

async function log(msg, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'warn' ? '⚠️' : '✅';
    const line = `[${timestamp}] ${prefix} ${msg}`;
    console.log(line);
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        await fs.appendFile(LOG_FILE, line + '\n');
    } catch (e) {}
}

// ============================================================
// ПАРСИНГ OPML
// ============================================================

function parseOpml(xml) {
    const feeds = [];
    const regex = /<outline[^>]*type="rss"[^>]*text="([^"]*)"[^>]*xmlUrl="([^"]*)"/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
        feeds.push({ name: match[1], url: match[2] });
    }
    return feeds;
}

// ============================================================
// ПАРСИНГ RSS/XML
// ============================================================

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

// ============================================================
// РЕЖИМ 1: ПРЯМОЙ ПАРСИНГ
// ============================================================

async function fetchDirect(url) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            },
            signal: AbortSignal.timeout(CONFIG.TIMEOUT)
        });
        if (!res.ok) return [];
        const text = await res.text();
        return parseRSS(text);
    } catch (e) {
        return [];
    }
}

// ============================================================
// РЕЖИМ 2: RSSHub (локальный или публичный)
// ============================================================

async function fetchViaRSSHub(url, rsshubUrl) {
    try {
        // Используем /rss/ роутер для проксирования любых RSS-лент
        const fullUrl = `${rsshubUrl}/rss/${encodeURIComponent(url)}`;
        const res = await fetch(fullUrl, {
            headers: {
                'User-Agent': 'Crucix-RSS-Collector/1.0',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            },
            signal: AbortSignal.timeout(CONFIG.TIMEOUT)
        });
        if (!res.ok) return [];
        const text = await res.text();
        // Если RSSHub вернул HTML — значит, роут не работает
        if (text.includes('<html')) return [];
        return parseRSS(text);
    } catch (e) {
        return [];
    }
}

// ============================================================
// ПРОВЕРКА ДОСТУПНОСТИ RSSHub
// ============================================================

async function checkRSSHub(url) {
    try {
        const res = await fetch(url, {
            signal: AbortSignal.timeout(5000),
            headers: { 'User-Agent': 'Crucix-RSS-Collector/1.0' }
        });
        return res.ok;
    } catch {
        return false;
    }
}

// ============================================================
// ОПРЕДЕЛЕНИЕ РЕЖИМА
// ============================================================

async function detectBestMode(feedCount) {
    // Если источников мало — прямой парсинг
    if (feedCount <= CONFIG.DIRECT_LIMIT) {
        await log(`📋 Выбран режим: ПРЯМОЙ ПАРСИНГ (${feedCount} источников ≤ ${CONFIG.DIRECT_LIMIT})`);
        return { mode: 'direct', url: null };
    }

    // Если источников среднее количество — проверяем публичный RSSHub
    if (feedCount <= CONFIG.PUBLIC_LIMIT) {
        const available = await checkRSSHub(CONFIG.RSSHUB_PUBLIC);
        if (available) {
            await log(`📋 Выбран режим: ПУБЛИЧНЫЙ RSSHub (${feedCount} источников, rsshub.app доступен)`);
            return { mode: 'public', url: CONFIG.RSSHUB_PUBLIC };
        }
        await log(`⚠️ Публичный RSSHub недоступен, пробуем локальный...`);
    }

    // Проверяем локальный RSSHub
    const localAvailable = await checkRSSHub(CONFIG.RSSHUB_LOCAL);
    if (localAvailable) {
        await log(`📋 Выбран режим: ЛОКАЛЬНЫЙ RSSHub (порт 1200)`);
        return { mode: 'local', url: CONFIG.RSSHUB_LOCAL };
    }

    // Если ничего не работает — падаем на прямой парсинг
    await log(`⚠️ RSSHub недоступен, использую ПРЯМОЙ ПАРСИНГ (может быть медленно при ${feedCount} источниках)`);
    return { mode: 'direct', url: null };
}

// ============================================================
// СБОР НОВОСТЕЙ
// ============================================================

async function collectFeeds() {
    await log('🚀 ЗАПУСК УНИВЕРСАЛЬНОГО СБОРЩИКА RSS');

    // 1. Читаем OPML
    let xml;
    try {
        xml = await fs.readFile(OPML_PATH, 'utf-8');
    } catch {
        await log(`❌ Файл OPML не найден: ${OPML_PATH}`, 'error');
        return;
    }

    const feeds = parseOpml(xml);
    await log(`📋 Найдено ${feeds.length} источников`);

    // 2. Определяем режим
    const { mode, url: rsshubUrl } = await detectBestMode(feeds.length);
    await log(`🔧 Режим: ${mode.toUpperCase()}`);

    // 3. Собираем новости
    const allItems = [];
    let successCount = 0;
    let failCount = 0;

    for (const [index, feed] of feeds.entries()) {
        if ((index + 1) % 10 === 0) {
            await log(`📡 Прогресс: ${index + 1}/${feeds.length}`);
        }

        let items = [];

        if (mode === 'direct') {
            items = await fetchDirect(feed.url);
        } else {
            items = await fetchViaRSSHub(feed.url, rsshubUrl);
            // Если RSSHub не дал результатов — пробуем прямой парсинг
            if (items.length === 0) {
                items = await fetchDirect(feed.url);
            }
        }

        if (items.length > 0) {
            successCount++;
            for (const item of items) {
                allItems.push({
                    ...item,
                    source: feed.name,
                    sourceUrl: feed.url,
                    collectedAt: new Date().toISOString(),
                    category: 'news',
                    mode: mode
                });
            }
        } else {
            failCount++;
        }

        // Задержка между запросами
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY));
    }

    await log(`📊 Итог: ${successCount} успешно, ${failCount} неудачно из ${feeds.length}`);
    await log(`📰 Всего записей: ${allItems.length}`);

    // 4. Сортировка и дедупликация
    allItems.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    const unique = new Map();
    for (const item of allItems) {
        if (!unique.has(item.id)) {
            unique.set(item.id, item);
        }
    }
    const final = Array.from(unique.values());

    // 5. Сохраняем в корзину
    const output = {
        collectedAt: new Date().toISOString(),
        mode: mode,
        modeDescription: mode === 'direct' ? 'Прямой парсинг RSS' :
                         mode === 'public' ? 'Публичный RSSHub (rsshub.app)' :
                         'Локальный RSSHub',
        totalSources: feeds.length,
        successCount: successCount,
        failCount: failCount,
        totalItems: final.length,
        items: final.slice(0, CONFIG.MAX_TOTAL)
    };

    await fs.mkdir(dirname(BASKET_PATH), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(output, null, 2));
    await log(`✅ Сохранено ${final.slice(0, CONFIG.MAX_TOTAL).length} новостей в корзину`);
    await log(`📁 Файл: ${BASKET_PATH}`);

    // 6. Также сохраняем в raw (для истории)
    const today = new Date().toISOString().slice(0, 10);
    const rawPath = join(ROOT, 'data', 'raw', `feeds_${today}.json`);
    await fs.mkdir(dirname(rawPath), { recursive: true });
    await fs.writeFile(rawPath, JSON.stringify(final, null, 2));
    await log(`📁 Архив: ${rawPath}`);

    // 7. Отчёт о режиме
    await log(`📋 Режим сбора: ${mode.toUpperCase()}`);
    if (mode === 'direct') {
        await log(`   💡 Для ускорения при 50+ источниках установите RSSHub`);
        await log(`   🔗 https://github.com/DIYgod/RSSHub`);
    } else if (mode === 'public') {
        await log(`   💡 Используется публичный RSSHub (rsshub.app)`);
        await log(`   ⚠️ Может быть ограничение по частоте запросов`);
    } else {
        await log(`   💡 Используется локальный RSSHub на порту 1200`);
    }
}

// ============================================================
// ЗАПУСК С ПОДДЕРЖКОЙ ИНТЕРВАЛОВ
// ============================================================

async function run() {
    await collectFeeds();

    if (CONFIG.INTERVAL_MINUTES > 0) {
        await log(`⏳ Следующий сбор через ${CONFIG.INTERVAL_MINUTES} минут`);
        setInterval(async () => {
            await collectFeeds();
            await log(`⏳ Следующий сбор через ${CONFIG.INTERVAL_MINUTES} минут`);
        }, CONFIG.INTERVAL_MINUTES * 60 * 1000);
    }
}

// ============================================================
// ОБРАБОТКА ОСТАНОВКИ
// ============================================================

process.on('SIGINT', async () => {
    await log('🛑 Сборщик остановлен пользователем');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await log('🛑 Сборщик остановлен (SIGTERM)');
    process.exit(0);
});

// ============================================================
// ЗАПУСК
// ============================================================

run().catch(async (e) => {
    await log(`❌ Критическая ошибка: ${e.message}`, 'error');
    console.error(e);
});
