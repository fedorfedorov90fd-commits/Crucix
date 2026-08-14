#!/usr/bin/env node

// ============================================================
// NOAA — МОНИТОРИНГ ПОГОДЫ И ОКЕАНА
// ============================================================
// Источник: National Oceanic and Atmospheric Administration
// Данные: погода, штормы, ураганы, океан
// Версия: 2.0 (профессиональная, единый стиль)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// NOAA API Endpoints
const NOAA_BASE = 'https://api.weather.gov';
const NOAA_ALERTS = `${NOAA_BASE}/alerts/active`;
const NOAA_POINTS = `${NOAA_BASE}/points`;

// Уровни опасности
const SEVERITY = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
    NORMAL: 'normal'
};

// Типы погодных событий
const EVENT_TYPES = {
    HURRICANE: 'Ураган',
    TORNADO: 'Торнадо',
    STORM: 'Шторм',
    FLOOD: 'Наводнение',
    HEATWAVE: 'Жара',
    COLDWAVE: 'Холод',
    DROUGHT: 'Засуха',
    WILDFIRE: 'Лесной пожар',
    EARTHQUAKE: 'Землетрясение',
    TSUNAMI: 'Цунами',
    NORMAL: 'Норма'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchWeatherData(options = {}) {
    const {
        lat = null,
        lon = null,
        eventType = null,
        severity = null,
        limit = 50
    } = options;

    try {
        console.log('[NOAA] Запрос погодных данных...');

        // Получаем данные
        let alerts = [];
        try {
            alerts = await fetchAlerts();
        } catch (e) {
            console.warn('[NOAA] Ошибка при получении алертов:', e.message);
        }

        // Если данных нет — используем демо
        if (alerts.length === 0) {
            console.log('[NOAA] Реальные данные недоступны, использую демо-данные');
            return getDemoData();
        }

        // Фильтр по типу события
        if (eventType) {
            alerts = alerts.filter(d =>
                d.eventType?.toLowerCase().includes(eventType.toLowerCase()) ||
                d.title?.toLowerCase().includes(eventType.toLowerCase())
            );
        }

        // Фильтр по уровню опасности
        if (severity) {
            alerts = alerts.filter(d => d.severity === severity);
        }

        // Сортируем по дате (новые сверху)
        alerts.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Статистика
        const summary = getWeatherSummary(alerts);
        const weatherAlerts = detectWeatherAlerts(alerts);

        console.log(`[NOAA] Получено ${alerts.length} записей`);

        return {
            success: true,
            count: alerts.length,
            data: alerts.slice(0, limit),
            summary: summary,
            alerts: weatherAlerts,
            source: 'NOAA (National Oceanic and Atmospheric Administration)',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[NOAA] Ошибка:', error.message);
        console.warn('[NOAA] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ АКТИВНЫХ АЛЕРТОВ
// ============================================================

async function fetchAlerts() {
    try {
        const response = await fetchWithRetry(NOAA_ALERTS, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Crucix/2.0 (https://crucix.live)',
                'Accept': 'application/geo+json'
            }
        });

        const text = await response.text();

        // Проверяем, что это JSON
        if (!text.trim().startsWith('{')) {
            console.warn('[NOAA] API вернул не JSON, пропускаем');
            return [];
        }

        const data = JSON.parse(text);

        if (data && data.features) {
            return data.features.map(feature => {
                const props = feature.properties || {};
                const geometry = feature.geometry || {};
                const coordinates = geometry.coordinates || [];

                return {
                    id: props.id || `noaa-${Date.now()}`,
                    title: props.headline || props.event || 'Погодное событие',
                    description: props.description || props.instruction || 'Нет описания',
                    eventType: detectEventType(props),
                    severity: detectSeverity(props),
                    location: props.areaDesc || 'Unknown',
                    lat: coordinates[1] || null,
                    lon: coordinates[0] || null,
                    date: props.sent || props.effective || new Date().toISOString(),
                    expires: props.expires || null,
                    source: 'NOAA',
                    url: props.id || '',
                    status: props.status || 'active',
                    category: props.category || 'Met'
                };
            });
        }
        return [];
    } catch (e) {
        console.warn('[NOAA] Не удалось получить алерты:', e.message);
        return [];
    }
}

// ============================================================
// 4. ОПРЕДЕЛЕНИЕ ТИПА СОБЫТИЯ
// ============================================================

function detectEventType(props) {
    if (!props) return EVENT_TYPES.NORMAL;

    const event = (props.event || '').toLowerCase();
    const headline = (props.headline || '').toLowerCase();
    const text = event + ' ' + headline;

    if (text.includes('hurricane') || text.includes('typhoon')) return EVENT_TYPES.HURRICANE;
    if (text.includes('tornado')) return EVENT_TYPES.TORNADO;
    if (text.includes('storm') || text.includes('thunderstorm')) return EVENT_TYPES.STORM;
    if (text.includes('flood') || text.includes('flash flood')) return EVENT_TYPES.FLOOD;
    if (text.includes('heat') || text.includes('heatwave')) return EVENT_TYPES.HEATWAVE;
    if (text.includes('cold') || text.includes('freeze')) return EVENT_TYPES.COLDWAVE;
    if (text.includes('drought')) return EVENT_TYPES.DROUGHT;
    if (text.includes('fire') || text.includes('wildfire')) return EVENT_TYPES.WILDFIRE;
    if (text.includes('earthquake')) return EVENT_TYPES.EARTHQUAKE;
    if (text.includes('tsunami')) return EVENT_TYPES.TSUNAMI;

    return EVENT_TYPES.NORMAL;
}

// ============================================================
// 5. ОПРЕДЕЛЕНИЕ УРОВНЯ ОПАСНОСТИ
// ============================================================

function detectSeverity(props) {
    if (!props) return SEVERITY.NORMAL;

    const severity = (props.severity || '').toLowerCase();
    const urgency = (props.urgency || '').toLowerCase();
    const event = (props.event || '').toLowerCase();

    // Критические события
    const criticalEvents = ['hurricane', 'typhoon', 'tornado', 'tsunami', 'flash flood', 'extreme'];
    for (const word of criticalEvents) {
        if (event.includes(word) || severity === 'extreme') {
            return SEVERITY.CRITICAL;
        }
    }

    // Высокий уровень
    const highEvents = ['storm', 'flood', 'heatwave', 'coldwave', 'wildfire', 'severe'];
    for (const word of highEvents) {
        if (event.includes(word) || severity === 'severe') {
            return SEVERITY.HIGH;
        }
    }

    // Средний уровень
    if (severity === 'moderate' || urgency === 'expected') {
        return SEVERITY.MEDIUM;
    }

    return SEVERITY.NORMAL;
}

// ============================================================
// 6. СТАТИСТИКА
// ============================================================

function getWeatherSummary(data) {
    const summary = {
        total: data.length,
        byEventType: {},
        bySeverity: {},
        byLocation: {},
        active: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
    };

    for (const d of data) {
        const type = d.eventType || 'Unknown';
        summary.byEventType[type] = (summary.byEventType[type] || 0) + 1;

        const sev = d.severity || 'normal';
        summary.bySeverity[sev] = (summary.bySeverity[sev] || 0) + 1;
        if (sev === 'critical') summary.criticalCount++;
        if (sev === 'high') summary.highCount++;
        if (sev === 'medium') summary.mediumCount++;
        if (sev === 'low') summary.lowCount++;

        const location = d.location || 'Unknown';
        summary.byLocation[location] = (summary.byLocation[location] || 0) + 1;

        if (d.status === 'active') summary.active++;
    }

    return summary;
}

// ============================================================
// 7. ДЕТЕКТОР ОПАСНЫХ СОБЫТИЙ
// ============================================================

function detectWeatherAlerts(data) {
    const alerts = [];

    // 1. Критические события
    const critical = data.filter(d => d.severity === SEVERITY.CRITICAL);
    if (critical.length > 0) {
        alerts.push({
            type: 'critical_weather',
            severity: 'critical',
            count: critical.length,
            description: `Обнаружено ${critical.length} критических погодных событий`,
            examples: critical.slice(0, 3).map(d => d.title).join(', ')
        });
    }

    // 2. Ураганы и штормы
    const hurricanes = data.filter(d =>
        d.eventType === EVENT_TYPES.HURRICANE ||
        d.eventType === EVENT_TYPES.TORNADO
    );
    if (hurricanes.length > 0) {
        alerts.push({
            type: 'hurricane_activity',
            severity: 'high',
            count: hurricanes.length,
            description: `${hurricanes.length} активных ураганов/торнадо`,
            examples: hurricanes.slice(0, 3).map(d => d.title).join(', ')
        });
    }

    // 3. Новые события за последние 24 часа
    const now = new Date();
    const recent = data.filter(d => {
        const date = new Date(d.date);
        return (now - date) < 24 * 60 * 60 * 1000;
    });

    if (recent.length > 5) {
        alerts.push({
            type: 'recent_weather',
            severity: recent.length > 10 ? 'high' : 'medium',
            count: recent.length,
            description: `${recent.length} новых событий за 24 часа`,
            examples: recent.slice(0, 3).map(d => d.title).join(', ')
        });
    }

    return alerts;
}

// ============================================================
// 8. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const now = new Date();
    const data = [];

    const events = [
        { title: 'Ураган Milton в Атлантике', type: EVENT_TYPES.HURRICANE, severity: SEVERITY.CRITICAL, location: 'Атлантический океан' },
        { title: 'Торнадо в Оклахоме', type: EVENT_TYPES.TORNADO, severity: SEVERITY.CRITICAL, location: 'Оклахома, США' },
        { title: 'Шторм в Северном море', type: EVENT_TYPES.STORM, severity: SEVERITY.HIGH, location: 'Северное море' },
        { title: 'Наводнение в Пакистане', type: EVENT_TYPES.FLOOD, severity: SEVERITY.HIGH, location: 'Пакистан' },
        { title: 'Жара в Европе', type: EVENT_TYPES.HEATWAVE, severity: SEVERITY.MEDIUM, location: 'Европа' },
        { title: 'Лесные пожары в Калифорнии', type: EVENT_TYPES.WILDFIRE, severity: SEVERITY.HIGH, location: 'Калифорния, США' },
        { title: 'Землетрясение в Японии', type: EVENT_TYPES.EARTHQUAKE, severity: SEVERITY.HIGH, location: 'Япония' },
        { title: 'Цунами в Тихом океане', type: EVENT_TYPES.TSUNAMI, severity: SEVERITY.CRITICAL, location: 'Тихий океан' },
        { title: 'Засуха в Африке', type: EVENT_TYPES.DROUGHT, severity: SEVERITY.MEDIUM, location: 'Африка' },
        { title: 'Холодная волна в Канаде', type: EVENT_TYPES.COLDWAVE, severity: SEVERITY.MEDIUM, location: 'Канада' }
    ];

    for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const date = new Date(now);
        date.setHours(date.getHours() - i * 6);

        data.push({
            id: `demo-${i}`,
            title: e.title,
            description: `${e.type} в регионе ${e.location}. Рекомендуется мониторинг.`,
            eventType: e.type,
            severity: e.severity,
            location: e.location,
            lat: 0,
            lon: 0,
            date: date.toISOString(),
            expires: new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString(),
            source: 'NOAA (DEMO)',
            url: '#',
            status: 'active',
            category: 'Met'
        });
    }

    // Добавляем свежее событие
    data.unshift({
        id: 'demo-recent',
        title: 'Тропический шторм в Карибском море',
        description: 'Тропический шторм формируется в Карибском море. Ожидается усиление.',
        eventType: EVENT_TYPES.STORM,
        severity: SEVERITY.HIGH,
        location: 'Карибское море',
        lat: 18.0,
        lon: -75.0,
        date: new Date().toISOString(),
        expires: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        source: 'NOAA (DEMO)',
        url: '#',
        status: 'active',
        category: 'Met'
    });

    const summary = getWeatherSummary(data);
    const alerts = detectWeatherAlerts(data);

    console.log(`[NOAA] Сгенерировано ${data.length} демо-записей`);

    return {
        success: true,
        count: data.length,
        data: data,
        summary: summary,
        alerts: alerts,
        source: 'NOAA (DEMO)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// 9. API-ОБРАБОТЧИК
// ============================================================

export async function handleNOAAAPI(req, res) {
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
        // GET /api/noaa/data — получить погодные данные
        if (path === '/api/noaa/data' && req.method === 'GET') {
            const params = url.searchParams;
            const lat = params.get('lat') ? parseFloat(params.get('lat')) : null;
            const lon = params.get('lon') ? parseFloat(params.get('lon')) : null;
            const eventType = params.get('eventType') || null;
            const severity = params.get('severity') || null;
            const limit = parseInt(params.get('limit')) || 50;

            const data = await fetchWeatherData({ lat, lon, eventType, severity, limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/noaa/status — статус модуля
        if (path === '/api/noaa/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'NOAA',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[NOAA API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 10. ЭКСПОРТ
// ============================================================

export default {
    fetchWeatherData,
    handleNOAAAPI,
    getWeatherSummary,
    detectWeatherAlerts
};
