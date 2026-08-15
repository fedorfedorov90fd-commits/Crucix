#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №11: МОРСКОЙ ТРЕКИНГ С ДЕТЕКТОРОМ ТЁМНЫХ СУДОВ
// ============================================================

// ============================================================
// 1. ДЕМО-ДАННЫЕ
// ============================================================

const DEMO_VESSELS = [
    // Нормальные суда (с AIS)
    {
        id: 'vsl-001',
        name: 'EVER GIVEN',
        type: 'cargo',
        status: 'normal',
        mmsi: '353136000',
        flag: 'Panama',
        lat: 30.5,
        lng: 32.5,
        speed: 12.5,
        heading: 270,
        destination: 'Rotterdam',
        ais: true,
        lastAIS: new Date().toISOString(),
        timestamp: new Date().toISOString()
    },
    {
        id: 'vsl-002',
        name: 'MSC OSCAR',
        type: 'container',
        status: 'normal',
        mmsi: '255806000',
        flag: 'Portugal',
        lat: 36.0,
        lng: -5.0,
        speed: 18.2,
        heading: 45,
        destination: 'Algeciras',
        ais: true,
        lastAIS: new Date().toISOString(),
        timestamp: new Date().toISOString()
    },
    {
        id: 'vsl-003',
        name: 'TANKER PRIDE',
        type: 'tanker',
        status: 'normal',
        mmsi: '311000123',
        flag: 'Bahamas',
        lat: 26.0,
        lng: 55.0,
        speed: 8.5,
        heading: 180,
        destination: 'Fujairah',
        ais: true,
        lastAIS: new Date().toISOString(),
        timestamp: new Date().toISOString()
    },
    // Тёмные суда (без AIS)
    {
        id: 'vsl-004',
        name: 'DARK SHADOW',
        type: 'unknown',
        status: 'dark',
        mmsi: '000000000',
        flag: 'Unknown',
        lat: 34.0,
        lng: 24.0,
        speed: 6.8,
        heading: 90,
        destination: 'Unknown',
        ais: false,
        lastAIS: null,
        timestamp: new Date().toISOString(),
        darkDetected: '2026-08-14T12:00:00Z'
    },
    {
        id: 'vsl-005',
        name: 'GHOST FREIGHTER',
        type: 'cargo',
        status: 'dark',
        mmsi: '000000001',
        flag: 'Unknown',
        lat: 38.0,
        lng: 22.0,
        speed: 4.2,
        heading: 135,
        destination: 'Unknown',
        ais: false,
        lastAIS: null,
        timestamp: new Date().toISOString(),
        darkDetected: '2026-08-14T10:30:00Z'
    },
    {
        id: 'vsl-006',
        name: 'STEALTH CARGO',
        type: 'cargo',
        status: 'dark',
        mmsi: '000000002',
        flag: 'Unknown',
        lat: 42.0,
        lng: 29.0,
        speed: 9.1,
        heading: 45,
        destination: 'Unknown',
        ais: false,
        lastAIS: null,
        timestamp: new Date().toISOString(),
        darkDetected: '2026-08-14T08:15:00Z'
    },
    {
        id: 'vsl-007',
        name: 'NIGHT RUNNER',
        type: 'fishing',
        status: 'dark',
        mmsi: '000000003',
        flag: 'Unknown',
        lat: 44.0,
        lng: 31.0,
        speed: 2.5,
        heading: 270,
        destination: 'Unknown',
        ais: false,
        lastAIS: null,
        timestamp: new Date().toISOString(),
        darkDetected: '2026-08-14T06:00:00Z'
    },
    // Подозрительные суда
    {
        id: 'vsl-008',
        name: 'SUSPECT TANKER',
        type: 'tanker',
        status: 'suspicious',
        mmsi: '212345678',
        flag: 'Malta',
        lat: 32.0,
        lng: 33.5,
        speed: 3.2,
        heading: 225,
        destination: 'Unknown',
        ais: true,
        lastAIS: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        suspicious: 'Санкционный груз'
    },
    {
        id: 'vsl-009',
        name: 'BALTIC CARRIER',
        type: 'cargo',
        status: 'normal',
        mmsi: '209765432',
        flag: 'Cyprus',
        lat: 54.5,
        lng: 18.5,
        speed: 10.5,
        heading: 320,
        destination: 'Gdansk',
        ais: true,
        lastAIS: new Date().toISOString(),
        timestamp: new Date().toISOString()
    },
    {
        id: 'vsl-010',
        name: 'MEDITERRANEAN STAR',
        type: 'passenger',
        status: 'normal',
        mmsi: '247123456',
        flag: 'Italy',
        lat: 37.5,
        lng: 12.5,
        speed: 22.0,
        heading: 180,
        destination: 'Palermo',
        ais: true,
        lastAIS: new Date().toISOString(),
        timestamp: new Date().toISOString()
    },
    {
        id: 'vsl-011',
        name: 'SUSPECT CARGO',
        type: 'cargo',
        status: 'suspicious',
        mmsi: '311654321',
        flag: 'Liberia',
        lat: 40.0,
        lng: 26.0,
        speed: 5.8,
        heading: 90,
        destination: 'Unknown',
        ais: true,
        lastAIS: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        suspicious: 'Необычный маршрут'
    },
    {
        id: 'vsl-012',
        name: 'DARK FISHER',
        type: 'fishing',
        status: 'dark',
        mmsi: '000000004',
        flag: 'Unknown',
        lat: 46.0,
        lng: 30.5,
        speed: 1.2,
        heading: 150,
        destination: 'Unknown',
        ais: false,
        lastAIS: null,
        timestamp: new Date().toISOString(),
        darkDetected: '2026-08-14T04:30:00Z'
    }
];

// ============================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getDarkReason(vessel) {
    const reasons = [];
    if (!vessel.ais) reasons.push('AIS отключён');
    if (vessel.flag === 'Unknown') reasons.push('Флаг неизвестен');
    if (vessel.destination === 'Unknown') reasons.push('Пункт назначения неизвестен');
    if (vessel.speed < 2 && vessel.type !== 'fishing') reasons.push('Аномально низкая скорость');
    if (vessel.status === 'suspicious') reasons.push('Подозрительный');
    return reasons.length > 0 ? reasons.join(', ') : 'Неизвестная причина';
}

function getShippingStats(vessels) {
    const total = vessels.length;
    const normal = vessels.filter(v => v.status === 'normal').length;
    const dark = vessels.filter(v => v.status === 'dark').length;
    const suspicious = vessels.filter(v => v.status === 'suspicious').length;

    const byType = {};
    for (const v of vessels) {
        if (!byType[v.type]) byType[v.type] = 0;
        byType[v.type]++;
    }

    const byFlag = {};
    for (const v of vessels) {
        if (!byFlag[v.flag]) byFlag[v.flag] = 0;
        byFlag[v.flag]++;
    }

    return {
        total,
        normal,
        dark,
        suspicious,
        byType,
        byFlag,
        darkPercentage: total > 0 ? Math.round((dark / total) * 100) : 0,
        timestamp: new Date().toISOString()
    };
}

function getHotspots(vessels) {
    return [
        {
            id: 'hotspot-001',
            name: 'Суэцкий канал',
            lat: 30.0,
            lng: 32.5,
            count: vessels.filter(v => v.lat > 29 && v.lat < 31 && v.lng > 32 && v.lng < 33).length,
            severity: 'high'
        },
        {
            id: 'hotspot-002',
            name: 'Босфор',
            lat: 41.1,
            lng: 29.0,
            count: vessels.filter(v => v.lat > 40.5 && v.lat < 41.5 && v.lng > 28.5 && v.lng < 29.5).length,
            severity: 'medium'
        },
        {
            id: 'hotspot-003',
            name: 'Ормузский пролив',
            lat: 26.5,
            lng: 56.0,
            count: vessels.filter(v => v.lat > 26 && v.lat < 27 && v.lng > 55 && v.lng < 57).length,
            severity: 'critical'
        },
        {
            id: 'hotspot-004',
            name: 'Чёрное море',
            lat: 44.0,
            lng: 30.0,
            count: vessels.filter(v => v.lat > 43 && v.lat < 45 && v.lng > 28 && v.lng < 32).length,
            severity: 'high'
        },
        {
            id: 'hotspot-005',
            name: 'Гибралтарский пролив',
            lat: 36.0,
            lng: -5.0,
            count: vessels.filter(v => v.lat > 35.5 && v.lat < 36.5 && v.lng > -6 && v.lng < -4).length,
            severity: 'medium'
        }
    ];
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleShippingAPI(req, res) {
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
        const vessels = DEMO_VESSELS.map(v => ({
            ...v,
            timestamp: new Date().toISOString()
        }));

        const darkVessels = vessels.filter(v => v.status === 'dark' || !v.ais);
        const stats = getShippingStats(vessels);
        const hotspots = getHotspots(vessels);

        // --- GET /api/shipping/status ---
        if (path === '/api/shipping/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                status: 'online',
                version: '1.0',
                sources: ['AIS (demo)', 'Satellite (demo)'],
                totalVessels: vessels.length,
                darkVessels: darkVessels.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/shipping/vessels ---
        if (path === '/api/shipping/vessels') {
            const params = new URLSearchParams(url.search);
            const type = params.get('type');
            const status = params.get('status');
            let filtered = vessels;

            if (type && type !== 'all') {
                filtered = filtered.filter(v => v.type === type);
            }
            if (status && status !== 'all') {
                filtered = filtered.filter(v => v.status === status);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: filtered.length,
                vessels: filtered,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/shipping/vessel/:id ---
        if (path.startsWith('/api/shipping/vessel/')) {
            const id = path.split('/').pop();
            const vessel = vessels.find(v => v.id === id);

            if (!vessel) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Судно не найдено' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                vessel: vessel,
                darkReason: vessel.status === 'dark' ? getDarkReason(vessel) : null,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/shipping/dark ---
        if (path === '/api/shipping/dark') {
            const darkWithReasons = darkVessels.map(v => ({
                ...v,
                darkReason: getDarkReason(v)
            }));

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: darkWithReasons.length,
                vessels: darkWithReasons,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/shipping/hotspots ---
        if (path === '/api/shipping/hotspots') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                hotspots: hotspots,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/shipping/stats ---
        if (path === '/api/shipping/stats') {
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
        console.error('[Shipping API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleShippingAPI };
