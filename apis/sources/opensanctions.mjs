#!/usr/bin/env node

// ============================================================
// OPENSANCTIONS — САНКЦИОННЫЕ СПИСКИ (ОТКРЫТЫЕ ДАННЫЕ)
// ============================================================
// Источник: OpenSanctions.org (объединённые санкционные списки)
// Данные: санкции из разных стран (США, ЕС, ООН, UK и др.)
// Версия: 2.0 (профессиональная, единый стиль)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// OpenSanctions API
const OPENSANCTIONS_API = 'https://api.opensanctions.org/search/default';

// Типы санкций
const SANCTION_TYPES = {
    OFAC: 'OFAC (США)',
    EU: 'EU (Европа)',
    UN: 'UN (ООН)',
    UK: 'UK (Великобритания)',
    AU: 'AU (Австралия)',
    CA: 'CA (Канада)',
    CH: 'CH (Швейцария)',
    OTHER: 'Другие'
};

// Категории подсанкционных объектов
const CATEGORIES = {
    INDIVIDUAL: 'Физическое лицо',
    ENTITY: 'Юридическое лицо',
    VESSEL: 'Судно',
    AIRCRAFT: 'Воздушное судно',
    ORGANIZATION: 'Организация',
    VEHICLE: 'Транспортное средство'
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

export async function fetchOpenSanctions(options = {}) {
    const {
        search = null,
        type = null,
        country = null,
        limit = 50
    } = options;

    try {
        console.log('[OpenSanctions] Запрос санкционных данных...');

        let sanctions = [];

        try {
            sanctions = await fetchSanctionsList(search, type, country);
        } catch (e) {
            console.warn('[OpenSanctions] Ошибка при получении данных:', e.message);
        }

        // Если данных нет — используем демо
        if (sanctions.length === 0) {
            console.log('[OpenSanctions] Реальные данные недоступны, использую демо-данные');
            return getDemoData();
        }

        // Фильтр по типу санкций
        if (type) {
            sanctions = sanctions.filter(d =>
                d.sanctionType?.toLowerCase().includes(type.toLowerCase())
            );
        }

        // Фильтр по стране
        if (country) {
            sanctions = sanctions.filter(d =>
                d.country?.toLowerCase().includes(country.toLowerCase())
            );
        }

        // Сортируем по дате (новые сверху)
        sanctions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Ограничиваем количество
        if (sanctions.length > limit) {
            sanctions = sanctions.slice(0, limit);
        }

        // Статистика
        const summary = getOpenSanctionsSummary(sanctions);
        const alerts = detectOpenSanctionsAlerts(sanctions);

        console.log(`[OpenSanctions] Получено ${sanctions.length} записей`);

        return {
            success: true,
            count: sanctions.length,
            data: sanctions,
            summary: summary,
            alerts: alerts,
            source: 'OpenSanctions.org',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[OpenSanctions] Ошибка:', error.message);
        console.warn('[OpenSanctions] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ САНКЦИОННЫХ СПИСКОВ
// ============================================================

async function fetchSanctionsList(search, type, country) {
    try {
        // Формируем запрос к OpenSanctions API
        const params = new URLSearchParams({
            q: search || '*',
            limit: 100
        });

        if (type) params.append('type', type);
        if (country) params.append('country', country);

        const url = `${OPENSANCTIONS_API}?${params}`;
        console.log(`[OpenSanctions] Запрос: ${url}`);

        const response = await fetchWithRetry(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Crucix/2.0 (https://crucix.live)',
                'Accept': 'application/json'
            }
        });

        const text = await response.text();

        if (!text.trim().startsWith('{')) {
            console.warn('[OpenSanctions] API вернул не JSON, пропускаем');
            return [];
        }

        const data = JSON.parse(text);

        if (data && data.results) {
            return data.results.map(item => {
                const properties = item.properties || {};
                const schema = item.schema || '';

                return {
                    id: item.id || `os-${Date.now()}`,
                    name: properties.name || properties.title || 'Unknown',
                    description: properties.description || '',
                    category: detectOpenSanctionsCategory(schema, properties),
                    sanctionType: detectSanctionType(properties),
                    country: properties.country || properties.nationality || 'Unknown',
                    date: properties.date || new Date().toISOString(),
                    source: properties.source || 'OpenSanctions',
                    url: item.url || '',
                    severity: detectOpenSanctionsSeverity(properties),
                    status: 'active'
                };
            });
        }
        return [];
    } catch (e) {
        console.warn('[OpenSanctions] Не удалось получить данные:', e.message);
        return [];
    }
}

// ============================================================
// 4. ОПРЕДЕЛЕНИЕ ТИПА САНКЦИЙ
// ============================================================

function detectSanctionType(properties) {
    if (!properties) return SANCTION_TYPES.OTHER;

    const sources = properties.source || '';
    const programs = properties.programs || '';

    const text = (sources + ' ' + programs).toUpperCase();

    if (text.includes('OFAC') || text.includes('SDN') || text.includes('TREASURY')) {
        return SANCTION_TYPES.OFAC;
    }
    if (text.includes('EU') || text.includes('EUROPEAN')) {
        return SANCTION_TYPES.EU;
    }
    if (text.includes('UN') || text.includes('UNITED NATIONS')) {
        return SANCTION_TYPES.UN;
    }
    if (text.includes('UK') || text.includes('UNITED KINGDOM') || text.includes('HMT')) {
        return SANCTION_TYPES.UK;
    }
    if (text.includes('AUSTRALIA') || text.includes('DFAT')) {
        return SANCTION_TYPES.AU;
    }
    if (text.includes('CANADA') || text.includes('GAC')) {
        return SANCTION_TYPES.CA;
    }
    if (text.includes('SWITZERLAND') || text.includes('SECO')) {
        return SANCTION_TYPES.CH;
    }

    return SANCTION_TYPES.OTHER;
}

// ============================================================
// 5. ОПРЕДЕЛЕНИЕ КАТЕГОРИИ
// ============================================================

function detectOpenSanctionsCategory(schema, properties) {
    if (!schema) return CATEGORIES.ORGANIZATION;

    const s = schema.toLowerCase();
    if (s.includes('person') || s.includes('individual')) {
        return CATEGORIES.INDIVIDUAL;
    }
    if (s.includes('company') || s.includes('organization') || s.includes('entity')) {
        return CATEGORIES.ENTITY;
    }
    if (s.includes('vessel') || s.includes('ship')) {
        return CATEGORIES.VESSEL;
    }
    if (s.includes('aircraft') || s.includes('plane')) {
        return CATEGORIES.AIRCRAFT;
    }
    if (s.includes('vehicle') || s.includes('car')) {
        return CATEGORIES.VEHICLE;
    }

    return CATEGORIES.ORGANIZATION;
}

// ============================================================
// 6. ОПРЕДЕЛЕНИЕ УРОВНЯ ОПАСНОСТИ
// ============================================================

function detectOpenSanctionsSeverity(properties) {
    if (!properties) return SEVERITY.NORMAL;

    const programs = properties.programs || '';
    const text = programs.toUpperCase();

    // Критические программы
    const criticalPrograms = ['UKRAINE', 'RUSSIA', 'IRAN', 'NORTH KOREA', 'SYRIA'];
    for (const prog of criticalPrograms) {
        if (text.includes(prog)) return SEVERITY.CRITICAL;
    }

    // Высокая важность
    const highPrograms = ['BELARUS', 'VENEZUELA', 'MYANMAR', 'YEMEN', 'LIBYA'];
    for (const prog of highPrograms) {
        if (text.includes(prog)) return SEVERITY.HIGH;
    }

    // Средняя важность
    const mediumPrograms = ['HUMAN RIGHTS', 'CORRUPTION', 'CYBER'];
    for (const prog of mediumPrograms) {
        if (text.includes(prog)) return SEVERITY.MEDIUM;
    }

    return SEVERITY.NORMAL;
}

// ============================================================
// 7. СТАТИСТИКА
// ============================================================

function getOpenSanctionsSummary(data) {
    const summary = {
        total: data.length,
        byCategory: {},
        bySanctionType: {},
        byCountry: {},
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
    };

    for (const d of data) {
        const category = d.category || 'Unknown';
        summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;

        const sanctionType = d.sanctionType || 'Unknown';
        summary.bySanctionType[sanctionType] = (summary.bySanctionType[sanctionType] || 0) + 1;

        const country = d.country || 'Unknown';
        summary.byCountry[country] = (summary.byCountry[country] || 0) + 1;

        const severity = d.severity || 'normal';
        if (severity === 'critical') summary.criticalCount++;
        if (severity === 'high') summary.highCount++;
        if (severity === 'medium') summary.mediumCount++;
        if (severity === 'low') summary.lowCount++;
    }

    return summary;
}

// ============================================================
// 8. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectOpenSanctionsAlerts(data) {
    const alerts = [];

    // 1. Критические санкции
    const critical = data.filter(d => d.severity === SEVERITY.CRITICAL);
    if (critical.length > 0) {
        alerts.push({
            type: 'critical_sanctions',
            severity: SEVERITY.CRITICAL,
            count: critical.length,
            description: `${critical.length} критических санкционных записей`,
            examples: critical.slice(0, 3).map(d => d.name).join(', ')
        });
    }

    // 2. Новые санкции за последние 30 дней
    const now = new Date();
    const recent = data.filter(d => {
        const date = new Date(d.date);
        return (now - date) < 30 * 24 * 60 * 60 * 1000;
    });

    if (recent.length > 5) {
        alerts.push({
            type: 'new_sanctions',
            severity: recent.length > 15 ? SEVERITY.HIGH : SEVERITY.MEDIUM,
            count: recent.length,
            description: `${recent.length} новых санкций за 30 дней`,
            examples: recent.slice(0, 3).map(d => d.name).join(', ')
        });
    }

    // 3. Санкции против организаций
    const entities = data.filter(d => d.category === CATEGORIES.ENTITY || d.category === CATEGORIES.ORGANIZATION);
    if (entities.length > data.length * 0.5) {
        alerts.push({
            type: 'entity_sanctions_dominance',
            severity: SEVERITY.LOW,
            count: entities.length,
            description: `${Math.round(entities.length / data.length * 100)}% санкций против организаций`
        });
    }

    return alerts;
}

// ============================================================
// 9. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const now = new Date();
    const data = [];

    const demoSanctions = [
        { name: 'Сбербанк России', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.OFAC, country: 'Russia' },
        { name: 'Газпром', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.EU, country: 'Russia' },
        { name: 'Роснефть', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.OFAC, country: 'Russia' },
        { name: 'Крымский мост', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.OFAC, country: 'Russia' },
        { name: 'Северный поток-2', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.EU, country: 'Russia' },
        { name: 'Аэрофлот', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.UK, country: 'Russia' },
        { name: 'ВТБ', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.OFAC, country: 'Russia' },
        { name: 'Совкомфлот', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.OFAC, country: 'Russia' },
        { name: 'Иранский нефтяной танкер', category: CATEGORIES.VESSEL, sanctionType: SANCTION_TYPES.UN, country: 'Iran' },
        { name: 'Запорожская АЭС', category: CATEGORIES.ENTITY, sanctionType: SANCTION_TYPES.OFAC, country: 'Ukraine' }
    ];

    for (let i = 0; i < demoSanctions.length; i++) {
        const s = demoSanctions[i];
        const date = new Date(now);
        date.setDate(date.getDate() - i * 7);

        data.push({
            id: `demo-${i}`,
            name: s.name,
            description: `Санкции против ${s.name} в рамках международных ограничений.`,
            category: s.category,
            sanctionType: s.sanctionType,
            country: s.country,
            date: date.toISOString(),
            source: 'OpenSanctions (DEMO)',
            url: '#',
            severity: detectOpenSanctionsSeverity({ programs: s.sanctionType }),
            status: 'active'
        });
    }

    // Добавляем свежую запись
    data.unshift({
        id: 'demo-recent',
        name: 'Новые санкции против российской энергетики',
        description: 'США и ЕС ввели новые санкции против российской энергетической инфраструктуры.',
        category: CATEGORIES.ENTITY,
        sanctionType: SANCTION_TYPES.OFAC,
        country: 'Russia',
        date: new Date().toISOString(),
        source: 'OpenSanctions (DEMO)',
        url: '#',
        severity: SEVERITY.CRITICAL,
        status: 'active'
    });

    const summary = getOpenSanctionsSummary(data);
    const alerts = detectOpenSanctionsAlerts(data);

    console.log(`[OpenSanctions] Сгенерировано ${data.length} демо-записей`);

    return {
        success: true,
        count: data.length,
        data: data,
        summary: summary,
        alerts: alerts,
        source: 'OpenSanctions.org (DEMO)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// 10. API-ОБРАБОТЧИК
// ============================================================

export async function handleOpenSanctionsAPI(req, res) {
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
        // GET /api/opensanctions/data — получить санкционные данные
        if (path === '/api/opensanctions/data' && req.method === 'GET') {
            const params = url.searchParams;
            const search = params.get('search') || null;
            const type = params.get('type') || null;
            const country = params.get('country') || null;
            const limit = parseInt(params.get('limit')) || 50;

            const data = await fetchOpenSanctions({ search, type, country, limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/opensanctions/status — статус модуля
        if (path === '/api/opensanctions/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'OpenSanctions',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[OpenSanctions API] Ошибка:', error);
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
    fetchOpenSanctions,
    handleOpenSanctionsAPI,
    getOpenSanctionsSummary,
    detectOpenSanctionsAlerts
};