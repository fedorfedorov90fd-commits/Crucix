#!/usr/bin/env node

// ============================================================
// FRED — ЭКОНОМИЧЕСКИЕ ИНДИКАТОРЫ
// ============================================================
// Источник: FRED (Federal Reserve Economic Data)
// Данные: ключевые экономические индикаторы США и мира
// Обновление: ежедневно/еженедельно
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

const FRED_API = 'https://api.stlouisfed.org/fred/series/observations';

// Ключевые экономические индикаторы
const INDICATORS = {
    VIX: {
        id: 'VIXCLS',
        name: 'Индекс волатильности VIX',
        category: 'market',
        unit: 'пункты'
    },
    HY_SPREAD: {
        id: 'BAMLH0A0HYM2',
        name: 'Спред высокодоходных облигаций',
        category: 'credit',
        unit: '%'
    },
    CPI: {
        id: 'CPIAUCSL',
        name: 'Индекс потребительских цен (CPI)',
        category: 'inflation',
        unit: 'индекс'
    },
    CPI_MOM: {
        id: 'CPIAUCSL',
        name: 'CPI (месяц к месяцу)',
        category: 'inflation',
        unit: '%'
    },
    UNEMPLOYMENT: {
        id: 'UNRATE',
        name: 'Уровень безработицы',
        category: 'labor',
        unit: '%'
    },
    FED_FUNDS: {
        id: 'FEDFUNDS',
        name: 'Ставка ФРС',
        category: 'monetary',
        unit: '%'
    },
    M2: {
        id: 'M2SL',
        name: 'Денежная масса M2',
        category: 'monetary',
        unit: 'млрд $'
    },
    GSCPI: {
        id: 'GSCPI',
        name: 'Индекс давления в цепях поставок',
        category: 'supply_chain',
        unit: 'индекс'
    },
    GDP: {
        id: 'GDP',
        name: 'ВВП США',
        category: 'growth',
        unit: 'млрд $'
    },
    MORTGAGE_30Y: {
        id: 'MORTGAGE30US',
        name: 'Ставка по ипотеке (30 лет)',
        category: 'housing',
        unit: '%'
    },
    NATIONAL_DEBT: {
        id: 'FYGFD',
        name: 'Государственный долг США',
        category: 'fiscal',
        unit: 'млрд $'
    },
    JOBLESS_CLAIMS: {
        id: 'ICSA',
        name: 'Первичные заявки на пособие по безработице',
        category: 'labor',
        unit: 'тыс.'
    },
    PPI: {
        id: 'PPIACO',
        name: 'Индекс цен производителей',
        category: 'inflation',
        unit: 'индекс'
    },
    CONSUMER_SENTIMENT: {
        id: 'UMCSENT',
        name: 'Индекс потребительского доверия',
        category: 'sentiment',
        unit: 'индекс'
    }
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

/**
 * Получить все экономические данные
 * 
 * @param {Object} options
 * @param {number} options.limit - Количество наблюдений (по умолчанию 10)
 * @returns {Promise<Object>} Экономические данные
 */
export async function fetchEconomy(options = {}) {
    const { limit = 10 } = options;

    const apiKey = process.env.FRED_API_KEY || '';

    if (!apiKey) {
        console.warn('[FRED] API ключ не найден. Установите FRED_API_KEY в .env');
        return getDemoData();
    }

    try {
        console.log('[FRED] Запрос экономических данных...');

        const results = {};
        const errors = [];

        // Параллельный запрос всех индикаторов
        const promises = Object.entries(INDICATORS).map(async ([key, config]) => {
            try {
                const data = await fetchIndicator(config.id, apiKey, limit);
                results[key] = {
                    ...config,
                    ...data,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                errors.push({ key, error: error.message });
                results[key] = {
                    ...config,
                    error: error.message,
                    latest: null
                };
            }
        });

        await Promise.allSettled(promises);

        // Рассчитываем производные индикаторы
        const derivatives = calculateDerivatives(results);
        const stressIndex = calculateStress(results);
        const summary = getSummary(results);

        console.log(`[FRED] Загружено ${Object.keys(results).length} индикаторов (${errors.length} ошибок)`);

        return {
            success: true,
            indicators: results,
            derivatives: derivatives,
            stressIndex: stressIndex,
            summary: summary,
            source: 'FRED',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[FRED] Ошибка:', error.message);
        console.warn('[FRED] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ЗАПРОС ОДНОГО ИНДИКАТОРА
// ============================================================

async function fetchIndicator(seriesId, apiKey, limit) {
    const params = new URLSearchParams({
        series_id: seriesId,
        api_key: apiKey,
        file_type: 'json',
        sort_order: 'desc',
        limit: limit
    });

    const url = `${FRED_API}?${params}`;
    const response = await fetchWithRetry(url, { timeout: 10000 });
    const data = await response.json();

    if (!data.observations || data.observations.length === 0) {
        throw new Error(`Нет данных для ${seriesId}`);
    }

    const observations = data.observations.map(o => ({
        date: o.date,
        value: parseFloat(o.value)
    }));

    const latest = observations[0];
    const previous = observations[1] || null;

    return {
        seriesId: seriesId,
        latest: latest?.value ?? null,
        latestDate: latest?.date ?? null,
        previous: previous?.value ?? null,
        previousDate: previous?.date ?? null,
        change: (latest?.value !== undefined && previous?.value !== undefined) 
            ? parseFloat((latest.value - previous.value).toFixed(2)) 
            : null,
        changePercent: (latest?.value !== undefined && previous?.value !== undefined && previous.value !== 0)
            ? parseFloat(((latest.value - previous.value) / previous.value * 100).toFixed(2))
            : null,
        observations: observations.slice(0, limit)
    };
}

// ============================================================
// 4. РАСЧЁТ ПРОИЗВОДНЫХ ИНДИКАТОРОВ
// ============================================================

function calculateDerivatives(results) {
    const derivatives = {};

    // CPI месяц к месяцу
    if (results.CPI && results.CPI.observations && results.CPI.observations.length >= 2) {
        const obs = results.CPI.observations;
        const latest = obs[0];
        const previous = obs[1];
        if (latest.value && previous.value) {
            derivatives.CPI_MOM = {
                name: 'CPI (месяц к месяцу)',
                value: parseFloat(((latest.value - previous.value) / previous.value * 100).toFixed(2)),
                unit: '%',
                date: latest.date
            };
        }
    }

    // Реальная ставка ФРС (номинальная - инфляция)
    if (results.FED_FUNDS && results.CPI_MOM) {
        const fedFunds = results.FED_FUNDS.latest;
        const cpiMom = derivatives.CPI_MOM?.value || 0;
        if (fedFunds !== null) {
            derivatives.REAL_RATE = {
                name: 'Реальная ставка ФРС',
                value: parseFloat((fedFunds - cpiMom).toFixed(2)),
                unit: '%',
                date: results.FED_FUNDS.latestDate
            };
        }
    }

    // Индекс страха (VIX + HY Spread)
    if (results.VIX && results.HY_SPREAD) {
        const vix = results.VIX.latest || 0;
        const hy = results.HY_SPREAD.latest || 0;
        derivatives.FEAR_INDEX = {
            name: 'Индекс страха',
            value: parseFloat((vix + hy).toFixed(2)),
            unit: 'пункты',
            components: { vix, hy }
        };
    }

    return derivatives;
}

// ============================================================
// 5. РАСЧЁТ ИНДЕКСА СТРЕССА
// ============================================================

function calculateStress(results) {
    let stress = 0;
    let count = 0;
    const factors = [];

    // 1. VIX > 20 — стресс на рынке
    if (results.VIX?.latest !== null) {
        const vix = results.VIX.latest;
        const vixScore = vix > 20 ? Math.min((vix - 20) / 20, 1) : 0;
        stress += vixScore * 0.25;
        factors.push({ name: 'VIX', score: vixScore, value: vix, threshold: 20 });
        count++;
    }

    // 2. Безработица > 4.5% — стресс на рынке труда
    if (results.UNEMPLOYMENT?.latest !== null) {
        const unemp = results.UNEMPLOYMENT.latest;
        const unempScore = unemp > 4.5 ? Math.min((unemp - 4.5) / 4.5, 1) : 0;
        stress += unempScore * 0.2;
        factors.push({ name: 'Безработица', score: unempScore, value: unemp, threshold: 4.5 });
        count++;
    }

    // 3. Инфляция > 3% — стресс
    if (results.CPI?.latest !== null && results.CPI?.observations?.length >= 2) {
        const obs = results.CPI.observations;
        const cpiMom = (obs[0].value - obs[1].value) / obs[1].value * 100;
        const cpiScore = cpiMom > 0.3 ? Math.min((cpiMom - 0.3) / 0.5, 1) : 0;
        stress += cpiScore * 0.2;
        factors.push({ name: 'Инфляция (MoM)', score: cpiScore, value: cpiMom, threshold: 0.3 });
        count++;
    }

    // 4. HY Spread > 5% — кредитный стресс
    if (results.HY_SPREAD?.latest !== null) {
        const hy = results.HY_SPREAD.latest;
        const hyScore = hy > 5 ? Math.min((hy - 5) / 5, 1) : 0;
        stress += hyScore * 0.2;
        factors.push({ name: 'HY Spread', score: hyScore, value: hy, threshold: 5 });
        count++;
    }

    // 5. GSCPI > 0 — давление в цепях поставок
    if (results.GSCPI?.latest !== null) {
        const gscpi = results.GSCPI.latest;
        const gscpiScore = gscpi > 0 ? Math.min(gscpi / 2, 1) : 0;
        stress += gscpiScore * 0.15;
        factors.push({ name: 'GSCPI', score: gscpiScore, value: gscpi, threshold: 0 });
        count++;
    }

    const totalStress = count > 0 ? Math.min(Math.round((stress / (count * 0.2)) * 100) / 10, 10) : 0;

    let level = 'low';
    let color = '#22c55e';
    let label = '🟢 Низкий';

    if (totalStress >= 8) {
        level = 'critical';
        color = '#ef4444';
        label = '🔴 Критический';
    } else if (totalStress >= 6) {
        level = 'high';
        color = '#f97316';
        label = '🟠 Высокий';
    } else if (totalStress >= 4) {
        level = 'medium';
        color = '#eab308';
        label = '🟡 Средний';
    }

    return {
        score: totalStress,
        level: level,
        label: label,
        color: color,
        factors: factors,
        description: totalStress >= 6 
            ? 'Высокий уровень экономического стресса. Рекомендуется осторожность.'
            : totalStress >= 4
            ? 'Умеренный уровень стресса. Ситуация под контролем.'
            : 'Низкий уровень стресса. Экономика стабильна.'
    };
}

// ============================================================
// 6. СТАТИСТИКА
// ============================================================

function getSummary(results) {
    const summary = {
        active: 0,
        errors: 0,
        byCategory: {
            market: { active: 0, errors: 0 },
            credit: { active: 0, errors: 0 },
            inflation: { active: 0, errors: 0 },
            labor: { active: 0, errors: 0 },
            monetary: { active: 0, errors: 0 },
            supply_chain: { active: 0, errors: 0 },
            growth: { active: 0, errors: 0 },
            housing: { active: 0, errors: 0 },
            fiscal: { active: 0, errors: 0 },
            sentiment: { active: 0, errors: 0 }
        }
    };

    for (const [key, data] of Object.entries(results)) {
        const category = data.category || 'unknown';
        if (data.error) {
            summary.errors++;
            if (summary.byCategory[category]) {
                summary.byCategory[category].errors++;
            }
        } else if (data.latest !== null) {
            summary.active++;
            if (summary.byCategory[category]) {
                summary.byCategory[category].active++;
            }
        }
    }

    return summary;
}

// ============================================================
// 7. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const demoTimestamp = new Date().toISOString();

    const indicators = {
        VIX: { id: 'VIXCLS', name: 'Индекс волатильности VIX', category: 'market', unit: 'пункты', latest: 24.54, latestDate: '2026-08-14', previous: 23.90, previousDate: '2026-08-13', change: 0.64, changePercent: 2.68, observations: [{ date: '2026-08-14', value: 24.54 }, { date: '2026-08-13', value: 23.90 }, { date: '2026-08-12', value: 22.15 }] },
        HY_SPREAD: { id: 'BAMLH0A0HYM2', name: 'Спред высокодоходных облигаций', category: 'credit', unit: '%', latest: 3.16, latestDate: '2026-08-14', previous: 3.08, previousDate: '2026-08-13', change: 0.08, changePercent: 2.60, observations: [{ date: '2026-08-14', value: 3.16 }, { date: '2026-08-13', value: 3.08 }] },
        CPI: { id: 'CPIAUCSL', name: 'Индекс потребительских цен (CPI)', category: 'inflation', unit: 'индекс', latest: 326.785, latestDate: '2026-08-01', previous: 325.245, previousDate: '2026-07-01', change: 1.54, changePercent: 0.47, observations: [{ date: '2026-08-01', value: 326.785 }, { date: '2026-07-01', value: 325.245 }] },
        UNEMPLOYMENT: { id: 'UNRATE', name: 'Уровень безработицы', category: 'labor', unit: '%', latest: 4.3, latestDate: '2026-08-01', previous: 4.4, previousDate: '2026-07-01', change: -0.1, changePercent: -2.27, observations: [{ date: '2026-08-01', value: 4.3 }, { date: '2026-07-01', value: 4.4 }] },
        FED_FUNDS: { id: 'FEDFUNDS', name: 'Ставка ФРС', category: 'monetary', unit: '%', latest: 3.64, latestDate: '2026-08-01', previous: 3.63, previousDate: '2026-07-01', change: 0.01, changePercent: 0.28, observations: [{ date: '2026-08-01', value: 3.64 }, { date: '2026-07-01', value: 3.63 }] },
        M2: { id: 'M2SL', name: 'Денежная масса M2', category: 'monetary', unit: 'млрд $', latest: 22.7, latestDate: '2026-08-01', previous: 22.5, previousDate: '2026-07-01', change: 0.2, changePercent: 0.89, observations: [{ date: '2026-08-01', value: 22.7 }, { date: '2026-07-01', value: 22.5 }] },
        GSCPI: { id: 'GSCPI', name: 'Индекс давления в цепях поставок', category: 'supply_chain', unit: 'индекс', latest: 0.49, latestDate: '2026-08-01', previous: 0.42, previousDate: '2026-07-01', change: 0.07, changePercent: 16.67, observations: [{ date: '2026-08-01', value: 0.49 }, { date: '2026-07-01', value: 0.42 }] },
        GDP: { id: 'GDP', name: 'ВВП США', category: 'growth', unit: 'млрд $', latest: 29285.6, latestDate: '2026-06-01', previous: 29013.2, previousDate: '2026-03-01', change: 272.4, changePercent: 0.94, observations: [{ date: '2026-06-01', value: 29285.6 }, { date: '2026-03-01', value: 29013.2 }] },
        MORTGAGE_30Y: { id: 'MORTGAGE30US', name: 'Ставка по ипотеке (30 лет)', category: 'housing', unit: '%', latest: 6.46, latestDate: '2026-08-13', previous: 6.51, previousDate: '2026-08-06', change: -0.05, changePercent: -0.77, observations: [{ date: '2026-08-13', value: 6.46 }, { date: '2026-08-06', value: 6.51 }] },
        NATIONAL_DEBT: { id: 'FYGFD', name: 'Государственный долг США', category: 'fiscal', unit: 'млрд $', latest: 39.02, latestDate: '2026-08-01', previous: 38.87, previousDate: '2026-07-01', change: 0.15, changePercent: 0.39, observations: [{ date: '2026-08-01', value: 39.02 }, { date: '2026-07-01', value: 38.87 }] },
        JOBLESS_CLAIMS: { id: 'ICSA', name: 'Первичные заявки на пособие по безработице', category: 'labor', unit: 'тыс.', latest: 202, latestDate: '2026-08-08', previous: 198, previousDate: '2026-08-01', change: 4, changePercent: 2.02, observations: [{ date: '2026-08-08', value: 202 }, { date: '2026-08-01', value: 198 }] },
        PPI: { id: 'PPIACO', name: 'Индекс цен производителей', category: 'inflation', unit: 'индекс', latest: 152.168, latestDate: '2026-08-01', previous: 151.456, previousDate: '2026-07-01', change: 0.712, changePercent: 0.47, observations: [{ date: '2026-08-01', value: 152.168 }, { date: '2026-07-01', value: 151.456 }] },
        CONSUMER_SENTIMENT: { id: 'UMCSENT', name: 'Индекс потребительского доверия', category: 'sentiment', unit: 'индекс', latest: 71.8, latestDate: '2026-08-01', previous: 70.2, previousDate: '2026-07-01', change: 1.6, changePercent: 2.28, observations: [{ date: '2026-08-01', value: 71.8 }, { date: '2026-07-01', value: 70.2 }] }
    };

    const derivatives = {
        CPI_MOM: { name: 'CPI (месяц к месяцу)', value: 0.47, unit: '%', date: '2026-08-01' },
        REAL_RATE: { name: 'Реальная ставка ФРС', value: 3.17, unit: '%', date: '2026-08-01' },
        FEAR_INDEX: { name: 'Индекс страха', value: 27.70, unit: 'пункты', components: { vix: 24.54, hy: 3.16 } }
    };

    const stressIndex = {
        score: 4.8,
        level: 'medium',
        label: '🟡 Средний',
        color: '#eab308',
        factors: [
            { name: 'VIX', score: 0.23, value: 24.54, threshold: 20 },
            { name: 'Безработица', score: 0.08, value: 4.3, threshold: 4.5 },
            { name: 'Инфляция (MoM)', score: 0.34, value: 0.47, threshold: 0.3 },
            { name: 'HY Spread', score: 0.12, value: 3.16, threshold: 5 },
            { name: 'GSCPI', score: 0.14, value: 0.49, threshold: 0 }
        ],
        description: 'Умеренный уровень стресса. Ситуация под контролем.'
    };

    const summary = {
        active: 13,
        errors: 0,
        byCategory: {
            market: { active: 1, errors: 0 },
            credit: { active: 1, errors: 0 },
            inflation: { active: 2, errors: 0 },
            labor: { active: 2, errors: 0 },
            monetary: { active: 2, errors: 0 },
            supply_chain: { active: 1, errors: 0 },
            growth: { active: 1, errors: 0 },
            housing: { active: 1, errors: 0 },
            fiscal: { active: 1, errors: 0 },
            sentiment: { active: 1, errors: 0 }
        }
    };

    return {
        success: true,
        indicators: indicators,
        derivatives: derivatives,
        stressIndex: stressIndex,
        summary: summary,
        source: 'DEMO (FRED)',
        timestamp: demoTimestamp,
        isDemo: true
    };
}

// ============================================================
// 8. API-ОБРАБОТЧИК
// ============================================================

export async function handleFREDApi(req, res) {
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
        // GET /api/fred/economy — получить все экономические данные
        if (path === '/api/fred/economy' && req.method === 'GET') {
            const params = url.searchParams;
            const limit = parseInt(params.get('limit')) || 10;

            const data = await fetchEconomy({ limit });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/fred/stress — получить индекс стресса
        if (path === '/api/fred/stress' && req.method === 'GET') {
            const data = await fetchEconomy();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                stressIndex: data.stressIndex,
                timestamp: data.timestamp
            }));
            return;
        }

        // GET /api/fred/status — статус модуля
        if (path === '/api/fred/status' && req.method === 'GET') {
            const apiKey = process.env.FRED_API_KEY || '';

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'FRED',
                status: apiKey ? 'active' : 'demo',
                apiKeySet: !!apiKey,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[FRED API] Ошибка:', error);
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
    fetchEconomy,
    handleFREDApi,
    calculateStress
};