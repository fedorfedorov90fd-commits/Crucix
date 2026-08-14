#!/usr/bin/env node

// ============================================================
// SPACE — КОСМИЧЕСКИЙ МОНИТОРИНГ
// ============================================================
// Источник: CelesTrak / Space-Track
// Данные: спутники, космические объекты, запуски, МКС
// Версия: 2.0 (профессиональная, единый стиль)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

const CELESTRAK_API = 'https://celestrak.com/NORAD/elements/gp.php';
const SPACE_API = 'https://api.space-track.org';
const ISS_API = 'https://api.wheretheiss.at/v1/satellites/25544';

// Категории спутников
const SATELLITE_CATEGORIES = {
    STARLINK: 'Starlink',
    ONEWEB: 'OneWeb',
    MILITARY: 'Military',
    ISS: 'ISS',
    WEATHER: 'Weather',
    COMMUNICATION: 'Communication',
    NAVIGATION: 'Navigation',
    SCIENTIFIC: 'Scientific',
    OTHER: 'Other'
};

// Уровни опасности
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

export async function fetchSpaceData(options = {}) {
    const {
        category = null,
        country = null,
        limit = 100
    } = options;

    try {
        console.log('[Space] Запрос данных о космических объектах...');

        // Получаем данные из разных источников
        let satellites = [];
        let launches = [];
        let iss = null;

        try {
            satellites = await fetchSatellites();
        } catch (e) {
            console.warn('[Space] Ошибка при получении спутников:', e.message);
        }

        try {
            launches = await fetchLaunches();
        } catch (e) {
            console.warn('[Space] Ошибка при получении запусков:', e.message);
        }

        try {
            iss = await fetchISS();
        } catch (e) {
            console.warn('[Space] Ошибка при получении МКС:', e.message);
        }

        // Если данных нет — используем демо
        if (satellites.length === 0) {
            console.log('[Space] Реальные данные недоступны, использую демо-данные');
            return getDemoData();
        }

        // Фильтр по категории
        if (category) {
            satellites = satellites.filter(s =>
                s.type?.toLowerCase().includes(category.toLowerCase())
            );
        }

        // Фильтр по стране
        if (country) {
            satellites = satellites.filter(s =>
                s.country?.toLowerCase().includes(country.toLowerCase())
            );
        }

        // Сортируем по дате запуска (новые сверху)
        satellites.sort((a, b) => {
            if (!a.launchDate) return 1;
            if (!b.launchDate) return -1;
            return new Date(b.launchDate) - new Date(a.launchDate);
        });

        // Статистика
        const summary = getSpaceSummary(satellites, launches);
        const anomalies = detectSpaceAnomalies(satellites, launches);

        console.log(`[Space] Найдено ${satellites.length} спутников`);

        return {
            success: true,
            count: satellites.length,
            data: satellites.slice(0, limit),
            launches: launches,
            iss: iss,
            summary: summary,
            anomalies: anomalies,
            source: 'CelesTrak + Space-Track',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[Space] Ошибка:', error.message);
        console.warn('[Space] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ СПУТНИКОВ
// ============================================================

async function fetchSatellites() {
    try {
        const url = `${CELESTRAK_API}?GROUP=active&FORMAT=json`;
        const response = await fetchWithRetry(url, { timeout: 15000 });
        const text = await response.text();

        if (!text.trim().startsWith('[')) {
            console.warn('[Space] API вернул не JSON, пропускаем');
            return [];
        }

        const data = JSON.parse(text);

        if (data && data.length > 0) {
            return data.map(s => ({
                id: s.NORAD_CAT_ID || `sat-${Date.now()}`,
                name: s.OBJECT_NAME || 'Unknown',
                type: detectSatelliteType(s.OBJECT_NAME),
                noradId: s.NORAD_CAT_ID || null,
                country: s.COUNTRY_CODE || 'Unknown',
                launchDate: s.LAUNCH_DATE || null,
                decayDate: s.DECAY_DATE || null,
                period: parseFloat(s.PERIOD) || null,
                inclination: parseFloat(s.INCLINATION) || null,
                apogee: parseFloat(s.APOGEE) || null,
                perigee: parseFloat(s.PERIGEE) || null,
                status: s.DECAY_DATE ? 'decayed' : 'active'
            }));
        }
        return [];
    } catch (e) {
        console.warn('[Space] Не удалось получить данные спутников:', e.message);
        return [];
    }
}

// ============================================================
// 4. ПОЛУЧЕНИЕ ЗАПУСКОВ
// ============================================================

async function fetchLaunches() {
    try {
        const url = `${SPACE_API}/api/launch?limit=10&sort=date`;
        const response = await fetchWithRetry(url, { timeout: 10000 });
        const text = await response.text();

        if (!text.trim().startsWith('[')) {
            console.warn('[Space] API запусков вернул не JSON, пропускаем');
            return [];
        }

        const data = JSON.parse(text);

        if (data && data.length > 0) {
            return data.map(l => ({
                id: l.id || `launch-${Date.now()}`,
                name: l.name || 'Unknown',
                date: l.date || new Date().toISOString(),
                rocket: l.rocket?.name || 'Unknown',
                success: l.success !== undefined ? l.success : true,
                payloads: l.payloads || []
            }));
        }
        return [];
    } catch (e) {
        console.warn('[Space] Не удалось получить данные о запусках:', e.message);
        return [];
    }
}

// ============================================================
// 5. ПОЛУЧЕНИЕ ПОЗИЦИИ МКС
// ============================================================

async function fetchISS() {
    try {
        const response = await fetchWithRetry(ISS_API, { timeout: 5000 });
        const data = await response.json();

        return {
            name: 'ISS (МКС)',
            lat: data.latitude || 0,
            lng: data.longitude || 0,
            altitude: data.altitude || 408,
            velocity: data.velocity || 7.66,
            timestamp: data.timestamp || new Date().toISOString()
        };
    } catch (e) {
        console.warn('[Space] Не удалось получить позицию МКС:', e.message);
        return {
            name: 'ISS (МКС)',
            lat: 0,
            lng: 0,
            altitude: 408,
            velocity: 7.66,
            timestamp: new Date().toISOString()
        };
    }
}

// ============================================================
// 6. ОПРЕДЕЛЕНИЕ ТИПА СПУТНИКА
// ============================================================

function detectSatelliteType(name) {
    if (!name) return SATELLITE_CATEGORIES.OTHER;

    const upper = name.toUpperCase();
    if (upper.includes('STARLINK')) return SATELLITE_CATEGORIES.STARLINK;
    if (upper.includes('ONEWEB')) return SATELLITE_CATEGORIES.ONEWEB;
    if (upper.includes('ISS') || upper.includes('ZVEZDA')) return SATELLITE_CATEGORIES.ISS;
    if (upper.includes('MILITARY') || upper.includes('USA') || upper.includes('NROL')) return SATELLITE_CATEGORIES.MILITARY;
    if (upper.includes('GOES') || upper.includes('NOAA')) return SATELLITE_CATEGORIES.WEATHER;
    if (upper.includes('GPS') || upper.includes('GLONASS')) return SATELLITE_CATEGORIES.NAVIGATION;
    if (upper.includes('HUBBLE') || upper.includes('JAMES')) return SATELLITE_CATEGORIES.SCIENTIFIC;
    if (upper.includes('INTELSAT') || upper.includes('SES')) return SATELLITE_CATEGORIES.COMMUNICATION;

    return SATELLITE_CATEGORIES.OTHER;
}

// ============================================================
// 7. СТАТИСТИКА
// ============================================================

function getSpaceSummary(satellites, launches) {
    const summary = {
        total: satellites.length,
        active: satellites.filter(s => s.status === 'active').length,
        byType: {},
        byCountry: {},
        launchesLast30Days: 0,
        starlinkCount: 0,
        onewebCount: 0,
        militaryCount: 0
    };

    for (const s of satellites) {
        const type = s.type || 'Unknown';
        summary.byType[type] = (summary.byType[type] || 0) + 1;

        if (type === SATELLITE_CATEGORIES.STARLINK) summary.starlinkCount++;
        if (type === SATELLITE_CATEGORIES.ONEWEB) summary.onewebCount++;
        if (type === SATELLITE_CATEGORIES.MILITARY) summary.militaryCount++;

        const country = s.country || 'Unknown';
        summary.byCountry[country] = (summary.byCountry[country] || 0) + 1;
    }

    const now = new Date();
    for (const l of launches) {
        const date = new Date(l.date);
        if ((now - date) < 30 * 24 * 60 * 60 * 1000) {
            summary.launchesLast30Days++;
        }
    }

    return summary;
}

// ============================================================
// 8. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectSpaceAnomalies(satellites, launches) {
    const anomalies = [];

    // 1. Много новых запусков за 30 дней
    const now = new Date();
    const recentLaunches = launches.filter(l => {
        const date = new Date(l.date);
        return (now - date) < 30 * 24 * 60 * 60 * 1000;
    });

    if (recentLaunches.length > 10) {
        anomalies.push({
            type: 'high_launch_rate',
            severity: SEVERITY.HIGH,
            count: recentLaunches.length,
            description: `${recentLaunches.length} запусков за 30 дней`,
            examples: recentLaunches.slice(0, 3).map(l => l.name).join(', ')
        });
    }

    // 2. Много военных спутников
    const military = satellites.filter(s => s.type === SATELLITE_CATEGORIES.MILITARY);
    if (military.length > 50) {
        anomalies.push({
            type: 'military_buildup',
            severity: SEVERITY.MEDIUM,
            count: military.length,
            description: `${military.length} военных спутников на орбите`
        });
    }

    // 3. Starlink доминирование
    const starlink = satellites.filter(s => s.type === SATELLITE_CATEGORIES.STARLINK);
    if (starlink.length > satellites.length * 0.4) {
        anomalies.push({
            type: 'starlink_dominance',
            severity: SEVERITY.LOW,
            count: starlink.length,
            description: `Starlink составляет ${Math.round(starlink.length / satellites.length * 100)}% всех спутников`
        });
    }

    return anomalies;
}

// ============================================================
// 9. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const now = new Date();
    const satellites = [];
    const launches = [];

    // Генерируем спутники
    const types = [
        SATELLITE_CATEGORIES.STARLINK,
        SATELLITE_CATEGORIES.STARLINK,
        SATELLITE_CATEGORIES.STARLINK,
        SATELLITE_CATEGORIES.ONEWEB,
        SATELLITE_CATEGORIES.MILITARY,
        SATELLITE_CATEGORIES.COMMUNICATION,
        SATELLITE_CATEGORIES.NAVIGATION,
        SATELLITE_CATEGORIES.WEATHER,
        SATELLITE_CATEGORIES.SCIENTIFIC,
        SATELLITE_CATEGORIES.ISS
    ];

    const countries = ['US', 'CN', 'RU', 'IN', 'JP', 'EU', 'UK', 'FR', 'DE', 'CA'];

    for (let i = 0; i < 30; i++) {
        const type = types[i % types.length];
        const country = countries[i % countries.length];
        const launchDate = new Date(now);
        launchDate.setDate(launchDate.getDate() - i * 30);

        satellites.push({
            id: `sat-${i}`,
            name: `${type}-${i}`,
            type: type,
            noradId: 10000 + i,
            country: country,
            launchDate: launchDate.toISOString().slice(0, 10),
            decayDate: null,
            period: 90 + Math.random() * 30,
            inclination: 20 + Math.random() * 70,
            apogee: 400 + Math.random() * 1000,
            perigee: 300 + Math.random() * 500,
            status: 'active'
        });
    }

    // Добавляем МКС
    satellites.push({
        id: 'iss-25544',
        name: 'ISS (МКС)',
        type: SATELLITE_CATEGORIES.ISS,
        noradId: 25544,
        country: 'International',
        launchDate: '1998-11-20',
        decayDate: null,
        period: 92.68,
        inclination: 51.64,
        apogee: 408,
        perigee: 401,
        status: 'active'
    });

    // Запуски
    const launchNames = ['Falcon 9 Starlink 6-1', 'Ariane 5 VA-260', 'Atlas V NROL-107', 'Long March 2D', 'Soyuz-2.1a'];
    for (let i = 0; i < 5; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i * 7);
        launches.push({
            id: `launch-${i}`,
            name: launchNames[i],
            date: date.toISOString(),
            rocket: ['Falcon 9', 'Ariane 5', 'Atlas V', 'Long March 2D', 'Soyuz-2.1a'][i],
            success: true,
            payloads: [`Payload-${i}`]
        });
    }

    const summary = getSpaceSummary(satellites, launches);
    const anomalies = detectSpaceAnomalies(satellites, launches);

    console.log(`[Space] Сгенерировано ${satellites.length} демо-спутников`);

    return {
        success: true,
        count: satellites.length,
        data: satellites,
        launches: launches,
        iss: {
            name: 'ISS (МКС)',
            lat: 45.0,
            lng: -45.0,
            altitude: 408,
            velocity: 7.66,
            timestamp: new Date().toISOString()
        },
        summary: summary,
        anomalies: anomalies,
        source: 'CelesTrak + Space-Track (DEMO)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// 10. API-ОБРАБОТЧИК
// ============================================================

export async function handleSpaceAPI(req, res) {
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
        // GET /api/space/data — получить космические данные
        if (path === '/api/space/data' && req.method === 'GET') {
            const params = url.searchParams;
            const category = params.get('category') || null;
            const country = params.get('country') || null;
            const limit = parseInt(params.get('limit')) || 100;

            const data = await fetchSpaceData({ category, country, limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/space/iss — получить позицию МКС
        if (path === '/api/space/iss' && req.method === 'GET') {
            const iss = await fetchISS();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                iss: iss,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // GET /api/space/status — статус модуля
        if (path === '/api/space/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'Space',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Space API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 11. ЭКСПОРТ
// ============================================================

export default {
    fetchSpaceData,
    handleSpaceAPI,
    getSpaceSummary,
    detectSpaceAnomalies
};
