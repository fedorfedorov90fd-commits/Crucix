#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №13: АНАЛИТИЧЕСКИЕ ЦЕНТРЫ И ПРОГНОЗНЫЕ ОТЧЁТЫ
// ============================================================

// ============================================================
// 1. ДАННЫЕ О ЦЕНТРАХ
// ============================================================

const THINK_TANKS = [
    {
        id: 'rand',
        name: 'RAND Corporation',
        country: 'США',
        city: 'Santa Monica, CA',
        founded: 1948,
        focus: ['Стратегические исследования', 'Безопасность', 'Технологии'],
        website: 'https://www.rand.org',
        active: true
    },
    {
        id: 'csis',
        name: 'CSIS',
        country: 'США',
        city: 'Washington, DC',
        founded: 1962,
        focus: ['Международная безопасность', 'Геополитика', 'Экономика'],
        website: 'https://www.csis.org',
        active: true
    },
    {
        id: 'iiss',
        name: 'IISS',
        country: 'Великобритания',
        city: 'London',
        founded: 1958,
        focus: ['Военные исследования', 'Оборона', 'Стратегия'],
        website: 'https://www.iiss.org',
        active: true
    },
    {
        id: 'chatham',
        name: 'Chatham House',
        country: 'Великобритания',
        city: 'London',
        founded: 1920,
        focus: ['Международные отношения', 'Политика', 'Экономика'],
        website: 'https://www.chathamhouse.org',
        active: true
    },
    {
        id: 'cfr',
        name: 'Council on Foreign Relations',
        country: 'США',
        city: 'New York, NY',
        founded: 1921,
        focus: ['Внешняя политика', 'Международные отношения', 'Безопасность'],
        website: 'https://www.cfr.org',
        active: true
    },
    {
        id: 'brookings',
        name: 'Brookings Institution',
        country: 'США',
        city: 'Washington, DC',
        founded: 1916,
        focus: ['Публичная политика', 'Экономика', 'Геополитика'],
        website: 'https://www.brookings.edu',
        active: true
    },
    {
        id: 'carnegie',
        name: 'Carnegie Endowment',
        country: 'США / Россия',
        city: 'Washington, DC / Moscow',
        founded: 1910,
        focus: ['Глобальные проблемы', 'Международные отношения', 'Ядерная политика'],
        website: 'https://carnegieendowment.org',
        active: true
    },
    {
        id: 'swp',
        name: 'SWP (Stiftung Wissenschaft und Politik)',
        country: 'Германия',
        city: 'Berlin',
        founded: 1962,
        focus: ['Международная политика', 'Безопасность', 'Европа'],
        website: 'https://www.swp-berlin.org',
        active: true
    },
    {
        id: 'rusi',
        name: 'RUSI',
        country: 'Великобритания',
        city: 'London',
        founded: 1831,
        focus: ['Оборона', 'Безопасность', 'Военные исследования'],
        website: 'https://www.rusi.org',
        active: true
    },
    {
        id: 'isw',
        name: 'ISW (Institute for the Study of War)',
        country: 'США',
        city: 'Washington, DC',
        founded: 2007,
        focus: ['Военные конфликты', 'Безопасность', 'Геополитика'],
        website: 'https://www.understandingwar.org',
        active: true
    }
];

// ============================================================
// 2. ДЕМО-ОТЧЁТЫ
// ============================================================

const DEMO_REPORTS = [
    {
        id: 'rpt-001',
        center: 'isw',
        title: 'Russian Offensive Campaign Assessment',
        date: '2026-08-13',
        region: 'ukraine',
        summary: 'Russia continues offensive operations in Donetsk Oblast. Ukrainian forces maintain defensive positions.',
        keyPoints: ['Russian advances in Donetsk', 'Ukrainian counterattacks', 'Stalemate on frontlines'],
        confidence: 85,
        severity: 'high',
        tags: ['military', 'ukraine', 'russia'],
        url: 'https://www.understandingwar.org'
    },
    {
        id: 'rpt-002',
        center: 'rand',
        title: 'Middle East Conflict Dynamics',
        date: '2026-08-12',
        region: 'middle-east',
        summary: 'Escalation risks in the Persian Gulf. Iran-US tensions remain high with potential for military confrontation.',
        keyPoints: ['Iran-US tensions', 'Gulf security', 'Energy market risks'],
        confidence: 75,
        severity: 'high',
        tags: ['middle-east', 'iran', 'energy'],
        url: 'https://www.rand.org'
    },
    {
        id: 'rpt-003',
        center: 'iiss',
        title: 'Military Balance 2026',
        date: '2026-08-10',
        region: 'global',
        summary: 'Global military spending continues to rise. China and Russia increase defence budgets significantly.',
        keyPoints: ['Military spending growth', 'Arms race', 'Strategic shifts'],
        confidence: 90,
        severity: 'medium',
        tags: ['military', 'global', 'strategy'],
        url: 'https://www.iiss.org'
    },
    {
        id: 'rpt-004',
        center: 'chatham',
        title: 'Europe Security After Ukraine',
        date: '2026-08-11',
        region: 'europe',
        summary: 'NATO expansion and European security architecture. Challenges in the post-war era.',
        keyPoints: ['NATO expansion', 'European defence', 'Russian relations'],
        confidence: 80,
        severity: 'medium',
        tags: ['europe', 'nato', 'security'],
        url: 'https://www.chathamhouse.org'
    },
    {
        id: 'rpt-005',
        center: 'cfr',
        title: 'South China Sea Strategic Update',
        date: '2026-08-09',
        region: 'asia-pacific',
        summary: 'Increased Chinese military presence in the South China Sea. US-Philippines cooperation intensifies.',
        keyPoints: ['China military expansion', 'US alliances', 'Regional tensions'],
        confidence: 85,
        severity: 'high',
        tags: ['asia-pacific', 'china', 'maritime'],
        url: 'https://www.cfr.org'
    },
    {
        id: 'rpt-006',
        center: 'carnegie',
        title: 'Nuclear Risk Assessment',
        date: '2026-08-08',
        region: 'global',
        summary: 'Nuclear proliferation risks increase. Iran and North Korea nuclear programs continue to advance.',
        keyPoints: ['Nuclear proliferation', 'Iran nuclear program', 'North Korea'],
        confidence: 70,
        severity: 'critical',
        tags: ['nuclear', 'iran', 'north-korea'],
        url: 'https://carnegieendowment.org'
    },
    {
        id: 'rpt-007',
        center: 'brookings',
        title: 'Global Economic Outlook',
        date: '2026-08-07',
        region: 'global',
        summary: 'Inflation concerns persist. Central banks maintain high interest rates. Growth slows in major economies.',
        keyPoints: ['Inflation', 'Interest rates', 'Economic slowdown'],
        confidence: 75,
        severity: 'medium',
        tags: ['economy', 'global', 'inflation'],
        url: 'https://www.brookings.edu'
    },
    {
        id: 'rpt-008',
        center: 'swp',
        title: 'EU Strategic Autonomy',
        date: '2026-08-06',
        region: 'europe',
        summary: 'European defence integration progresses. New security initiatives emerge.',
        keyPoints: ['EU defence', 'Strategic autonomy', 'Transatlantic relations'],
        confidence: 70,
        severity: 'medium',
        tags: ['europe', 'eu', 'defence'],
        url: 'https://www.swp-berlin.org'
    }
];

// ============================================================
// 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getCenters() {
    return THINK_TANKS;
}

function getCenter(id) {
    return THINK_TANKS.find(c => c.id === id);
}

function getReports(params = {}) {
    let reports = [...DEMO_REPORTS];
    if (params.center) {
        reports = reports.filter(r => r.center === params.center);
    }
    if (params.region) {
        reports = reports.filter(r => r.region === params.region);
    }
    if (params.severity) {
        reports = reports.filter(r => r.severity === params.severity);
    }
    return reports;
}

function getReport(id) {
    return DEMO_REPORTS.find(r => r.id === id);
}

function getPredictions() {
    return [
        {
            id: 'pred-001',
            center: 'rand',
            title: 'Iran-Israel Escalation Risk',
            date: '2026-08-14',
            prediction: 'Probability of direct Iran-Israel conflict increased to 65% in next 60 days',
            confidence: 78,
            timeframe: '60 days',
            region: 'middle-east'
        },
        {
            id: 'pred-002',
            center: 'isw',
            title: 'Ukraine War Outlook',
            date: '2026-08-14',
            prediction: 'Stalemate continues through autumn. No major territorial changes expected.',
            confidence: 82,
            timeframe: '3 months',
            region: 'ukraine'
        },
        {
            id: 'pred-003',
            center: 'cfr',
            title: 'US-China Relations',
            date: '2026-08-13',
            prediction: 'US-China tensions remain elevated. Risk of incident in South China Sea.',
            confidence: 70,
            timeframe: '30 days',
            region: 'asia-pacific'
        },
        {
            id: 'pred-004',
            center: 'carnegie',
            title: 'Nuclear Proliferation',
            date: '2026-08-13',
            prediction: 'Iran nuclear program moves closer to weapons capability. Diplomatic window narrowing.',
            confidence: 65,
            timeframe: '90 days',
            region: 'global'
        }
    ];
}

function getSummary() {
    const reports = DEMO_REPORTS;
    const total = reports.length;
    const bySeverity = {
        critical: reports.filter(r => r.severity === 'critical').length,
        high: reports.filter(r => r.severity === 'high').length,
        medium: reports.filter(r => r.severity === 'medium').length,
        low: reports.filter(r => r.severity === 'low').length
    };
    const byRegion = {};
    for (const r of reports) {
        if (!byRegion[r.region]) byRegion[r.region] = 0;
        byRegion[r.region]++;
    }
    const avgConfidence = Math.round(reports.reduce((s, r) => s + r.confidence, 0) / reports.length);

    return {
        totalReports: total,
        bySeverity: bySeverity,
        byRegion: byRegion,
        avgConfidence: avgConfidence,
        lastUpdate: new Date().toISOString()
    };
}

function getRegions() {
    const regions = {};
    for (const r of DEMO_REPORTS) {
        if (!regions[r.region]) {
            regions[r.region] = { total: 0, reports: [] };
        }
        regions[r.region].total++;
        regions[r.region].reports.push(r);
    }
    return Object.entries(regions).map(([key, value]) => ({
        name: key,
        ...value
    }));
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleThinkTanksAPI(req, res) {
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
        // --- GET /api/thinktanks/centers ---
        if (path === '/api/thinktanks/centers' && req.method === 'GET') {
            const centers = getCenters();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: centers.length,
                centers: centers,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/thinktanks/reports ---
        if (path === '/api/thinktanks/reports' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const filters = {
                center: params.get('center') || undefined,
                region: params.get('region') || undefined,
                severity: params.get('severity') || undefined
            };
            const reports = getReports(filters);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: reports.length,
                reports: reports,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/thinktanks/report/:id ---
        if (path.startsWith('/api/thinktanks/report/') && req.method === 'GET') {
            const id = path.split('/').pop();
            const report = getReport(id);
            if (!report) {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Отчёт не найден' }));
                return;
            }
            const center = getCenter(report.center);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                report: { ...report, center: center },
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/thinktanks/predictions ---
        if (path === '/api/thinktanks/predictions' && req.method === 'GET') {
            const predictions = getPredictions();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: predictions.length,
                predictions: predictions,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/thinktanks/summary ---
        if (path === '/api/thinktanks/summary' && req.method === 'GET') {
            const summary = getSummary();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                ...summary,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/thinktanks/regions ---
        if (path === '/api/thinktanks/regions' && req.method === 'GET') {
            const regions = getRegions();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                regions: regions,
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
        console.error('[ThinkTanks API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleThinkTanksAPI };
