#!/usr/bin/env node
// apis/sources/gdelt-curl.mjs
// GDELT через curl (обход fetch ограничений)

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// === ВАРИАНТ 1: GDELT через curl ===
export async function getEventsViaCurl(query = '*', hours = 24, maxRecords = 25) {
    const url = `https://api.gdeltproject.org/api/v2/search/search?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=${maxRecords}&format=json&timespan=${hours}h`;
    
    try {
        console.log(`[GDELT] Curl запрос: ${url}`);
        
        // Используем curl с User-Agent
        const { stdout, stderr } = await execAsync(`curl -s -H "User-Agent: Mozilla/5.0" "${url}"`, {
            timeout: 30000
        });
        
        if (stderr && !stderr.includes('Warning')) {
            console.error('[GDELT] Curl ошибка:', stderr);
            return [];
        }
        
        if (!stdout || stdout.trim() === '') {
            console.error('[GDELT] Пустой ответ');
            return [];
        }
        
        // Проверяем, что это JSON
        if (!stdout.trim().startsWith('{')) {
            console.error('[GDELT] Ответ не JSON:', stdout.substring(0, 100));
            return [];
        }
        
        const data = JSON.parse(stdout);
        return parseEvents(data);
        
    } catch (error) {
        console.error('[GDELT] Curl ошибка:', error.message);
        return [];
    }
}

// === ВАРИАНТ 2: Использование GDELT 1.0 API (более стабильный) ===
export async function getEventsViaGDELT1(query = '*', hours = 24, maxRecords = 25) {
    // GDELT 1.0 API - более старый, но часто работает когда 2.0 падает
    const url = `https://api.gdeltproject.org/api/v1/summary/summary?query=${encodeURIComponent(query)}&format=json&timespan=${hours}h`;
    
    try {
        console.log(`[GDELT] GDELT 1.0 запрос: ${url}`);
        
        const { stdout, stderr } = await execAsync(`curl -s -H "User-Agent: Mozilla/5.0" "${url}"`, {
            timeout: 30000
        });
        
        if (stderr && !stderr.includes('Warning')) {
            console.error('[GDELT] GDELT 1.0 ошибка:', stderr);
            return [];
        }
        
        if (!stdout || stdout.trim() === '') {
            return [];
        }
        
        // Для GDELT 1.0 формат другой - пробуем распарсить
        try {
            const data = JSON.parse(stdout);
            // GDELT 1.0 возвращает объект с полем "articles" или "results"
            if (data && data.articles) {
                return parseEvents({ articles: data.articles });
            } else if (data && data.results) {
                return parseEvents({ articles: data.results });
            } else if (Array.isArray(data)) {
                return parseEvents(data);
            }
            return [];
        } catch (e) {
            console.error('[GDELT] Ошибка парсинга GDELT 1.0:', e.message);
            return [];
        }
        
    } catch (error) {
        console.error('[GDELT] GDELT 1.0 ошибка:', error.message);
        return [];
    }
}

// === Парсинг ===
function parseEvents(data) {
    let articles = [];
    
    if (data && data.articles && Array.isArray(data.articles)) {
        articles = data.articles;
    } else if (data && data.article && Array.isArray(data.article)) {
        articles = data.article;
    } else if (data && data.result && Array.isArray(data.result)) {
        articles = data.result;
    } else if (data && data.results && Array.isArray(data.results)) {
        articles = data.results;
    } else if (Array.isArray(data)) {
        articles = data;
    }
    
    if (articles.length === 0) {
        return [];
    }
    
    return articles.slice(0, 50).map((article, index) => ({
        id: article.url || article.URL || article.link || `gdelt-${Date.now()}-${index}`,
        title: article.title || article.Title || article.headline || article.name || 'Без заголовка',
        description: article.description || article.Description || article.snippet || article.Snippet || article.summary || '',
        url: article.url || article.URL || article.link || '',
        source: article.source || article.Source || article.sourcecountry || article.media || 'GDELT',
        date: article.date || article.Date || article.seendate || article.pubdate || article.published || new Date().toISOString(),
        country: article.country || article.Country || article.sourcecountry || article.location || 'Unknown',
        category: article.theme || article.Theme || article.cat || article.category || 'General',
        coordinates: article.lat && article.lon ? {
            lat: parseFloat(article.lat),
            lon: parseFloat(article.lon)
        } : (article.location && article.location.lat ? {
            lat: parseFloat(article.location.lat),
            lon: parseFloat(article.location.lon)
        } : null),
        relevance: article.relevance || article.Relevance || 0,
        tone: article.tone || article.Tone || 0
    }));
}

// === API ОБРАБОТЧИК ===
export async function handleGDELTAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const params = url.searchParams;

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
        const hours = parseInt(params.get('hours')) || 24;
        const maxRecords = Math.min(parseInt(params.get('max')) || 25, 50);
        const query = params.get('query') || '*';
        const action = pathname.replace('/api/gdelt/', '');

        let events = [];

        // Ждём перед запросом
        await sleep(1500);

        switch (action) {
            case 'search':
                // Пробуем через curl
                events = await getEventsViaCurl(query, hours, maxRecords);
                // Если не получилось - пробуем GDELT 1.0
                if (events.length === 0) {
                    console.log('[GDELT] Пробуем GDELT 1.0...');
                    events = await getEventsViaGDELT1(query, hours, maxRecords);
                }
                break;
            
            case 'recent':
                events = await getEventsViaCurl('*', hours, maxRecords);
                if (events.length === 0) {
                    events = await getEventsViaGDELT1('*', hours, maxRecords);
                }
                break;
            
            case 'summary':
                const allEvents = await getEventsViaCurl('*', hours, Math.min(maxRecords, 30));
                const summary = {
                    total: allEvents.length,
                    byCountry: {},
                    byCategory: {},
                    topEvents: allEvents.slice(0, 10).map(e => ({
                        title: e.title,
                        source: e.source,
                        country: e.country,
                        date: e.date
                    }))
                };
                
                allEvents.forEach(e => {
                    summary.byCountry[e.country] = (summary.byCountry[e.country] || 0) + 1;
                    summary.byCategory[e.category] = (summary.byCategory[e.category] || 0) + 1;
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, summary }));
                return;
            
            case 'ping':
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'GDELT API работает (через curl)',
                    timestamp: new Date().toISOString()
                }));
                return;
            
            default:
                res.writeHead(404);
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'Неизвестный эндпоинт. Доступные: search, recent, summary, ping' 
                }));
                return;
        }

        if (!events || events.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                events: [],
                count: 0,
                message: 'Нет событий за указанный период. Попробуйте позже.',
                params: { hours, maxRecords, query }
            }));
            return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            events,
            count: events.length,
            params: { hours, maxRecords, query }
        }));

    } catch (error) {
        console.error('[GDELT API] Ошибка:', error.message);
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
    getEventsViaCurl,
    getEventsViaGDELT1,
    handleGDELTAPI
};