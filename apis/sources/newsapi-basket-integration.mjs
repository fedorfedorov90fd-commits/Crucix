#!/usr/bin/env node

// ============================================================
// NEWSAPI BASKET INTEGRATION — Сбор новостей в корзину
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { handleNewsAPIProxy } from './newsapi.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function ensureBasketDir() {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
    } catch (e) {}
}

async function loadBasket() {
    await ensureBasketDir();
    const file = join(BASKET_DIR, 'news.json');
    try {
        const data = await fs.readFile(file, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveBasket(items) {
    await ensureBasketDir();
    const file = join(BASKET_DIR, 'news.json');
    await fs.writeFile(file, JSON.stringify(items, null, 2));
}

// ============================================================
// 2. ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

export async function handleNewsAPIBasket(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        const params = new URLSearchParams(url.search);
        const q = params.get('q') || 'global';
        const maxItems = parseInt(params.get('max')) || 10;
        const action = params.get('action') || 'collect';

        // --- GET /api/newsapi/basket?q=...&action=collect ---
        if (path === '/api/newsapi/basket' && req.method === 'GET') {
            if (action === 'collect') {
                // Сначала получаем новости через прокси
                const proxyReq = {
                    url: `/api/newsapi/search?q=${encodeURIComponent(q)}&pageSize=${maxItems}`,
                    method: 'GET',
                    headers: req.headers
                };

                // Создаём фейковый ответ для сбора данных
                let responseData = null;
                const proxyRes = {
                    writeHead: () => {},
                    end: (data) => {
                        try {
                            responseData = JSON.parse(data);
                        } catch (e) {
                            responseData = { success: false, error: 'Ошибка парсинга' };
                        }
                    },
                    setHeader: () => {}
                };

                await handleNewsAPIProxy(proxyReq, proxyRes);

                if (!responseData || !responseData.success) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: false,
                        error: 'Не удалось получить новости из NewsAPI'
                    }));
                    return;
                }

                // Сохраняем в корзину
                const basket = await loadBasket();
                const articles = responseData.articles || [];

                let added = 0;
                for (const article of articles) {
                    const item = {
                        id: `newsapi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        title: article.title || 'Без заголовка',
                        description: article.description || '',
                        url: article.url || '',
                        source: article.source?.name || 'NewsAPI',
                        date: article.publishedAt || new Date().toISOString(),
                        category: 'news',
                        type: 'news',
                        origin: `NewsAPI (${q})`,
                        tags: ['NewsAPI', q],
                        imageUrl: article.urlToImage || null,
                        rating: null,
                        analyzed: false,
                        collectedAt: new Date().toISOString()
                    };

                    // Проверяем, нет ли уже такой новости
                    const exists = basket.some(b => b.url === item.url);
                    if (!exists) {
                        basket.push(item);
                        added++;
                    }
                }

                await saveBasket(basket);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: `Добавлено ${added} новостей в корзину`,
                    total: basket.length,
                    added: added,
                    query: q,
                    timestamp: new Date().toISOString()
                }));
                return;
            }

            // --- GET /api/newsapi/basket?action=list ---
            if (action === 'list') {
                const basket = await loadBasket();
                const newsItems = basket.filter(item => item.type === 'news' || item.origin?.includes('NewsAPI'));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    count: newsItems.length,
                    items: newsItems,
                    timestamp: new Date().toISOString()
                }));
                return;
            }

            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: false,
                error: 'Неизвестное действие. Используйте action=collect или action=list'
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[NewsAPI Basket] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleNewsAPIBasket };
