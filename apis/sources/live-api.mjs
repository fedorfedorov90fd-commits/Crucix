#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №19: ЛЕНТА ЖИВЫХ НОВОСТНЫХ ПОТОКОВ
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'live');
const FAVORITES_FILE = join(DATA_DIR, 'favorites.json');

// ============================================================
// 1. ДЕМО-ДАННЫЕ
// ============================================================

const CATEGORIES = [
    { id: 'all', name: 'Все', icon: '📰' },
    { id: 'politics', name: 'Политика', icon: '🏛️' },
    { id: 'economy', name: 'Экономика', icon: '💰' },
    { id: 'military', name: 'Военные', icon: '⚔️' },
    { id: 'technology', name: 'Технологии', icon: '💻' },
    { id: 'environment', name: 'Экология', icon: '🌿' },
    { id: 'health', name: 'Здоровье', icon: '🏥' },
    { id: 'cyber', name: 'Кибер', icon: '🛡️' }
];

const REGIONS = [
    { id: 'all', name: 'Все регионы' },
    { id: 'global', name: '🌍 Глобально' },
    { id: 'europe', name: '🇪🇺 Европа' },
    { id: 'usa', name: '🇺🇸 США' },
    { id: 'asia', name: '🌏 Азия' },
    { id: 'middle-east', name: '🏛️ Ближний Восток' },
    { id: 'africa', name: '🌍 Африка' },
    { id: 'ukraine', name: '🇺🇦 Украина' },
    { id: 'russia', name: '🇷🇺 Россия' }
];

const DEMO_FEED = [
    {
        id: 'news-001',
        title: 'Россия и Украина договорились о гуманитарном коридоре',
        summary: 'Стороны достигли соглашения о создании гуманитарного коридора для эвакуации мирных жителей из зоны конфликта.',
        source: 'TASS',
        category: 'politics',
        region: 'ukraine',
        importance: 'high',
        sentiment: 'positive',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        url: 'https://tass.ru',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-002',
        title: 'Цены на нефть превысили $120 на фоне геополитической напряжённости',
        summary: 'Стоимость нефти марки Brent достигла отметки $120 за баррель на фоне эскалации конфликта на Ближнем Востоке.',
        source: 'Reuters',
        category: 'economy',
        region: 'global',
        importance: 'high',
        sentiment: 'negative',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        url: 'https://reuters.com',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-003',
        title: 'США объявили о новых санкциях против России',
        summary: 'Администрация США ввела дополнительные санкционные ограничения против российского энергетического сектора.',
        source: 'AP News',
        category: 'politics',
        region: 'usa',
        importance: 'high',
        sentiment: 'negative',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        url: 'https://apnews.com',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-004',
        title: 'Китай представил новый ИИ-чип, превосходящий Nvidia H100',
        summary: 'Китайская компания Huawei представила новый процессор для искусственного интеллекта, который по производительности превосходит Nvidia H100.',
        source: 'Bloomberg',
        category: 'technology',
        region: 'asia',
        importance: 'medium',
        sentiment: 'positive',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        url: 'https://bloomberg.com',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-005',
        title: 'В Балтийском море зафиксирована активность НАТО',
        summary: 'Увеличение военной активности НАТО в Балтийском море вызывает обеспокоенность у российских властей.',
        source: 'BBC',
        category: 'military',
        region: 'europe',
        importance: 'high',
        sentiment: 'negative',
        timestamp: new Date(Date.now() - 2400000).toISOString(),
        url: 'https://bbc.com',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-006',
        title: 'Европа готовится к зиме: запасы газа на рекордном уровне',
        summary: 'Запасы газа в европейских хранилищах достигли рекордных 95% на фоне подготовки к отопительному сезону.',
        source: 'Euronews',
        category: 'economy',
        region: 'europe',
        importance: 'medium',
        sentiment: 'positive',
        timestamp: new Date(Date.now() - 3000000).toISOString(),
        url: 'https://euronews.com',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-007',
        title: 'Киберкоманда США отразила атаку на критическую инфраструктуру',
        summary: 'Киберкоманда США предотвратила крупную кибератаку на систему управления энергосетью страны.',
        source: 'Cyberscoop',
        category: 'cyber',
        region: 'usa',
        importance: 'critical',
        sentiment: 'positive',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        url: 'https://cyberscoop.com',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-008',
        title: 'Аномальная жара в Европе: рекордные температуры',
        summary: 'Южная Европа столкнулась с аномальной жарой. Температура воздуха превысила 45°C в ряде регионов.',
        source: 'Al Jazeera',
        category: 'environment',
        region: 'europe',
        importance: 'medium',
        sentiment: 'negative',
        timestamp: new Date(Date.now() - 4200000).toISOString(),
        url: 'https://aljazeera.com',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-009',
        title: 'Прорыв в лечении онкологических заболеваний',
        summary: 'Учёные представили новый метод лечения рака с использованием CRISPR-технологии с эффективностью 85%.',
        source: 'Nature',
        category: 'health',
        region: 'global',
        importance: 'high',
        sentiment: 'positive',
        timestamp: new Date(Date.now() - 4800000).toISOString(),
        url: 'https://nature.com',
        image: null,
        isFavorite: false
    },
    {
        id: 'news-010',
        title: 'Совет Безопасности ООН проведёт экстренное заседание',
        summary: 'Совет Безопасности ООН созывает экстренное заседание по ситуации в районе Персидского залива.',
        source: 'UN News',
        category: 'politics',
        region: 'middle-east',
        importance: 'critical',
        sentiment: 'neutral',
        timestamp: new Date(Date.now() - 5400000).toISOString(),
        url: 'https://news.un.org',
        image: null,
        isFavorite: false
    }
];

// ============================================================
// 2. РАБОТА С ИЗБРАННЫМ
// ============================================================

async function loadFavorites() {
    try {
        const data = await fs.readFile(FAVORITES_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

async function saveFavorites(favorites) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FAVORITES_FILE, JSON.stringify(favorites, null, 2));
}

// ============================================================
// 3. ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

function getFeed(params = {}) {
    let feed = [...DEMO_FEED];

    // Фильтрация по категории
    if (params.category && params.category !== 'all') {
        feed = feed.filter(n => n.category === params.category);
    }

    // Фильтрация по региону
    if (params.region && params.region !== 'all') {
        feed = feed.filter(n => n.region === params.region);
    }

    // Фильтрация по важности
    if (params.importance && params.importance !== 'all') {
        feed = feed.filter(n => n.importance === params.importance);
    }

    // Поиск
    if (params.search) {
        const query = params.search.toLowerCase();
        feed = feed.filter(n =>
            n.title.toLowerCase().includes(query) ||
            n.summary.toLowerCase().includes(query)
        );
    }

    // Сортировка (по умолчанию — по времени, новые сверху)
    feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return feed;
}

function getCategories() {
    return CATEGORIES;
}

function getRegions() {
    return REGIONS;
}

function getStats(feed) {
    const total = feed.length;
    const byCategory = {};
    const byImportance = { critical: 0, high: 0, medium: 0, low: 0 };
    const bySentiment = { positive: 0, negative: 0, neutral: 0 };

    for (const n of feed) {
        if (!byCategory[n.category]) byCategory[n.category] = 0;
        byCategory[n.category]++;
        if (n.importance) byImportance[n.importance]++;
        if (n.sentiment) bySentiment[n.sentiment]++;
    }

    return {
        total,
        byCategory,
        byImportance,
        bySentiment,
        lastUpdate: new Date().toISOString()
    };
}

function toggleFavorite(newsId, favorites) {
    const index = favorites.indexOf(newsId);
    if (index > -1) {
        favorites.splice(index, 1);
        return { action: 'removed', favorites };
    } else {
        favorites.push(newsId);
        return { action: 'added', favorites };
    }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleLiveAPI(req, res) {
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
        const favorites = await loadFavorites();

        // --- GET /api/live/feed ---
        if (path === '/api/live/feed' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const feed = getFeed({
                category: params.get('category') || 'all',
                region: params.get('region') || 'all',
                importance: params.get('importance') || 'all',
                search: params.get('search') || ''
            });
            // Отмечаем избранные
            const feedWithFavorites = feed.map(n => ({
                ...n,
                isFavorite: favorites.includes(n.id)
            }));
            const stats = getStats(feed);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                feed: feedWithFavorites,
                stats: stats,
                total: feedWithFavorites.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/live/categories ---
        if (path === '/api/live/categories' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                categories: CATEGORIES,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/live/regions ---
        if (path === '/api/live/regions' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                regions: REGIONS,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/live/favorite ---
        if (path === '/api/live/favorite' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const newsId = data.newsId;
                    if (!newsId) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Укажите newsId' }));
                        return;
                    }
                    const result = toggleFavorite(newsId, favorites);
                    await saveFavorites(result.favorites);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        action: result.action,
                        favorites: result.favorites,
                        timestamp: new Date().toISOString()
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/live/favorites ---
        if (path === '/api/live/favorites' && req.method === 'GET') {
            const feed = getFeed({});
            const favoriteNews = feed.filter(n => favorites.includes(n.id));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                favorites: favoriteNews,
                count: favoriteNews.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/live/stats ---
        if (path === '/api/live/stats' && req.method === 'GET') {
            const feed = getFeed({});
            const stats = getStats(feed);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...stats,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Неизвестный путь'
        }));

    } catch (error) {
        console.error('[Live API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleLiveAPI };
