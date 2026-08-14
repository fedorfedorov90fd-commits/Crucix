#!/usr/bin/env node

// ============================================================
// ACLED — КОНФЛИКТЫ И ПРОТЕСТЫ
// ============================================================
// Источник: ACLED (Armed Conflict Location & Event Data Project)
// Данные: конфликты, протесты, насилие по всему миру
// Обновление: еженедельно
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

const ACLED_API = 'https://api.acleddata.com/acled/read';

// Типы событий
const EVENT_TYPES = {
    BATTLES: 'Battles',
    EXPLOSIONS: 'Explosions/Remote violence',
    PROTESTS: 'Protests',
    RIOTS: 'Riots',
    STRATEGIC: 'Strategic developments',
    VIOLENCE: 'Violence against civilians'
};

// Уровни эскалации
const ESCALATION_LEVELS = {
    CRITICAL: { min: 50, label: '🔴 Критическая', color: '#ef4444' },
    HIGH: { min: 20, label: '🟠 Высокая', color: '#f97316' },
    MEDIUM: { min: 5, label: '🟡 Средняя', color: '#eab308' },
    LOW: { min: 0, label: '🟢 Низкая', color: '#22c55e' }
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Получить данные о конфликтах
 * 
 * @param {Object} options
 * @param {number} options.days - Количество дней (по умолчанию 30)
 * @param {string} options.country - Фильтр по стране
 * @param {string} options.region - Фильтр по региону
 * @param {number} options.limit - Максимум записей (по умолчанию 500)
 * @returns {Promise<Object>} Данные о конфликтах
 */
export async function fetchConflicts(options = {}) {
    const {
        days = 30,
        country = null,
        region = null,
        limit = 500
    } = options;

    const email = process.env.ACLED_EMAIL || '';
    const password = process.env.ACLED_PASSWORD || '';

    // Проверка авторизации
    if (!email || !password) {
        console.warn('[ACLED] API ключи не найдены. Установите ACLED_EMAIL и ACLED_PASSWORD в .env');
        return getDemoData();
    }

    try {
        const params = new URLSearchParams({
            email: email,
            password: password,
            limit: limit,
            event_date__gte: getDateString(days),
            sort: 'event_date',
            'sort_order': 'desc'
        });

        if (country) params.append('country', country);
        if (region) params.append('region', region);

        const url = `${ACLED_API}?${params}`;
        console.log(`[ACLED] Запрос данных за ${days} дней`);

        const response = await fetchWithRetry(url, { timeout: 15000 });
        const data = await response.json();

        if (!data.data || data.data.length === 0) {
            console.log('[ACLED] Событий не обнаружено');
            return {
                success: true,
                count: 0,
                events: [],
                summary: {
                    total: 0,
                    fatalities: 0,
                    byType: {},
                    byCountry: {},
                    byRegion: {}
                },
                escalation: null,
                timestamp: new Date().toISOString()
            };
        }

        // Обрабатываем данные
        const events = data.data.map(e => parseEvent(e));
        const summary = getSummary(events);
        const escalation = analyzeEscalation(events);

        console.log(`[ACLED] Найдено ${events.length} событий (${summary.fatalities} жертв)`);

        return {
            success: true,
            count: events.length,
            events: events,
            summary: summary,
            escalation: escalation,
            source: 'ACLED',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[ACLED] Ошибка:', error.message);
        console.warn('[ACLED] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ОБРАБОТКА ОДНОГО СОБЫТИЯ
// ============================================================

function parseEvent(event) {
    return {
        id: event.data_id || `acled_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        date: event.event_date || null,
        country: event.country || null,
        region: event.region || null,
        type: event.event_type || null,
        subType: event.sub_event_type || null,
        actor1: event.actor1 || null,
        actor2: event.actor2 || null,
        fatalities: parseInt(event.fatalities) || 0,
        lat: parseFloat(event.latitude) || null,
        lng: parseFloat(event.longitude) || null,
        location: event.location || null,
        description: event.notes || null,
        source: event.source || null,
        timestamp: event.timestamp || null,
        severity: getSeverity(event)
    };
}

// ============================================================
// 4. ОПРЕДЕЛЕНИЕ СЕВЕРНОСТИ
// ============================================================

function getSeverity(event) {
    const fatalities = parseInt(event.fatalities) || 0;
    const type = event.event_type || '';

    if (fatalities >= 10) return 'critical';
    if (fatalities >= 5) return 'high';
    if (fatalities >= 1) return 'medium';
    
    // Типы с высоким риском даже без жертв
    if (['Battles', 'Explosions/Remote violence'].includes(type)) return 'medium';
    if (['Violence against civilians'].includes(type)) return 'medium';
    
    return 'low';
}

// ============================================================
// 5. АНАЛИЗ ЭСКАЛАЦИИ
// ============================================================

function analyzeEscalation(events) {
    if (!events || events.length < 3) return null;

    // Разбиваем на периоды
    const now = new Date();
    const last7Days = events.filter(e => {
        const d = new Date(e.date);
        return (now - d) < 7 * 24 * 60 * 60 * 1000;
    });

    const previous7Days = events.filter(e => {
        const d = new Date(e.date);
        const diff = now - d;
        return diff >= 7 * 24 * 60 * 60 * 1000 && diff < 14 * 24 * 60 * 60 * 1000;
    });

    // Считаем жертв за периоды
    const fatalitiesLast7 = last7Days.reduce((s, e) => s + e.fatalities, 0);
    const fatalitiesPrev7 = previous7Days.reduce((s, e) => s + e.fatalities, 0);

    // Основные показатели
    const change = last7Days.length - previous7Days.length;
    const fatalChange = fatalitiesLast7 - fatalitiesPrev7;

    let trend = 'stable';
    if (change > 2 || fatalChange > 5) trend = 'escalating';
    else if (change < -2 || fatalChange < -5) trend = 'de-escalating';

    const totalEvents = events.length;
    let level = 'low';
    if (totalEvents > 50) level = 'critical';
    else if (totalEvents > 20) level = 'high';
    else if (totalEvents > 5) level = 'medium';

    return {
        totalEvents: totalEvents,
        last7Days: last7Days.length,
        previous7Days: previous7Days.length,
        change: change,
        changePercent: previous7Days.length > 0 
            ? Math.round((change / previous7Days.length) * 100) 
            : 0,
        fatalitiesLast7: fatalitiesLast7,
        fatalitiesPrev7: fatalitiesPrev7,
        fatalChange: fatalChange,
        trend: trend,
        level: level,
        levelLabel: ESCALATION_LEVELS[level.toUpperCase()]?.label || level,
        levelColor: ESCALATION_LEVELS[level.toUpperCase()]?.color || '#888'
    };
}

// ============================================================
// 6. СТАТИСТИКА
// ============================================================

function getSummary(events) {
    const summary = {
        total: events.length,
        fatalities: events.reduce((s, e) => s + e.fatalities, 0),
        byType: {},
        byCountry: {},
        byRegion: {},
        bySeverity: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        }
    };

    for (const e of events) {
        // По типам
        const type = e.type || 'unknown';
        summary.byType[type] = (summary.byType[type] || 0) + 1;

        // По странам
        const country = e.country || 'unknown';
        summary.byCountry[country] = (summary.byCountry[country] || 0) + 1;

        // По регионам
        const region = e.region || 'unknown';
        summary.byRegion[region] = (summary.byRegion[region] || 0) + 1;

        // По severity
        const severity = e.severity || 'low';
        summary.bySeverity[severity] = (summary.bySeverity[severity] || 0) + 1;
    }

    return summary;
}

// ============================================================
// 7. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getDateString(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
}

// ============================================================
// 8. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const demoTimestamp = new Date().toISOString();
    
    const demoEvents = [
        { id: 'demo-1', date: '2026-08-14', country: 'Украина', region: 'Eastern Europe', type: 'Battles', subType: 'Armed clash', actor1: 'Ukrainian Forces', actor2: 'Russian Forces', fatalities: 12, lat: 47.5, lng: 34.8, description: 'Столкновение в Запорожской области', severity: 'critical' },
        { id: 'demo-2', date: '2026-08-14', country: 'Украина', region: 'Eastern Europe', type: 'Explosions/Remote violence', subType: 'Air strike', actor1: 'Russian Forces', actor2: 'Civilian', fatalities: 5, lat: 48.2, lng: 37.3, description: 'Авиаудар по Краматорску', severity: 'high' },
        { id: 'demo-3', date: '2026-08-13', country: 'Иран', region: 'Middle East', type: 'Protests', subType: 'Demonstration', actor1: 'Protesters', actor2: 'Security Forces', fatalities: 2, lat: 35.7, lng: 51.4, description: 'Протесты в Тегеране', severity: 'medium' },
        { id: 'demo-4', date: '2026-08-13', country: 'Израиль', region: 'Middle East', type: 'Explosions/Remote violence', subType: 'Rocket attack', actor1: 'Hamas', actor2: 'IDF', fatalities: 0, lat: 31.5, lng: 34.5, description: 'Ракетный обстрел Ашкелона', severity: 'medium' },
        { id: 'demo-5', date: '2026-08-12', country: 'Судан', region: 'Africa', type: 'Battles', subType: 'Armed clash', actor1: 'SAF', actor2: 'RSF', fatalities: 25, lat: 15.5, lng: 32.5, description: 'Бои в Хартуме', severity: 'critical' },
        { id: 'demo-6', date: '2026-08-12', country: 'Мьянма', region: 'Asia', type: 'Violence against civilians', subType: 'Attack', actor1: 'Military Junta', actor2: 'Civilians', fatalities: 8, lat: 19.7, lng: 96.1, description: 'Нападение на деревню', severity: 'high' },
        { id: 'demo-7', date: '2026-08-11', country: 'Мексика', region: 'Americas', type: 'Violence against civilians', subType: 'Attack', actor1: 'Cartel', actor2: 'Civilians', fatalities: 6, lat: 20.6, lng: -100.3, description: 'Атака картеля', severity: 'high' },
        { id: 'demo-8', date: '2026-08-11', country: 'Палестина', region: 'Middle East', type: 'Protests', subType: 'Demonstration', actor1: 'Palestinians', actor2: 'IDF', fatalities: 1, lat: 31.8, lng: 35.2, description: 'Протесты в Вифлееме', severity: 'medium' },
        { id: 'demo-9', date: '2026-08-10', country: 'Эфиопия', region: 'Africa', type: 'Battles', subType: 'Armed clash', actor1: 'Government Forces', actor2: 'TPLF', fatalities: 15, lat: 12.5, lng: 39.5, description: 'Бои в Тиграе', severity: 'critical' },
        { id: 'demo-10', date: '2026-08-10', country: 'Венесуэла', region: 'Americas', type: 'Protests', subType: 'Demonstration', actor1: 'Opposition', actor2: 'Security Forces', fatalities: 0, lat: 10.5, lng: -66.9, description: 'Протесты в Каракасе', severity: 'low' }
    ];

    const summary = {
        total: demoEvents.length,
        fatalities: demoEvents.reduce((s, e) => s + e.fatalities, 0),
        byType: { Battles: 3, 'Explosions/Remote violence': 2, Protests: 3, 'Violence against civilians': 2 },
        byCountry: { Украина: 2, Иран: 1, Израиль: 1, Судан: 1, Мьянма: 1, Мексика: 1, Палестина: 1, Эфиопия: 1, Венесуэла: 1 },
        byRegion: { 'Eastern Europe': 2, 'Middle East': 3, Africa: 2, Asia: 1, Americas: 2 },
        bySeverity: { critical: 3, high: 3, medium: 3, low: 1 }
    };

    const escalation = {
        totalEvents: demoEvents.length,
        last7Days: 8,
        previous7Days: 2,
        change: 6,
        changePercent: 300,
        fatalitiesLast7: 59,
        fatalitiesPrev7: 15,
        fatalChange: 44,
        trend: 'escalating',
        level: 'high',
        levelLabel: '🟠 Высокая',
        levelColor: '#f97316'
    };

    return {
        success: true,
        count: demoEvents.length,
        events: demoEvents,
        summary: summary,
        escalation: escalation,
        source: 'DEMO (ACLED)',
        timestamp: demoTimestamp,
        isDemo: true
    };
}

// ============================================================
// 9. API-ОБРАБОТЧИК
// ============================================================

export async function handleACLEDApi(req, res) {
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
        // GET /api/acled/events — получить данные о конфликтах
        if (path === '/api/acled/events' && req.method === 'GET') {
            const params = url.searchParams;
            const days = parseInt(params.get('days')) || 30;
            const country = params.get('country') || null;
            const region = params.get('region') || null;
            const limit = parseInt(params.get('limit')) || 500;

            const data = await fetchConflicts({ days, country, region, limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/acled/escalation — получить только анализ эскалации
        if (path === '/api/acled/escalation' && req.method === 'GET') {
            const data = await fetchConflicts({ days: 30 });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                escalation: data.escalation,
                timestamp: data.timestamp
            }));
            return;
        }

        // GET /api/acled/status — статус модуля
        if (path === '/api/acled/status' && req.method === 'GET') {
            const email = process.env.ACLED_EMAIL || '';
            const password = process.env.ACLED_PASSWORD || '';

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'ACLED',
                status: (email && password) ? 'active' : 'demo',
                authSet: !!(email && password),
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[ACLED API] Ошибка:', error);
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
    fetchConflicts,
    handleACLEDApi,
    analyzeEscalation
};