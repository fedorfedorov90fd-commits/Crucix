#!/usr/bin/env node

// ============================================================
// SAFECAST — РАДИАЦИОННЫЙ МОНИТОРИНГ (ДЕМО-РЕЖИМ)
// ============================================================

export async function fetchRadiation() {
    console.log('[Safecast] Использую демо-данные (внешний API недоступен)');

    const sites = [
        { id: 'demo-1', name: 'Запорожская АЭС', lat: 47.5122, lng: 34.8347, reading: 85.3, level: 'elevated', source: 'DEMO' },
        { id: 'demo-2', name: 'Чернобыльская Зона', lat: 51.389, lng: 30.099, reading: 33.3, level: 'normal', source: 'DEMO' },
        { id: 'demo-3', name: 'Фукусима-1', lat: 37.4214, lng: 141.0325, reading: 69.5, level: 'elevated', source: 'DEMO' },
        { id: 'demo-4', name: 'АЭС Бушер', lat: 28.8309, lng: 50.8865, reading: null, level: 'unknown', source: 'DEMO' },
        { id: 'demo-5', name: 'Ёнбён (Северная Корея)', lat: 39.796, lng: 125.758, reading: null, level: 'unknown', source: 'DEMO' },
        { id: 'demo-6', name: 'Димона (Израиль)', lat: 31.0, lng: 35.0, reading: 29.5, level: 'normal', source: 'DEMO' }
    ];

    const summary = {
        total: sites.length,
        byLevel: { normal: 2, elevated: 2, critical: 0, unknown: 2 },
        average: 54.4,
        max: 85.3,
        maxSite: 'Запорожская АЭС'
    };

    const anomalies = [
        { site: 'Запорожская АЭС', reading: 85.3, description: 'Повышенный уровень радиации' }
    ];

    return {
        success: true,
        sites: sites,
        summary: summary,
        anomalies: anomalies,
        source: 'DEMO (Safecast)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// API-ОБРАБОТЧИК
// ============================================================
export async function handleSafecastApi(req, res) {
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
        if (path === '/api/safecast/radiation' && req.method === 'GET') {
            const data = await fetchRadiation();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        if (path === '/api/safecast/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'Safecast',
                status: 'demo',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Safecast API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default {
    fetchRadiation,
    handleSafecastApi
};
