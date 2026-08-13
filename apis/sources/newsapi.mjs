#!/usr/bin/env node
// apis/sources/newsapi.mjs
// NewsAPI - альтернатива GDELT

import { fetchWithRetry } from '../utils/fetch.mjs';

const BASE_URL = 'https://newsapi.org/v2';
const API_KEY = process.env.NEWSAPI_KEY || '2965aeec21674948b0217e163df31d10';

// === ОСНОВНЫЕ ФУНКЦИИ ===

// Поиск новостей по ключевым словам
export async function searchNews(query = 'world', maxRecords = 25, language = 'en') {
    const url = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&pageSize=${maxRecords}&sortBy=publishedAt&language=${language}&apiKey=${API_KEY}`;

    try {
        console.log(`[NewsAPI] Поиск: ${query}`);
        const response = await fetchWithRetry(url, {
            headers: {
                'User-Agent': 'Crucix-OSINT/2.0'
            }
        }, 2, 2000);

        if (!response.ok) {
            const error = await response.text();
            console.error(`[NewsAPI] Ошибка ${response.status}: ${error}`);
            return [];
        }

        const data = await response.json();
        return parseNews(data);
    } catch (error) {
        console.error('[NewsAPI] Ошибка:', error.message);
        return [];
    }
}

// Получить топ-новости (главные заголовки)
export async function getTopNews(country = 'us', maxRecords = 25) {
    const url = `${BASE_URL}/top-headlines?country=${country}&pageSize=${maxRecords}&apiKey=${API_KEY}`;

    try {
        console.log(`[NewsAPI] Топ-новости: ${country}`);
        const response = await fetchWithRetry(url, {
            headers: {
                'User-Agent': 'Crucix-OSINT/2.0'
            }
        }, 2, 2000);

        if (!response.ok) {
            const error = await response.text();
            console.error(`[NewsAPI] Ошибка ${response.status}: ${error}`);
            return [];
        }

        const data = await response.json();
        return parseNews(data);
    } catch (error) {
        console.error('[NewsAPI] Ошибка:', error.message);
        return [];
    }
}

// Парсинг ответа NewsAPI
function parseNews(data) {
    if (!data.articles || !Array.isArray(data.articles)) {
        console.log('[NewsAPI] Нет статей в ответе');
        return [];
    }

    return data.articles
        .filter(article => article.title && article.title !== '[Removed]')
        .slice(0, 50)
        .map(article => ({
            id: article.url || `news-${Date.now()}-${Math.random()}`,
            title: article.title || 'Без заголовка',
            description: article.description || article.content || '',
            url: article.url || '',
            source: article.source?.name || 'NewsAPI',
            date: article.publishedAt || new Date().toISOString(),
            country: article.country || 'Unknown',
            category: article.category || 'General',
            coordinates: null,
            relevance: 0,
            tone: 0,
            imageUrl: article.urlToImage || null
        }));
}

// === API-ОБРАБОТЧИК ДЛЯ SERVER.MJS ===

export async function handleNewsAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const params = url.searchParams;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method !== 'GET') {
        res.writeHead(405);
        res.end(JSON.stringify({ success: false, error: 'Метод не поддерживается' }));
        return;
    }

    try {
        const query = params.get('q') || '*';
        const maxRecords = Math.min(parseInt(params.get('max')) || 25, 100);
        const language = params.get('lang') || 'en';
        const country = params.get('country') || 'us';
        const action = pathname.replace('/api/newsapi/', '');

        let events = [];

        // Ждём перед запросом (чтобы не превысить лимиты)
        await sleep(1000);

        switch (action) {
            case 'search':
                events = await searchNews(query, maxRecords, language);
                break;

            case 'top':
                events = await getTopNews(country, maxRecords);
                break;

            case 'summary':
                const allEvents = await searchNews('*', Math.min(maxRecords, 30), language);
                const summary = {
                    total: allEvents.length,
                    bySource: {},
                    topEvents: allEvents.slice(0, 10).map(e => ({
                        title: e.title,
                        source: e.source,
                        date: e.date
                    }))
                };

                allEvents.forEach(e => {
                    summary.bySource[e.source] = (summary.bySource[e.source] || 0) + 1;
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, summary }));
                return;

            case 'ping':
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'NewsAPI работает',
                    timestamp: new Date().toISOString(),
                    apiKeyConfigured: API_KEY && API_KEY !== 'ваш_ключ_здесь'
                }));
                return;

            default:
                res.writeHead(404);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Неизвестный эндпоинт. Доступные: search, top, summary, ping'
                }));
                return;
        }

        if (!events || events.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                events: [],
                count: 0,
                message: 'Нет новостей по вашему запросу',
                params: { query, maxRecords, language, country }
            }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            events,
            count: events.length,
            params: { query, maxRecords, language, country }
        }));

    } catch (error) {
        console.error('[NewsAPI] Ошибка:', error.message);
        res.writeHead(500);
        res.end(JSON.stringify({
            success: false,
            error: error.message || 'Внутренняя ошибка сервера'
        }));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
    searchNews,
    getTopNews,
    handleNewsAPI
};
