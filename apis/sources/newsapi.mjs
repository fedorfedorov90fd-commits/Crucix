#!/usr/bin/env node

// ============================================================
// NEWSAPI — Прокси для NewsAPI.org
// ============================================================

const NEWSAPI_KEY = '2965aeec21674948b0217e163df31d10';
const BASE_URL = 'https://newsapi.org/v2';

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function fetchNewsAPI(endpoint, params = {}) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.set('apiKey', NEWSAPI_KEY);
    for (const [key, value] of Object.entries(params)) {
        if (value) url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`NewsAPI ошибка: ${response.status}`);
    }
    return response.json();
}

// ============================================================
// 2. ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

export async function handleNewsAPIProxy(req, res) {
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
        // --- GET /api/newsapi/ping ---
        if (path === '/api/newsapi/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'NewsAPI прокси работает',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/newsapi/search?q=... ---
        if (path === '/api/newsapi/search') {
            const params = new URLSearchParams(url.search);
            const q = params.get('q') || 'global';
            const pageSize = parseInt(params.get('pageSize')) || 20;

            const data = await fetchNewsAPI('/everything', {
                q: q,
                pageSize: pageSize,
                language: 'en',
                sortBy: 'publishedAt'
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...data,
                source: 'NewsAPI'
            }));
            return;
        }

        // --- GET /api/newsapi/top?country=... ---
        if (path === '/api/newsapi/top') {
            const params = new URLSearchParams(url.search);
            const country = params.get('country') || 'us';
            const category = params.get('category') || 'general';
            const pageSize = parseInt(params.get('pageSize')) || 20;

            const data = await fetchNewsAPI('/top-headlines', {
                country: country,
                category: category,
                pageSize: pageSize
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...data,
                source: 'NewsAPI'
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[NewsAPI] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 3. ЭКСПОРТ
// ============================================================

export default { handleNewsAPIProxy };
