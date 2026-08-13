#!/usr/bin/env node
// apis/sources/newsapi-basket-integration.mjs
// Интеграция NewsAPI с корзиной данных

import { searchNews, getTopNews } from './newsapi.mjs';

// URL корзины
const BASKET_URL = 'http://localhost:3117/api/basket';

// Добавление новостей в корзину
export async function addNewsToBasket(newsItems, source = 'NewsAPI') {
    let addedCount = 0;
    let errors = 0;

    for (const item of newsItems) {
        try {
            // Форматируем для корзины - используем тот же формат, что и в basket-api.mjs
            const basketItem = {
                title: item.title || 'Без заголовка',
                description: item.description || '',
                url: item.url || '',
                source: item.source || source,
                date: item.date || new Date().toISOString(),
                category: item.category || 'General',
                type: 'news',
                origin: source,
                tags: [source, item.category || 'general'],
                imageUrl: item.imageUrl || null,
                rating: null,
                analyzed: false
            };

            console.log(`[NewsAPI] Отправка в корзину: ${item.title.substring(0, 50)}...`);

            // Отправляем в корзину - используем POST
            const response = await fetch(BASKET_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(basketItem)
            });

            const responseText = await response.text();
            console.log(`[NewsAPI] Ответ корзины: ${response.status} - ${responseText.substring(0, 100)}`);

            if (response.ok) {
                addedCount++;
            } else {
                errors++;
                console.error(`[NewsAPI] Ошибка добавления (${response.status}): ${item.title.substring(0, 50)}...`);
            }

            // Задержка между запросами
            await sleep(300);

        } catch (error) {
            errors++;
            console.error('[NewsAPI] Ошибка при добавлении в корзину:', error.message);
        }
    }

    return { added: addedCount, errors };
}

// Автоматический сбор и добавление новостей
export async function autoCollectNews(query = '*', maxRecords = 25, language = 'en') {
    console.log(`[NewsAPI] Автосбор: ${query}`);

    try {
        const news = await searchNews(query, maxRecords, language);

        if (news.length === 0) {
            console.log('[NewsAPI] Новостей не найдено');
            return { added: 0, errors: 0, total: 0 };
        }

        console.log(`[NewsAPI] Найдено ${news.length} новостей, добавляем в корзину...`);
        const result = await addNewsToBasket(news, `NewsAPI (${query})`);

        console.log(`[NewsAPI] Добавлено: ${result.added}, Ошибок: ${result.errors}`);
        return { ...result, total: news.length };

    } catch (error) {
        console.error('[NewsAPI] Ошибка автосбора:', error.message);
        return { added: 0, errors: 1, total: 0 };
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// API-обработчик для добавления в корзину
export async function handleNewsAPIBasket(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const params = url.searchParams;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        const query = params.get('q') || '*';
        const maxRecords = Math.min(parseInt(params.get('max')) || 25, 100);
        const language = params.get('lang') || 'en';
        const action = params.get('action') || 'collect';

        if (action === 'collect') {
            // Собираем и добавляем в корзину
            const result = await autoCollectNews(query, maxRecords, language);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Новости добавлены в корзину',
                ...result,
                query,
                language,
                timestamp: new Date().toISOString()
            }));
        } else if (action === 'status') {
            // Статус корзины
            const basketResponse = await fetch(BASKET_URL);
            let basketData = {};
            try {
                basketData = await basketResponse.json();
            } catch (e) {
                basketData = { items: [] };
            }

            const newsCount = basketData.items?.filter(item => item.origin && item.origin.includes('NewsAPI')).length || 0;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                basketTotal: basketData.items?.length || 0,
                newsAPICount: newsCount,
                timestamp: new Date().toISOString()
            }));
        } else {
            throw new Error('Неизвестное действие. Доступные: collect, status');
        }

    } catch (error) {
        console.error('[NewsAPI Basket] Ошибка:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({
            success: false,
            error: error.message || 'Внутренняя ошибка сервера'
        }));
    }
}

export default {
    addNewsToBasket,
    autoCollectNews,
    handleNewsAPIBasket
};
