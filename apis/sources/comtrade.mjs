#!/usr/bin/env node

// ============================================================
// COMTRADE — ТОРГОВАЯ СТАТИСТИКА ООН
// ============================================================
// Источник: UN Comtrade Database
// Данные: экспорт, импорт, торговые потоки, баланс
// Версия: 2.0 (профессиональная, единый стиль)
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// UN Comtrade API
const COMTRADE_API = 'https://comtradeapi.un.org/data/v1';
const COMTRADE_BASE = 'https://comtrade.un.org/api/get';

// Коды стран (выборочно)
const COUNTRY_CODES = {
    'WORLD': 'all',
    'USA': '842',
    'CHN': '156',
    'RUS': '643',
    'IND': '356',
    'DEU': '276',
    'JPN': '392',
    'GBR': '826',
    'FRA': '250',
    'ITA': '380',
    'BRA': '076',
    'CAN': '124',
    'AUS': '036',
    'KOR': '410',
    'MEX': '484',
    'TUR': '792',
    'SAU': '682',
    'ARE': '784',
    'CHE': '756',
    'NLD': '528',
    'POL': '616',
    'UKR': '804',
    'IRN': '364',
    'ISR': '376',
    'EGY': '818',
    'ZAF': '710',
    'NGA': '566',
    'PAK': '586',
    'VNM': '704',
    'SGP': '702'
};

// Категории товаров (HS коды)
const COMMODITY_CODES = {
    'ALL': 'all',
    'FUEL': '27',          // Нефть и топливо
    'ELECTRONICS': '85',   // Электроника
    'VEHICLES': '87',      // Автомобили
    'MACHINERY': '84',     // Машины и оборудование
    'CHEMICALS': '28',     // Химия
    'FOOD': '01,02,03,04', // Продовольствие
    'MEDICAL': '30',       // Фармацевтика
    'WEAPONS': '93',       // Оружие
    'METALS': '72,73',     // Металлы
    'TEXTILES': '50-63',   // Текстиль
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function fetchTradeData(options = {}) {
    const {
        reporter = null,      // Код страны-отчётчика
        partner = null,       // Код страны-партнёра
        commodity = null,     // Код товара
        year = null,          // Год
        flow = null,          // M (импорт) или X (экспорт)
        limit = 50
    } = options;

    try {
        console.log('[Comtrade] Запрос торговых данных...');

        // Получаем данные
        let data = [];
        try {
            data = await fetchComtradeData(reporter, partner, commodity, year, flow);
        } catch (e) {
            console.warn('[Comtrade] Ошибка при получении данных:', e.message);
        }

        // Если данных нет — используем демо
        if (data.length === 0) {
            console.log('[Comtrade] Реальные данные недоступны, использую демо-данные');
            return getDemoData();
        }

        // Сортируем по дате (новые сверху)
        data.sort((a, b) => {
            const dateA = a.year || 0;
            const dateB = b.year || 0;
            return dateB - dateA;
        });

        // Статистика
        const summary = getTradeSummary(data);
        const anomalies = detectTradeAnomalies(data);

        console.log(`[Comtrade] Получено ${data.length} записей`);

        return {
            success: true,
            count: data.length,
            data: data.slice(0, limit),
            summary: summary,
            anomalies: anomalies,
            source: 'UN Comtrade Database',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[Comtrade] Ошибка:', error.message);
        console.warn('[Comtrade] Использую демо-данные');
        return getDemoData();
    }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ДАННЫХ ИЗ UN COMTRADE
// ============================================================

async function fetchComtradeData(reporter, partner, commodity, year, flow) {
    try {
        // Конструируем URL
        const params = new URLSearchParams({
            max: 100,
            type: 'C',
            freq: 'A',
            px: 'HS',
            ps: year || '2023,2022,2021,2020',
            r: reporter || 'all',
            p: partner || 'all',
            cc: commodity || 'all',
            fmt: 'json'
        });

        if (flow) {
            params.append('rg', flow);
        }

        const url = `${COMTRADE_BASE}?${params}`;
        console.log(`[Comtrade] Запрос: ${url}`);

        const response = await fetchWithRetry(url, { timeout: 20000 });
        const text = await response.text();

        if (!text.trim().startsWith('{')) {
            console.warn('[Comtrade] API вернул не JSON, пропускаем');
            return [];
        }

        const data = JSON.parse(text);

        if (data && data.dataset) {
            return data.dataset.map(item => ({
                id: `${item.year}-${item.reporterCode}-${item.partnerCode}-${item.cmdCode}`,
                year: parseInt(item.year) || 0,
                reporter: item.reporterDesc || 'Unknown',
                reporterCode: item.reporterCode || 0,
                partner: item.partnerDesc || 'Unknown',
                partnerCode: item.partnerCode || 0,
                flow: item.rgDesc || 'Trade',
                flowCode: item.rgCode || 0,
                commodity: item.cmdDesc || 'Unknown',
                commodityCode: item.cmdCode || 0,
                value: parseFloat(item.tradeValue) || 0,
                quantity: parseFloat(item.qt) || 0,
                unit: item.qtDesc || 'Unknown',
                source: 'UN Comtrade'
            }));
        }
        return [];
    } catch (e) {
        console.warn('[Comtrade] Не удалось получить данные:', e.message);
        return [];
    }
}

// ============================================================
// 4. СТАТИСТИКА
// ============================================================

function getTradeSummary(data) {
    const summary = {
        total: data.length,
        byYear: {},
        byReporter: {},
        byPartner: {},
        byCommodity: {},
        totalExports: 0,
        totalImports: 0,
        tradeBalance: 0
    };

    for (const d of data) {
        // По годам
        const year = d.year || 0;
        summary.byYear[year] = (summary.byYear[year] || 0) + 1;

        // По странам-отчётчикам
        const reporter = d.reporter || 'Unknown';
        summary.byReporter[reporter] = (summary.byReporter[reporter] || 0) + 1;

        // По странам-партнёрам
        const partner = d.partner || 'Unknown';
        summary.byPartner[partner] = (summary.byPartner[partner] || 0) + 1;

        // По товарам
        const commodity = d.commodity || 'Unknown';
        summary.byCommodity[commodity] = (summary.byCommodity[commodity] || 0) + 1;

        // Суммы
        if (d.flow === 'Export' || d.flow === 'Exports') {
            summary.totalExports += d.value || 0;
        } else if (d.flow === 'Import' || d.flow === 'Imports') {
            summary.totalImports += d.value || 0;
        }
    }

    summary.tradeBalance = summary.totalExports - summary.totalImports;

    return summary;
}

// ============================================================
// 5. ДЕТЕКТОР АНОМАЛИЙ
// ============================================================

function detectTradeAnomalies(data) {
    const anomalies = [];

    // 1. Большой дисбаланс торговли
    let totalExports = 0;
    let totalImports = 0;
    for (const d of data) {
        if (d.flow === 'Export' || d.flow === 'Exports') {
            totalExports += d.value || 0;
        } else if (d.flow === 'Import' || d.flow === 'Imports') {
            totalImports += d.value || 0;
        }
    }

    if (totalExports > 0 && totalImports > 0) {
        const ratio = totalExports / totalImports;
        if (ratio > 2) {
            anomalies.push({
                type: 'export_dominance',
                severity: 'high',
                description: `Экспорт превышает импорт в ${ratio.toFixed(1)} раз`,
                exports: totalExports,
                imports: totalImports
            });
        } else if (ratio < 0.5) {
            anomalies.push({
                type: 'import_dominance',
                severity: 'high',
                description: `Импорт превышает экспорт в ${(1/ratio).toFixed(1)} раз`,
                exports: totalExports,
                imports: totalImports
            });
        }
    }

    // 2. Торговля оружием
    const weapons = data.filter(d => 
        d.commodity && (d.commodity.includes('weapon') || 
        d.commodity.includes('arms') || 
        d.commodity.includes('munitions'))
    );
    if (weapons.length > 0) {
        anomalies.push({
            type: 'weapons_trade',
            severity: 'medium',
            count: weapons.length,
            description: `${weapons.length} записей по торговле оружием`,
            examples: weapons.slice(0, 3).map(w => `${w.commodity} (${w.reporter} → ${w.partner})`).join(', ')
        });
    }

    // 3. Энергоресурсы
    const fuel = data.filter(d => 
        d.commodity && (d.commodity.includes('oil') || 
        d.commodity.includes('gas') || 
        d.commodity.includes('petroleum'))
    );
    if (fuel.length > 0) {
        anomalies.push({
            type: 'energy_trade',
            severity: 'low',
            count: fuel.length,
            description: `${fuel.length} записей по торговле энергоресурсами`,
            examples: fuel.slice(0, 3).map(f => `${f.commodity} (${f.reporter})`).join(', ')
        });
    }

    return anomalies;
}

// ============================================================
// 6. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoData() {
    const now = new Date();
    const data = [];

    // Торговые потоки между странами
    const tradeFlows = [
        { reporter: 'USA', partner: 'CHN', commodity: 'Electronics', flow: 'Import', value: 500 },
        { reporter: 'USA', partner: 'CHN', commodity: 'Machinery', flow: 'Import', value: 350 },
        { reporter: 'USA', partner: 'MEX', commodity: 'Vehicles', flow: 'Import', value: 280 },
        { reporter: 'USA', partner: 'CAN', commodity: 'Vehicles', flow: 'Import', value: 220 },
        { reporter: 'USA', partner: 'DEU', commodity: 'Vehicles', flow: 'Import', value: 180 },
        { reporter: 'USA', partner: 'JPN', commodity: 'Vehicles', flow: 'Import', value: 150 },
        { reporter: 'USA', partner: 'KOR', commodity: 'Electronics', flow: 'Import', value: 120 },
        { reporter: 'USA', partner: 'VNM', commodity: 'Textiles', flow: 'Import', value: 80 },
        { reporter: 'USA', partner: 'IND', commodity: 'IT Services', flow: 'Import', value: 60 },
        { reporter: 'USA', partner: 'RUS', commodity: 'Oil', flow: 'Import', value: 40 },
        { reporter: 'USA', partner: 'SAU', commodity: 'Oil', flow: 'Import', value: 35 },
        { reporter: 'USA', partner: 'GBR', commodity: 'Chemicals', flow: 'Import', value: 30 },
        { reporter: 'USA', partner: 'FRA', commodity: 'Chemicals', flow: 'Import', value: 25 },
        { reporter: 'USA', partner: 'ITA', commodity: 'Machinery', flow: 'Import', value: 20 },
        { reporter: 'USA', partner: 'BRA', commodity: 'Food', flow: 'Import', value: 15 },
        { reporter: 'USA', partner: 'AUS', commodity: 'Metals', flow: 'Import', value: 10 },
    ];

    // Экспорт США
    const usExports = [
        { reporter: 'USA', partner: 'CAN', commodity: 'Machinery', flow: 'Export', value: 300 },
        { reporter: 'USA', partner: 'MEX', commodity: 'Machinery', flow: 'Export', value: 250 },
        { reporter: 'USA', partner: 'CHN', commodity: 'Agricultural', flow: 'Export', value: 150 },
        { reporter: 'USA', partner: 'JPN', commodity: 'Aerospace', flow: 'Export', value: 100 },
        { reporter: 'USA', partner: 'KOR', commodity: 'Electronics', flow: 'Export', value: 80 },
        { reporter: 'USA', partner: 'DEU', commodity: 'Vehicles', flow: 'Export', value: 70 },
        { reporter: 'USA', partner: 'GBR', commodity: 'Pharmaceuticals', flow: 'Export', value: 60 },
        { reporter: 'USA', partner: 'FRA', commodity: 'Aerospace', flow: 'Export', value: 50 },
        { reporter: 'USA', partner: 'BRA', commodity: 'Machinery', flow: 'Export', value: 40 },
        { reporter: 'USA', partner: 'AUS', commodity: 'Aerospace', flow: 'Export', value: 30 },
    ];

    // Добавляем все записи
    const allFlows = [...tradeFlows, ...usExports];

    for (let i = 0; i < allFlows.length; i++) {
        const f = allFlows[i];
        const year = 2024 - Math.floor(i / 5);
        const month = (i % 12) + 1;

        data.push({
            id: `trade-${i}`,
            year: year,
            reporter: f.reporter,
            reporterCode: COUNTRY_CODES[f.reporter] || 0,
            partner: f.partner,
            partnerCode: COUNTRY_CODES[f.partner] || 0,
            flow: f.flow,
            flowCode: f.flow === 'Import' ? 1 : 2,
            commodity: f.commodity,
            commodityCode: COMMODITY_CODES[f.commodity] || '00',
            value: f.value * (1 + Math.random() * 0.2),
            quantity: f.value * 10,
            unit: 'USD (Millions)',
            source: 'UN Comtrade (DEMO)'
        });
    }

    // Сортируем по году (новые сверху)
    data.sort((a, b) => b.year - a.year);

    const summary = getTradeSummary(data);
    const anomalies = detectTradeAnomalies(data);

    console.log(`[Comtrade] Сгенерировано ${data.length} демо-записей`);

    return {
        success: true,
        count: data.length,
        data: data,
        summary: summary,
        anomalies: anomalies,
        source: 'UN Comtrade Database (DEMO)',
        timestamp: new Date().toISOString(),
        isDemo: true
    };
}

// ============================================================
// 7. API-ОБРАБОТЧИК
// ============================================================

export async function handleComtradeAPI(req, res) {
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
        // GET /api/comtrade/data — получить торговые данные
        if (path === '/api/comtrade/data' && req.method === 'GET') {
            const params = url.searchParams;
            const reporter = params.get('reporter') || null;
            const partner = params.get('partner') || null;
            const commodity = params.get('commodity') || null;
            const year = params.get('year') || null;
            const flow = params.get('flow') || null;
            const limit = parseInt(params.get('limit')) || 50;

            const data = await fetchTradeData({
                reporter,
                partner,
                commodity,
                year,
                flow,
                limit
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
            return;
        }

        // GET /api/comtrade/status — статус модуля
        if (path === '/api/comtrade/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'Comtrade',
                status: 'active',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[Comtrade API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 8. ЭКСПОРТ
// ============================================================

export default {
    fetchTradeData,
    handleComtradeAPI,
    getTradeSummary,
    detectTradeAnomalies
};