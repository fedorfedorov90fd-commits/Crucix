#!/usr/bin/env node
// apis/sources/gdelt.mjs
// GDELT API v2.0 - альтернативный эндпоинт

const BASE_URL = 'https://api.gdeltproject.org/api/v2';
const TIMEOUT = 30000;

// === ВАРИАНТ 1: Использование /search/ (более стабильный) ===
export async function getEventsViaSearch(query = '*', hours = 24, maxRecords = 50) {
    // Используем search API вместо doc API
    const url = `${BASE_URL}/search/search?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=${maxRecords}&format=json&timespan=${hours}h`;

    try {
        console.log(`[GDELT] Search запрос: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Crucix-OSINT/2.0'
            }
        });

        if (!response.ok) {
            console.error(`[GDELT] Ошибка ${response.status}: ${response.statusText}`);
            return [];
        }

        const text = await response.text();

        // Проверяем, что это JSON
        if (!text.trim().startsWith('{')) {
            console.error('[GDELT] Ответ не JSON, пробуем альтернативный формат');
            return [];
        }

        const data = JSON.parse(text);
        return parseEvents(data);

    } catch (error) {
        console.error('[GDELT] Search ошибка:', error.message);
        return [];
    }
}

// === ВАРИАНТ 2: Использование /doc/ с query параметром (проверенный) ===
export async function getRecentEvents(hours = 24, maxRecords = 25) {
    // Увеличиваем задержку перед запросом
    await sleep(2000);

    const url = `${BASE_URL}/doc/doc?query=(* *)&mode=artlist&maxrecords=${maxRecords}&format=json&timespan=${hours}h`;

    try {
        console.log(`[GDELT] Запрос: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Crucix-OSINT/2.0',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`[GDELT] Ошибка ${response.status}: ${response.statusText}`);
            return [];
        }

        const text = await response.text();

        if (!text.trim().startsWith('{')) {
            console.error('[GDELT] Ответ не JSON');
            return [];
        }

        const data = JSON.parse(text);
        return parseEvents(data);

    } catch (error) {
        console.error('[GDELT] Ошибка:', error.message);
        return [];
    }
}

// === ВАРИАНТ 3: Использование /geofeed/ для событий с координатами ===
export async function getGeoEvents(hours = 24, maxRecords = 50) {
    await sleep(2000);

    const url = `${BASE_URL}/geofeed/geofeed?query=*&mode=artlist&maxrecords=${maxRecords}&format=json&timespan=${hours}h`;

    try {
        console.log(`[GDELT] GeoFeed запрос: ${url}`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Crucix-OSINT/2.0',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.error(`[GDELT] GeoFeed ошибка ${response.status}`);
            return [];
        }

        const text = await response.text();
        if (!text.trim().startsWith('{')) {
            return [];
        }

        const data = JSON.parse(text);
        return parseEvents(data);

    } catch (error) {
        console.error('[GDELT] GeoFeed ошибка:', error.message);
        return [];
    }
}

// === ПАРСИНГ ОТВЕТА ===
function parseEvents(data) {
    let articles = [];

    if (data && data.articles && Array.isArray(data.articles)) {
        articles = data.articles;
    } else if (data && data.article && Array.isArray(data.article)) {
        articles = data.article;
    } else if (data && data.result && Array.isArray(data.result)) {
        articles = data.result;
    } else if (Array.isArray(data)) {
        articles = data;
    }

    if (articles.length === 0) {
        return [];
    }

    return articles.slice(0, 50).map((article, index) => ({
        id: article.url || article.URL || `gdelt-${Date.now()}-${index}`,
        title: article.title || article.Title || article.headline || 'Без заголовка',
        description: article.description || article.Description || article.snippet || article.Snippet || '',
        url: article.url || article.URL || '',
        source: article.source || article.Source || article.sourcecountry || 'GDELT',
        date: article.date || article.Date || article.seendate || article.pubdate || new Date().toISOString(),
        country: article.country || article.Country || article.sourcecountry || article.location || 'Unknown',
        category: article.theme || article.Theme || article.cat || 'General',
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
            case 'recent':
                events = await getRecentEvents(hours, maxRecords);
                break;

            case 'search':
                events = await getEventsViaSearch(query, hours, maxRecords);
                break;

            case 'geo':
                events = await getGeoEvents(hours, maxRecords);
                break;

            case 'summary':
                // Берём последние события для сводки
                const allEvents = await getRecentEvents(hours, Math.min(maxRecords, 30));
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
                    message: 'GDELT API работает',
                    timestamp: new Date().toISOString()
                }));
                return;

            default:
                res.writeHead(404);
                res.end(JSON.stringify({
                    success: false,
                    error: 'Неизвестный эндпоинт. Доступные: recent, search, geo, summary, ping'
                }));
                return;
        }

        if (!events || events.length === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                events: [],
                count: 0,
                message: 'Нет событий за указанный период',
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
    getRecentEvents,
    getEventsViaSearch,
    getGeoEvents,
    handleGDELTAPI
};
