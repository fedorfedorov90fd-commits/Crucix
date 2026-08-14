#!/usr/bin/env node

// ============================================================
// TASS — НОВОСТНОЙ МОНИТОРИНГ (ТАСС)
// ============================================================
// Источник: ТАСС (RSS-лента)
// Данные: новости России и мира
// Версия: 2.0 (профессиональная, единый стиль)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// TASS RSS ленты
const TASS_FEEDS = {
    MAIN: 'https://tass.ru/rss/v2.xml',
    POLITICS: 'https://tass.ru/rss/politics.xml',
    ECONOMY: 'https://tass.ru/rss/economy.xml',
    WORLD: 'https://tass.ru/rss/world.xml',
    SCIENCE: 'https://tass.ru/rss/science.xml',
    SPORT: 'https://tass.ru/rss/sport.xml'
};

// Категории
const CATEGORIES = {
    POLITICS: 'Политика',
    ECONOMY: 'Экономика',
    WORLD: 'Мир',
    SCIENCE: 'Наука',
    SPORT: 'Спорт',
    MAIN: 'Главное'
};

// Уровни важности
const SEVERITY = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    NORMAL: 'normal'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchTASSNews(options = {}) {
    const {
        category = null,
        limit = 50,
        days = 7
    } = options;

    try {
        console.log('[TASS] Запрос новостей...');

        // Получаем данные из всех лент
        let allNews = [];

        try {
            const mainFeed = await fetchFeed(TASS_FEEDS.MAIN, CATEGORIES.MAIN);
            allNews = [...allNews, ...mainFeed];
        } catch (e) {
            console.warn('[TASS] Ошибка при получении главной ленты:', e.message);
        }

        try {
            const politicsFeed = await fetchFeed(TASS_FEEDS.POLITICS, CATEGORIES.POLITICS);
            allNews = [...allNews, ...politicsFeed];
        } catch (e) {
            console.warn('[TASS] Ошибка при получении политической ленты:', e.message);
        }

        try {
            const economyFeed = await fetchFeed(TASS_FEEDS.ECONOMY, CATEGORIES.ECONOMY);
            allNews = [...allNews, ...economyFeed];
        } catch (e) {
            console.warn('[TASS] Ошибка при получении экономической ленты:', e.message);
        }

        try {
            const worldFeed = await fetchFeed(TASS_FEEDS.WORLD, CATEGORIES.WORLD);
            allNews = [...allNews, ...worldFeed];
        } catch (e) {
            console.warn('[TASS] Ошибка при получении мировой ленты:', e.message);
        }

        // Если данных нет — используем демо
        if (allNews.length === 0) {
            console.log('[TASS] Реальные данные недоступны, использую демо-данные');
            return getDemoData();
        }

        // Фильтр по категории
        if (category) {
            allNews = allNews.filter(d =>
                d.category?.toLowerCase().includes(category.toLowerCase())
            );
        }

        // Сортируем по дате (новые сверху)
        allNews.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Ограничиваем количество
        if (allNews.length > limit) {
            allNews = allNews.slice(0, limit);
        }

        // Статистика
        const summary = getTASSSummary(allNews);
        const alerts = detectTASSAlerts(allNews);

        console.log(`[TASS] Получено ${allNews.length} новостей`);

        return {
            success: true,
            count: allNews.length,
            data: allNews,
            summary: summary,
            alerts: alerts,
            source: 'ТАСС (RSS)',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[TASS] Ошибка:', error.message);
        console.warn('[TASS] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ЛЕНТЫ
// ============================================================

async function fetchFeed(url, category) {
    try {
        const response = await fetchWithRetry(url, { timeout: 10000 });
        const text = await response.text();

        // Простой парсинг XML
        const items = [];
        const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g);

        for (const match of itemMatches) {
            const item = match[1];
            const titleMatch = item.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = item.match(/<link>([\s\S]*?)<\/link>/);
            const pubDateMatch = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);

            const title = titleMatch ? cleanHTML(titleMatch[1]) : 'Без названия';
            const link = linkMatch ? linkMatch[1].trim() : '';
            const pubDate = pubDateMatch ? pubDateMatch[1].trim() : new Date().toISOString();
            const description = descMatch ? cleanHTML(descMatch[1]).substring(0, 300) : '';

            // Определяем важность
            const severity = detectTASSSeverity(title + ' ' + description);

            items.push({
                id: `tass-${Date.now()}-${items.length}`,
                title: title,
                description: description,
                url: link,
                date: new Date(pubDate).toISOString(),
                source: 'ТАСС',
                category: category,
                severity: severity,
                status: 'active'
            });
        }

        return items;
    } catch (e) {
        console.warn(`[TASS] Не удалось получить ленту ${category}:`, e.message);
        return [];
    }
}

// ============================================================
// 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function cleanHTML(text) {
    if (!text) return '';
    return text.replace(/<[^>]*>/g, '').trim();
}

function detectTASSSeverity(text) {
    if (!text) return SEVERITY.NORMAL;

    const lower = text.toLowerCase();

    // Критические события
    const criticalKeywords = ['война', 'теракт', 'взрыв', 'катастрофа', 'чрезвычайное', 'кризис', 'санкции'];
    for (const word of criticalKeywords) {
        if (lower.includes(word)) return SEVERITY.CRITICAL;
    }

    // Высокая важность
    const highKeywords = ['президент', 'закон', 'реформа', 'переговоры', 'саммит', 'крупный'];
    for (const word of highKeywords) {
        if (lower.includes(word)) return SEVERITY.HIGH;
    }

    // Средняя важность
    const mediumKeywords = ['экономика', 'рынок', 'инвестиции', 'развитие', 'программа'];
    for (const word of mediumKeywords) {
        if (lower.includes(word)) return SEVERITY.MEDIUM;
    }

    return SEVERITY.NORMAL;
}

// ============================================================
// 5. СТАТИСТИКА
// ============================================================

function getTASSSummary(data) {
    const summary = {
        total: data.length,
        byCategory: {},
        bySeverity: {},
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
    };

    for (const d of data) {
        const category = d.category || 'Unknown';
        summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;

        const severity = d.severity || 'normal';
        summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;
        if (severity === 'critical') summary.criticalCount++;
        if (severity === 'high') summary.highCount++;
        if (severity === 'medium') summary.mediumCount++;
        if (severity === 'low') summary.lowCount++;
    }

    return summary;
}

// ============================================================
// 6. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectTASSAlerts(data) {
    const alerts = [];

    // 1. Критические новости
    const critical = data.filter(d => d.severity === SEVERITY.CRITICAL);
    if (critical.length > 0) {
        alerts.push({
            type: 'critical_news',
            severity: SEVERITY.CRITICAL,
            count: critical.length,
            description: `${critical.length} критических новостей`,
            examples: critical.slice(0, 3).map(d => d.title).join(', ')
        });
    }

    // 2. Новости за последние 24 часа
    const now = new Date();
    const recent = data.filter(d => {
        const date = new Date(d.date);
        return (now - date) < 24 * 60 * 60 * 1000;
    });

    if (recent.length > 10) {
        alerts.push({
            type: 'high_news_volume',
            severity: SEVERITY.MEDIUM,
            count: recent.length,
            description: `${recent.length} новостей за 24 часа`,
            examples: recent.slice(0, 3).map(d => d.title).join(', ')
        });
    }

    return alerts;
}

// ============================================================
// 7. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const now = new Date();
    const data = [];

    const demoNews = [
        { title: 'Путин провёл совещание по экономике', category: CATEGORIES.POLITICS, severity: SEVERITY.HIGH },
        { title: 'Курс рубля укрепился на фоне роста нефти', category: CATEGORIES.ECONOMY, severity: SEVERITY.MEDIUM },
        { title: 'США ввели новые санкции против России', category: CATEGORIES.POLITICS, severity: SEVERITY.CRITICAL },
        { title: 'Запуск нового спутника ГЛОНАСС', category: CATEGORIES.SCIENCE, severity: SEVERITY.MEDIUM },
        { title: 'Переговоры по Украине продолжаются', category: CATEGORIES.POLITICS, severity: SEVERITY.HIGH },
        { title: 'Рост ВВП России составил 3.2%', category: CATEGORIES.ECONOMY, severity: SEVERITY.MEDIUM },
        { title: 'Крупный пожар в промышленной зоне', category: CATEGORIES.MAIN, severity: SEVERITY.CRITICAL },
        { title: 'Саммит БРИКС в Казани', category: CATEGORIES.POLITICS, severity: SEVERITY.HIGH },
        { title: 'Новые правила экспорта газа', category: CATEGORIES.ECONOMY, severity: SEVERITY.MEDIUM },
        { title: 'Рекордный урожай зерна в 2026 году', category: CATEGORIES.MAIN, severity: SEVERITY.LOW }
    ];

    for (let i = 0; i < demoNews.length; i++) {
        const news = demoNews[i];
        const date = new Date(now);
        date.setHours(date.getHours() - i * 2);

        data.push({
            id: `demo-${i}`,
            title: news.title,
            description: 'Демонстрационная новость от ТАСС. Подробности уточняются.',
            url: '#',
            date: date.toISOString(),
            source: 'ТАСС (DEMO)',
            category: news.category,
            severity: news.severity,
            status: 'active'
        });
    }

    // Добавляем свежую новость
    data.unshift({
        id: 'demo-recent',
        title: 'ТАСС: Ключевые события дня в России и мире',
        description: 'Обзор главных новостей за последние часы.',
        url: '#',
        date: new Date().toISOString(),
        source: 'ТАСС (DEMO)',
        category: CATEGORIES.MAIN,
        severity: SEVERITY.NORMAL,
        status: 'active'
    });

    const summary = getTASSSummary(data);
    const alerts = detectTASSAlerts(data);

    console.log(`[TASS] Сгенерировано ${data.length} демо-записей`);

    return {
        success: true,
        count: data.length,
        data: data,
        summary: summary,
        alerts: alerts,
        source: 'ТАСС (DEMO)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// 8. API-ОБРАБОТЧИК
// ============================================================

export async function handleTASSAPI(req, res) {
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
        // GET /api/tass/news — получить новости ТАСС
        if (path === '/api/tass/news' && req.method === 'GET') {
            const params = url.searchParams;
            const category = params.get('category') || null;
            const limit = parseInt(params.get('limit')) || 50;

            const data = await fetchTASSNews({ category, limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/tass/status — статус модуля
        if (path === '/api/tass/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'TASS',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[TASS API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 9. ЭКСПОРТ
// ============================================================

export default {
    fetchTASSNews,
    handleTASSAPI,
    getTASSSummary,
    detectTASSAlerts
};