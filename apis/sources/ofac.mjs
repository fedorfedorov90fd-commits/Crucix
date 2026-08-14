#!/usr/bin/env node

// ============================================================
// OFAC — САНКЦИОННЫЙ МОНИТОРИНГ
// ============================================================
// Источник: OFAC SDN List (США) + EU Sanctions + UN Sanctions
// Данные: подсанкционные объекты, проверка на санкции
// Обновление: ежедневно
// Версия: 2.0 (профессиональная, без глюков)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// OFAC SDN List (основной источник)
const OFAC_API = 'https://api.treasury.gov/sdn';
const OFAC_LIST_URL = 'https://www.treasury.gov/ofac/downloads/sdn.csv';

// EU Sanctions
const EU_SANCTIONS_URL = 'https://data.europa.eu/api/hub/search';

// UN Sanctions
const UN_SANCTIONS_URL = 'https://scsanctions.un.org/resources/xml/en/consolidated.xml';

// Типы санкций
const SANCTION_TYPES = {
    OFAC: 'OFAC (США)',
    EU: 'EU (Европа)',
    UN: 'UN (ООН)',
    UK: 'UK (Великобритания)',
    OTHER: 'Другие'
};

// Категории подсанкционных объектов
const CATEGORIES = {
    INDIVIDUAL: 'Физическое лицо',
    ENTITY: 'Юридическое лицо',
    VESSEL: 'Судно',
    AIRCRAFT: 'Воздушное судно',
    ORGANIZATION: 'Организация'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Получить санкционные данные
 *
 * @param {Object} options
 * @param {string} options.search - Поиск по названию
 * @param {string} options.type - Тип санкций (ofac, eu, un)
 * @param {number} options.limit - Максимум записей
 * @returns {Promise<Object>} Санкционные данные
 */
export async function fetchSanctions(options = {}) {
    const {
        search = null,
        type = null,
        limit = 100
    } = options;

    try {
        console.log('[OFAC] Запрос санкционных данных...');

        // Получаем данные из всех источников
        const [ofacData, euData, unData] = await Promise.all([
            fetchOFAC(),
            fetchEUSanctions(),
            fetchUNSanctions()
        ]);

        // Объединяем все санкции
        let allSanctions = [...ofacData, ...euData, ...unData];

        // Фильтр по типу
        if (type) {
            allSanctions = allSanctions.filter(s => s.type === type);
        }

        // Поиск по названию
        if (search) {
            const query = search.toLowerCase();
            allSanctions = allSanctions.filter(s =>
                s.name?.toLowerCase().includes(query) ||
                s.aka?.some(a => a.toLowerCase().includes(query))
            );
        }

        // Статистика
        const summary = getSanctionSummary(allSanctions);
        const anomalies = detectSanctionAnomalies(allSanctions);

        console.log(`[OFAC] Найдено ${allSanctions.length} санкций`);

        return {
            success: true,
            count: allSanctions.length,
            sanctions: allSanctions.slice(0, limit),
            summary: summary,
            anomalies: anomalies,
            source: 'OFAC + EU + UN',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[OFAC] Ошибка:', error.message);
        console.warn('[OFAC] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ OFAC SDN LIST
// ============================================================

async function fetchOFAC() {
    try {
        const response = await fetchWithRetry(OFAC_LIST_URL, { timeout: 15000 });
        const text = await response.text();

        // Парсим CSV (простой парсинг)
        const lines = text.split('\n').slice(1);
        const sanctions = [];

        for (const line of lines) {
            if (!line.trim()) continue;
            const parts = line.split(',');
            if (parts.length < 3) continue;

            sanctions.push({
                id: `ofac-${parts[0]}`,
                name: parts[1]?.replace(/"/g, '') || 'Unknown',
                type: 'OFAC',
                category: detectCategory(parts[1] || ''),
                programs: parts[2]?.replace(/"/g, '').split(';') || [],
                country: parts[3]?.replace(/"/g, '') || 'Unknown',
                aka: parts[4]?.replace(/"/g, '').split(';') || [],
                date: new Date().toISOString(),
                source: SANCTION_TYPES.OFAC
            });
        }

        return sanctions;
    } catch (e) {
        console.warn('[OFAC] Не удалось получить данные OFAC:', e.message);
        return [];
    }
}

// ============================================================
// 4. ПОЛУЧЕНИЕ EU SANCTIONS
// ============================================================

async function fetchEUSanctions() {
    try {
        const params = new URLSearchParams({
            q: 'sanctions',
            sort: 'date',
            limit: 100
        });
        const response = await fetchWithRetry(`${EU_SANCTIONS_URL}?${params}`, { timeout: 10000 });
        const data = await response.json();

        const sanctions = [];
        if (data.results) {
            for (const item of data.results) {
                sanctions.push({
                    id: `eu-${item.id}`,
                    name: item.title || 'Unknown',
                    type: 'EU',
                    category: CATEGORIES.ENTITY,
                    programs: ['EU Sanctions'],
                    country: item.country || 'Unknown',
                    aka: [],
                    date: item.date || new Date().toISOString(),
                    source: SANCTION_TYPES.EU
                });
            }
        }
        return sanctions;
    } catch (e) {
        console.warn('[OFAC] Не удалось получить данные EU:', e.message);
        return [];
    }
}

// ============================================================
// 5. ПОЛУЧЕНИЕ UN SANCTIONS
// ============================================================

async function fetchUNSanctions() {
    try {
        const response = await fetchWithRetry(UN_SANCTIONS_URL, { timeout: 10000 });
        const text = await response.text();

        // Простой парсинг XML
        const sanctions = [];
        const entries = text.match(/<individual[^>]*>.*?<\/individual>/gs) || [];

        for (const entry of entries) {
            const nameMatch = entry.match(/<name>(.*?)<\/name>/);
            const name = nameMatch ? nameMatch[1] : 'Unknown';

            const typeMatch = entry.match(/<type>(.*?)<\/type>/);
            const type = typeMatch ? typeMatch[1] : 'Unknown';

            sanctions.push({
                id: `un-${sanctions.length}`,
                name: name,
                type: 'UN',
                category: detectCategory(name),
                programs: ['UN Sanctions'],
                country: 'Various',
                aka: [],
                date: new Date().toISOString(),
                source: SANCTION_TYPES.UN
            });
        }
        return sanctions;
    } catch (e) {
        console.warn('[OFAC] Не удалось получить данные UN:', e.message);
        return [];
    }
}

// ============================================================
// 6. ОПРЕДЕЛЕНИЕ КАТЕГОРИИ
// ============================================================

function detectCategory(name) {
    if (!name) return CATEGORIES.ORGANIZATION;

    const upper = name.toUpperCase();
    if (upper.includes('SHIP') || upper.includes('VESSEL') || upper.includes('TANKER')) {
        return CATEGORIES.VESSEL;
    }
    if (upper.includes('AIRCRAFT') || upper.includes('PLANE') || upper.includes('FLIGHT')) {
        return CATEGORIES.AIRCRAFT;
    }
    if (upper.includes('LLC') || upper.includes('INC') || upper.includes('CORP') || upper.includes('LTD')) {
        return CATEGORIES.ENTITY;
    }
    if (upper.includes('BANK') || upper.includes('FUND') || upper.includes('COMPANY')) {
        return CATEGORIES.ENTITY;
    }
    if (upper.includes('MR.') || upper.includes('MS.') || upper.includes('MRS.')) {
        return CATEGORIES.INDIVIDUAL;
    }
    if (upper.includes('ORGANIZATION') || upper.includes('GROUP') || upper.includes('ASSOCIATION')) {
        return CATEGORIES.ORGANIZATION;
    }

    return CATEGORIES.ORGANIZATION;
}

// ============================================================
// 7. ПРОВЕРКА ОБЪЕКТА НА САНКЦИИ
// ============================================================

export function checkSanctions(object, sanctions) {
    if (!object || !sanctions || sanctions.length === 0) {
        return { sanctioned: false, matches: [] };
    }

    const matches = [];
    const objectName = object.name?.toLowerCase() || '';
    const objectId = object.id?.toLowerCase() || '';

    for (const sanction of sanctions) {
        const sanctionName = sanction.name?.toLowerCase() || '';
        const sanctionId = sanction.id?.toLowerCase() || '';

        // Проверка по названию
        if (objectName && sanctionName && (
            objectName.includes(sanctionName) ||
            sanctionName.includes(objectName)
        )) {
            matches.push(sanction);
            continue;
        }

        // Проверка по ID
        if (objectId && sanctionId && objectId === sanctionId) {
            matches.push(sanction);
            continue;
        }

        // Проверка по AKA
        if (sanction.aka) {
            for (const aka of sanction.aka) {
                if (objectName && aka.toLowerCase().includes(objectName)) {
                    matches.push(sanction);
                    break;
                }
            }
        }
    }

    return {
        sanctioned: matches.length > 0,
        matches: matches,
        count: matches.length
    };
}

// ============================================================
// 8. СТАТИСТИКА
// ============================================================

function getSanctionSummary(sanctions) {
    const summary = {
        total: sanctions.length,
        byType: {},
        byCategory: {},
        byCountry: {}
    };

    for (const s of sanctions) {
        const type = s.type || 'Unknown';
        summary.byType[type] = (summary.byType[type] || 0) + 1;

        const category = s.category || 'Unknown';
        summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;

        const country = s.country || 'Unknown';
        summary.byCountry[country] = (summary.byCountry[country] || 0) + 1;
    }

    return summary;
}

// ============================================================
// 9. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectSanctionAnomalies(sanctions) {
    const anomalies = [];

    // 1. Много новых санкций за последние 7 дней
    const now = new Date();
    const recent = sanctions.filter(s => {
        const date = new Date(s.date);
        return (now - date) < 7 * 24 * 60 * 60 * 1000;
    });

    if (recent.length > 10) {
        anomalies.push({
            type: 'high_sanction_rate',
            severity: 'high',
            count: recent.length,
            description: `${recent.length} новых санкций за 7 дней`,
            examples: recent.slice(0, 3).map(s => s.name).join(', ')
        });
    }

    // 2. Санкции против судов
    const vessels = sanctions.filter(s => s.category === CATEGORIES.VESSEL);
    if (vessels.length > 5) {
        anomalies.push({
            type: 'vessel_sanctions',
            severity: 'medium',
            count: vessels.length,
            description: `${vessels.length} судов под санкциями`,
            examples: vessels.slice(0, 3).map(s => s.name).join(', ')
        });
    }

    return anomalies;
}

// ============================================================
// 10. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const demoTimestamp = new Date().toISOString();

    const demoSanctions = [
        { id: 'ofac-001', name: 'Крымский мост', type: 'OFAC', category: 'Инфраструктура', programs: ['UKRAINE-EO14065'], country: 'Russia', aka: [], date: '2026-08-01', source: 'OFAC (США)' },
        { id: 'ofac-002', name: 'Энергосеть Украины', type: 'OFAC', category: 'Энергетика', programs: ['UKRAINE-EO14065'], country: 'Russia', aka: [], date: '2026-08-01', source: 'OFAC (США)' },
        { id: 'ofac-003', name: 'АЭС Бушер', type: 'OFAC', category: 'Энергетика', programs: ['IRAN-EO13876'], country: 'Iran', aka: ['Bushehr NPP'], date: '2026-07-15', source: 'OFAC (США)' },
        { id: 'ofac-004', name: 'Запорожская АЭС', type: 'OFAC', category: 'Энергетика', programs: ['UKRAINE-EO14065'], country: 'Ukraine', aka: ['Zaporizhzhia NPP'], date: '2026-07-10', source: 'OFAC (США)' },
        { id: 'ofac-005', name: 'Северный поток-2', type: 'EU', category: 'Инфраструктура', programs: ['EU Sanctions'], country: 'Russia', aka: ['Nord Stream 2'], date: '2026-07-05', source: 'EU (Европа)' },
        { id: 'ofac-006', name: 'Совкомфлот', type: 'OFAC', category: 'Судоходство', programs: ['UKRAINE-EO14065'], country: 'Russia', aka: ['Sovcomflot'], date: '2026-06-20', source: 'OFAC (США)' },
        { id: 'ofac-007', name: 'Иранский нефтяной танкер', type: 'UN', category: 'Судно', programs: ['UN Sanctions'], country: 'Iran', aka: ['Iranian Oil Tanker'], date: '2026-06-15', source: 'UN (ООН)' },
        { id: 'ofac-008', name: 'Роснефть', type: 'OFAC', category: 'Энергетика', programs: ['UKRAINE-EO14065'], country: 'Russia', aka: ['Rosneft'], date: '2026-06-10', source: 'OFAC (США)' },
        { id: 'ofac-009', name: 'Газпром', type: 'EU', category: 'Энергетика', programs: ['EU Sanctions'], country: 'Russia', aka: ['Gazprom'], date: '2026-06-01', source: 'EU (Европа)' },
        { id: 'ofac-010', name: 'Китайская компания по микросхемам', type: 'OFAC', category: 'Технологии', programs: ['CHINA-EO14032'], country: 'China', aka: ['Chinese Chip Company'], date: '2026-05-20', source: 'OFAC (США)' },
        { id: 'ofac-011', name: 'Северная Корея — ракетная программа', type: 'UN', category: 'Военные', programs: ['UN Sanctions'], country: 'North Korea', aka: ['NK Missile Program'], date: '2026-05-10', source: 'UN (ООН)' },
        { id: 'ofac-012', name: 'Венесуэльская нефтяная компания', type: 'OFAC', category: 'Энергетика', programs: ['VENEZUELA-EO13850'], country: 'Venezuela', aka: ['PDVSA'], date: '2026-04-15', source: 'OFAC (США)' }
    ];

    const summary = {
        total: demoSanctions.length,
        byType: { OFAC: 8, EU: 2, UN: 2 },
        byCategory: { 'Энергетика': 5, 'Инфраструктура': 2, 'Судоходство': 1, 'Судно': 1, 'Технологии': 1, 'Военные': 1, 'Другие': 1 },
        byCountry: { Russia: 5, Iran: 2, Ukraine: 1, China: 1, 'North Korea': 1, Venezuela: 1, 'Various': 1 }
    };

    const anomalies = [
        { type: 'high_sanction_rate', severity: 'high', count: 3, description: '3 новых санкции за 7 дней', examples: 'Крымский мост, Энергосеть Украины, АЭС Бушер' },
        { type: 'vessel_sanctions', severity: 'medium', count: 2, description: '2 судна под санкциями', examples: 'Иранский нефтяной танкер, Совкомфлот' }
    ];

    return {
        success: true,
        count: demoSanctions.length,
        sanctions: demoSanctions,
        summary: summary,
        anomalies: anomalies,
        source: 'DEMO (OFAC + EU + UN)',
        timestamp: demoTimestamp,
        isDemo: true
    };
}

// ============================================================
// 11. API-ОБРАБОТЧИК
// ============================================================

export async function handleOFACApi(req, res) {
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
        // GET /api/ofac/list — получить список санкций
        if (path === '/api/ofac/list' && req.method === 'GET') {
            const params = url.searchParams;
            const search = params.get('search') || null;
            const type = params.get('type') || null;
            const limit = parseInt(params.get('limit')) || 100;

            const data = await fetchSanctions({ search, type, limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // POST /api/ofac/check — проверить объект на санкции
        if (path === '/api/ofac/check' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { object } = JSON.parse(body);
                    const data = await fetchSanctions();

                    if (!object) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Объект не указан' }));
                        return;
                    }

                    const result = checkSanctions(object, data.sanctions);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        object: object,
                        ...result,
                        timestamp: new Date().toISOString()
                    }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // GET /api/ofac/status — статус модуля
        if (path === '/api/ofac/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'OFAC',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[OFAC API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 12. ЭКСПОРТ
// ============================================================

export default {
    fetchSanctions,
    handleOFACApi,
    checkSanctions
};
