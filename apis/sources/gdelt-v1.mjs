#!/usr/bin/env node
// apis/sources/gdelt-v1.mjs
// GDELT 1.0 API - стабильная версия

// === GDELT 1.0 API эндпоинты ===
// /api/v1/summary/summary - основной рабочий эндпоинт

export async function getGDELT1Events(query = '*', hours = 24, maxRecords = 25) {
    // Используем проверенный GDELT 1.0 API
    const url = `https://api.gdeltproject.org/api/v1/summary/summary?query=${encodeURIComponent(query)}&format=json&timespan=${hours}h`;
    
    try {
        console.log(`[GDELT] Запрос к GDELT 1.0: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Crucix-OSINT/2.0)',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            console.error(`[GDELT] Ошибка ${response.status}: ${response.statusText}`);
            // Пробуем альтернативный эндпоинт
            return await getGDELT1Alt(query, hours, maxRecords);
        }
        
        const text = await response.text();
        
        // Проверяем, что это JSON
        if (!text.trim().startsWith('{')) {
            console.error('[GDELT] Ответ не JSON, пробуем альтернативный формат');
            return await getGDELT1Alt(query, hours, maxRecords);
        }
        
        const data = JSON.parse(text);
        return parseGDELT1Response(data);
        
    } catch (error) {
        console.error('[GDELT] GDELT 1.0 ошибка:', error.message);
        // Пробуем альтернативный эндпоинт
        return await getGDELT1Alt(query, hours, maxRecords);
    }
}

// Альтернативный эндпоинт GDELT 1.0
async function getGDELT1Alt(query = '*', hours = 24, maxRecords = 25) {
    const url = `https://api.gdeltproject.org/api/v1/summary/summary?query=${encodeURIComponent(query)}&format=html&timespan=${hours}h`;
    
    try {
        console.log(`[GDELT] Альтернативный запрос: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Crucix-OSINT/2.0)'
            }
        });
        
        if (!response.ok) {
            console.error(`[GDELT] Альтернативный API ошибка ${response.status}`);
            return [];
        }
        
        const html = await response.text();
        // Парсим HTML для извлечения данных
        return parseGDELT1HTML(html);
        
    } catch (error) {
        console.error('[GDELT] Альтернативный API ошибка:', error.message);
        return [];
    }
}

// Парсинг JSON ответа GDELT 1.0
function parseGDELT1Response(data) {
    let articles = [];
    
    // GDELT 1.0 может возвращать данные в разных форматах
    if (data && data.articles && Array.isArray(data.articles)) {
        articles = data.articles;
    } else if (data && data.results && Array.isArray(data.results)) {
        articles = data.results;
    } else if (data && data.data && Array.isArray(data.data)) {
        articles = data.data;
    } else if (data && data.items && Array.isArray(data.items)) {
        articles = data.items;
    } else if (Array.isArray(data)) {
        articles = data;
    }
    
    if (articles.length === 0) {
        console.log('[GDELT] Не найдено статей в ответе');
        return [];
    }
    
    return articles.slice(0, 50).map((article, index) => ({
        id: article.url || article.URL || article.link || article.source_url || `gdelt-${Date.now()}-${index}`,
        title: article.title || article.Title || article.headline || article.name || article.article_title || 'Без заголовка',
        description: article.description || article.Description || article.snippet || article.Snippet || article.summary || article.text || '',
        url: article.url || article.URL || article.link || article.source_url || '',
        source: article.source || article.Source || article.sourcecountry || article.media || article.publisher || 'GDELT',
        date: article.date || article.Date || article.seendate || article.pubdate || article.published || article.timestamp || new Date().toISOString(),
        country: article.country || article.Country || article.sourcecountry || article.location || article.loc || 'Unknown',
        category: article.theme || article.Theme || article.cat || article.category || article.section || 'General',
        coordinates: article.lat && article.lon ? {
            lat: parseFloat(article.lat),
            lon: parseFloat(article.lon)
        } : (article.location && article.location.lat ? {
            lat: parseFloat(article.location.lat),
            lon: parseFloat(article.location.lon)
        } : null),
        relevance: article.relevance || article.Relevance || article.score || 0,
        tone: article.tone || article.Tone || article.sentiment || 0
    }));
}

// Простой парсинг HTML для GDELT 1.0
function parseGDELT1HTML(html) {
    // Извлекаем данные из HTML (упрощённо)
    const articles = [];
    
    // Ищем элементы с классом article или подобные
    const articleRegex = /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    let match;
    
    while ((match = articleRegex.exec(html)) !== null) {
        const content = match[1];
        const titleMatch = content.match(/<h[1-6][^>]*>([^<]*)<\/h[1-6]>/i);
        const descMatch = content.match(/<p[^>]*>([^<]*)<\/p>/i);
        const linkMatch = content.match(/<a[^>]*href="([^"]*)"[^>]*>/i);
        
        if (titleMatch || descMatch) {
            articles.push({
                id: `gdelt-html-${Date.now()}-${articles.length}`,
                title: titleMatch ? titleMatch[1].trim() : 'Без заголовка',
                description: descMatch ? descMatch[1].trim() : '',
                url: linkMatch ? linkMatch[1] : '',
                source: 'GDELT',
                date: new Date().toISOString(),
                country: 'Unknown',
                category: 'General',
                coordinates: null,
                relevance: 0,
                tone: 0
            });
        }
    }
    
    return articles;
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
                events = await getGDELT1Events(query, hours, maxRecords);
                break;
            
            case 'recent':
                events = await getGDELT1Events('*', hours, maxRecords);
                break;
            
            case 'summary':
                const allEvents = await getGDELT1Events('*', hours, Math.min(maxRecords, 30));
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
                    message: 'GDELT 1.0 API работает',
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
    getGDELT1Events,
    handleGDELTAPI
};