#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №18: ДЕТЕКТОР ИНФОРМАЦИОННОЙ ТИШИНЫ
// ============================================================

// ============================================================
// 1. ДАННЫЕ
// ============================================================

const REGIONS = [
    { id: 'europe', name: 'Европа', lat: 50.0, lng: 10.0 },
    { id: 'asia', name: 'Азия', lat: 40.0, lng: 100.0 },
    { id: 'north-america', name: 'Северная Америка', lat: 45.0, lng: -100.0 },
    { id: 'south-america', name: 'Южная Америка', lat: -15.0, lng: -60.0 },
    { id: 'africa', name: 'Африка', lat: 0.0, lng: 20.0 },
    { id: 'middle-east', name: 'Ближний Восток', lat: 28.0, lng: 45.0 },
    { id: 'asia-pacific', name: 'Азиатско-Тихоокеанский', lat: -10.0, lng: 140.0 },
    { id: 'ukraine', name: 'Украина', lat: 48.0, lng: 31.0 },
    { id: 'russia', name: 'Россия', lat: 60.0, lng: 90.0 },
    { id: 'middle-east-conflict', name: 'Зона конфликта БВ', lat: 32.0, lng: 40.0 }
];

const DEFAULT_ACTIVITY = {
    news: 65,
    satellite: 45,
    aviation: 30,
    shipping: 25,
    cyber: 15,
    total: 180
};

// ============================================================
// 2. ГЕНЕРАЦИЯ ДАННЫХ
// ============================================================

function generateActivity(regionId) {
    // Симуляция активности на основе региона
    const base = {
        news: Math.floor(Math.random() * 80) + 10,
        satellite: Math.floor(Math.random() * 60) + 5,
        aviation: Math.floor(Math.random() * 50) + 5,
        shipping: Math.floor(Math.random() * 40) + 5,
        cyber: Math.floor(Math.random() * 30) + 2
    };

    // Корректировка для некоторых регионов
    if (regionId === 'ukraine' || regionId === 'middle-east-conflict') {
        base.news += 30;
        base.satellite += 20;
        base.aviation += 25;
    }
    if (regionId === 'asia-pacific') {
        base.shipping += 25;
        base.cyber += 15;
    }
    if (regionId === 'africa') {
        base.news = Math.floor(Math.random() * 30) + 5;
        base.satellite = Math.floor(Math.random() * 20) + 2;
    }

    base.total = base.news + base.satellite + base.aviation + base.shipping + base.cyber;

    return base;
}

function detectSilence(activity) {
    const total = activity.total;
    const types = [];

    if (activity.news < 15) types.push('news');
    if (activity.satellite < 10) types.push('satellite');
    if (activity.aviation < 10) types.push('aviation');
    if (activity.shipping < 8) types.push('shipping');
    if (activity.cyber < 5) types.push('cyber');

    let severity = 'none';
    let label = 'Активно';
    let emoji = '🟢';

    if (total < 30) {
        severity = 'critical';
        label = 'Полная тишина';
        emoji = '🔴';
    } else if (total < 50) {
        severity = 'high';
        label = 'Информационный вакуум';
        emoji = '🟠';
    } else if (total < 80) {
        severity = 'medium';
        label = 'Пониженная активность';
        emoji = '🟡';
    } else if (total < 120) {
        severity = 'low';
        label = 'Нормальная активность';
        emoji = '🟢';
    }

    return {
        severity,
        label,
        emoji,
        types,
        total,
        details: activity
    };
}

function getHistory(regionId) {
    const history = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(date.getHours() - i);
        const activity = generateActivity(regionId);
        history.push({
            time: date.toISOString(),
            total: activity.total,
            news: activity.news,
            satellite: activity.satellite,
            aviation: activity.aviation,
            shipping: activity.shipping,
            cyber: activity.cyber
        });
    }
    return history;
}

function getAlerts() {
    return [
        {
            id: 'alert-001',
            region: 'africa',
            regionName: 'Африка',
            type: 'media_silence',
            severity: 'high',
            message: 'Аномально низкая новостная активность в регионе',
            timestamp: new Date().toISOString(),
            status: 'active'
        },
        {
            id: 'alert-002',
            region: 'south-america',
            regionName: 'Южная Америка',
            type: 'satellite_silence',
            severity: 'medium',
            message: 'Снижение спутниковых данных из Южной Америки',
            timestamp: new Date().toISOString(),
            status: 'active'
        },
        {
            id: 'alert-003',
            region: 'asia-pacific',
            regionName: 'АТР',
            type: 'shipping_silence',
            severity: 'medium',
            message: 'Снижение морской активности в регионе',
            timestamp: new Date().toISOString(),
            status: 'active'
        }
    ];
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleSilenceAPI(req, res) {
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
        // --- GET /api/silence/regions ---
        if (path === '/api/silence/regions' && req.method === 'GET') {
            const regions = REGIONS.map(r => {
                const activity = generateActivity(r.id);
                const silence = detectSilence(activity);
                return {
                    ...r,
                    activity: activity,
                    silence: silence
                };
            });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                regions: regions,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/silence/activity ---
        if (path === '/api/silence/activity' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const regionId = params.get('region');
            if (!regionId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Укажите регион' }));
                return;
            }
            const activity = generateActivity(regionId);
            const silence = detectSilence(activity);
            const region = REGIONS.find(r => r.id === regionId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                region: region || { id: regionId },
                activity: activity,
                silence: silence,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/silence/history ---
        if (path === '/api/silence/history' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const regionId = params.get('region') || 'europe';
            const history = getHistory(regionId);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                region: regionId,
                history: history,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/silence/alerts ---
        if (path === '/api/silence/alerts' && req.method === 'GET') {
            const alerts = getAlerts();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                alerts: alerts,
                count: alerts.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/silence/stats ---
        if (path === '/api/silence/stats' && req.method === 'GET') {
            const stats = {
                totalRegions: REGIONS.length,
                silentRegions: 0,
                regions: []
            };
            for (const r of REGIONS) {
                const activity = generateActivity(r.id);
                const silence = detectSilence(activity);
                stats.regions.push({
                    region: r.name,
                    severity: silence.severity,
                    total: activity.total
                });
                if (silence.severity === 'critical' || silence.severity === 'high') {
                    stats.silentRegions++;
                }
            }
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
        console.error('[Silence API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleSilenceAPI };
