#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №12: ЭКОНОМИЧЕСКИЙ И ФИНАНСОВЫЙ ДАШБОРД
// ============================================================

// ============================================================
// 1. ДЕМО-ДАННЫЕ
// ============================================================

const DEMO_INDICATORS = {
    vix: { name: 'VIX', value: 24.54, change: '+2.3%', status: 'warning', description: 'Индекс волатильности' },
    hySpread: { name: 'HY Spread', value: 3.16, change: '-0.12%', status: 'normal', description: 'Спред высокодоходных облигаций' },
    gscpi: { name: 'GSCPI', value: 0.49, change: '+0.08%', status: 'normal', description: 'Индекс давления в цепях поставок' },
    usdIndex: { name: 'USD Index', value: 120.9, change: '+0.4%', status: 'normal', description: 'Индекс доллара США' },
    wti: { name: 'WTI Crude', value: 112.06, change: '+1.8%', status: 'warning', description: 'Нефть WTI ($/баррель)' },
    brent: { name: 'Brent Crude', value: 109.05, change: '+1.5%', status: 'warning', description: 'Нефть Brent ($/баррель)' },
    gold: { name: 'Gold', value: 2034.50, change: '+0.6%', status: 'normal', description: 'Золото ($/унция)' },
    bitcoin: { name: 'Bitcoin', value: 66895.18, change: '+0.31%', status: 'normal', description: 'Bitcoin ($)' },
    sp500: { name: 'S&P 500', value: 6582.69, change: '+1.63%', status: 'normal', description: 'Индекс S&P 500' },
    nasdaq: { name: 'Nasdaq', value: 21879.18, change: '+2.2%', status: 'normal', description: 'Индекс Nasdaq' },
    dow: { name: 'Dow Jones', value: 46504.67, change: '+1.18%', status: 'normal', description: 'Индекс Dow Jones' },
    unemployment: { name: 'Unemployment', value: 4.3, change: '-0.1%', status: 'warning', description: 'Уровень безработицы (%)' },
    cpi: { name: 'CPI MoM', value: 0.47, change: '+0.02%', status: 'normal', description: 'Индекс потребительских цен (месяц)' },
    fedFunds: { name: 'Fed Funds', value: 3.64, change: '-0.25%', status: 'normal', description: 'Ставка ФРС (%)' }
};

const DEMO_HISTORY = {
    vix: [22.5, 23.1, 22.8, 24.2, 23.5, 24.8, 24.54],
    hySpread: [3.05, 3.10, 3.08, 3.15, 3.12, 3.18, 3.16],
    gscpi: [0.35, 0.38, 0.40, 0.42, 0.45, 0.47, 0.49],
    usdIndex: [119.2, 119.5, 119.8, 120.1, 120.5, 120.7, 120.9],
    wti: [105.2, 106.5, 107.8, 109.0, 110.5, 111.8, 112.06],
    brent: [102.5, 103.8, 105.0, 106.2, 107.5, 108.8, 109.05],
    gold: [1985.0, 1995.5, 2004.0, 2010.5, 2020.0, 2028.5, 2034.50],
    bitcoin: [65200, 65800, 66200, 66500, 66700, 66800, 66895.18],
    sp500: [6450, 6480, 6500, 6520, 6540, 6560, 6582.69],
    nasdaq: [21400, 21500, 21600, 21700, 21800, 21850, 21879.18],
    dow: [45800, 46000, 46150, 46300, 46400, 46500, 46504.67]
};

const DEMO_DATES = [
    '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10',
    '2026-08-11', '2026-08-12', '2026-08-13'
];

// ============================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getIndicators() {
    return Object.values(DEMO_INDICATORS);
}

function getIndicatorHistory(indicatorId) {
    const history = DEMO_HISTORY[indicatorId];
    if (!history) return [];
    return DEMO_DATES.map((date, i) => ({
        date: date,
        value: history[i] || history[history.length - 1]
    }));
}

function getStatusColor(status) {
    const colors = {
        normal: '#4caf50',
        warning: '#ffd700',
        critical: '#f44336',
        info: '#5bc0f8'
    };
    return colors[status] || '#888';
}

function getStatusIcon(status) {
    const icons = {
        normal: '✅',
        warning: '⚠️',
        critical: '🚨',
        info: 'ℹ️'
    };
    return icons[status] || '•';
}

function getCategories() {
    return {
        'markets': ['sp500', 'nasdaq', 'dow'],
        'crypto': ['bitcoin'],
        'commodities': ['wti', 'brent', 'gold'],
        'macro': ['vix', 'hySpread', 'gscpi', 'usdIndex', 'unemployment', 'cpi', 'fedFunds']
    };
}

function getCategoryIndicators(category) {
    const categories = getCategories();
    const ids = categories[category] || [];
    const result = [];
    for (const id of ids) {
        if (DEMO_INDICATORS[id]) {
            result.push({ id, ...DEMO_INDICATORS[id] });
        }
    }
    return result;
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleEconomyAPI(req, res) {
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
        // --- GET /api/economy/indicators ---
        if (path === '/api/economy/indicators' && req.method === 'GET') {
            const indicators = getIndicators();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: indicators.length,
                indicators: indicators,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/economy/indicator/:id ---
        if (path.startsWith('/api/economy/indicator/') && req.method === 'GET') {
            const id = path.split('/').pop();
            const indicator = DEMO_INDICATORS[id];

            if (!indicator) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Индикатор не найден' }));
                return;
            }

            const history = getIndicatorHistory(id);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                indicator: { id, ...indicator },
                history: history,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/economy/history/:id ---
        if (path.startsWith('/api/economy/history/') && req.method === 'GET') {
            const id = path.split('/').pop();
            const history = getIndicatorHistory(id);

            if (history.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'История не найдена' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                indicator: id,
                history: history,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/economy/category/:category ---
        if (path.startsWith('/api/economy/category/') && req.method === 'GET') {
            const category = path.split('/').pop();
            const indicators = getCategoryIndicators(category);

            if (indicators.length === 0) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Категория не найдена' }));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                category: category,
                indicators: indicators,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/economy/categories ---
        if (path === '/api/economy/categories' && req.method === 'GET') {
            const categories = getCategories();
            const result = [];
            for (const [key, ids] of Object.entries(categories)) {
                const indicators = ids.map(id => ({ id, ...DEMO_INDICATORS[id] })).filter(i => i.name);
                result.push({
                    name: key,
                    count: indicators.length,
                    indicators: indicators
                });
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                categories: result,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/economy/status ---
        if (path === '/api/economy/status' && req.method === 'GET') {
            const indicators = getIndicators();
            const statuses = {
                normal: indicators.filter(i => i.status === 'normal').length,
                warning: indicators.filter(i => i.status === 'warning').length,
                critical: indicators.filter(i => i.status === 'critical').length
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                total: indicators.length,
                statuses: statuses,
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
        console.error('[Economy API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleEconomyAPI };
