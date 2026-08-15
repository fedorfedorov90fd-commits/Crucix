#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №16: СИМУЛЯТОР СЦЕНАРИЕВ «ЧТО-ЕСЛИ»
// ============================================================

// ============================================================
// 1. ПРЕСЕТЫ СЦЕНАРИЕВ
// ============================================================

const PRESETS = [
    {
        id: 'preset-001',
        name: 'Военная эскалация',
        description: 'Усиление военного конфликта в регионе, увеличение числа атак',
        category: 'military',
        severity: 'high',
        parameters: {
            militaryActivity: 8,
            economicImpact: 6,
            diplomaticTension: 9,
            humanitarianImpact: 7,
            globalIndexImpact: 25
        }
    },
    {
        id: 'preset-002',
        name: 'Дипломатическое урегулирование',
        description: 'Подписание мирного договора, снижение напряжённости',
        category: 'diplomatic',
        severity: 'positive',
        parameters: {
            militaryActivity: 2,
            economicImpact: 3,
            diplomaticTension: 2,
            humanitarianImpact: 3,
            globalIndexImpact: -15
        }
    },
    {
        id: 'preset-003',
        name: 'Экономический кризис',
        description: 'Обвал финансовых рынков, рост инфляции, дефицит ресурсов',
        category: 'economic',
        severity: 'high',
        parameters: {
            militaryActivity: 4,
            economicImpact: 9,
            diplomaticTension: 6,
            humanitarianImpact: 8,
            globalIndexImpact: 35
        }
    },
    {
        id: 'preset-004',
        name: 'Крупная кибератака',
        description: 'Атака на критическую инфраструктуру, нарушение работы систем',
        category: 'cyber',
        severity: 'high',
        parameters: {
            militaryActivity: 3,
            economicImpact: 7,
            diplomaticTension: 8,
            humanitarianImpact: 5,
            globalIndexImpact: 20
        }
    },
    {
        id: 'preset-005',
        name: 'Природная катастрофа',
        description: 'Землетрясение, наводнение или пандемия с глобальными последствиями',
        category: 'natural',
        severity: 'medium',
        parameters: {
            militaryActivity: 2,
            economicImpact: 6,
            diplomaticTension: 4,
            humanitarianImpact: 9,
            globalIndexImpact: 12
        }
    },
    {
        id: 'preset-006',
        name: 'Технологический прорыв',
        description: 'Прорыв в области энергетики или AI, меняющий баланс сил',
        category: 'technology',
        severity: 'positive',
        parameters: {
            militaryActivity: 3,
            economicImpact: 8,
            diplomaticTension: 5,
            humanitarianImpact: 6,
            globalIndexImpact: -8
        }
    }
];

// ============================================================
// 2. ИСТОРИЯ ЗАПУСКОВ
// ============================================================

let history = [];

// ============================================================
// 3. ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

function getPresets() {
    return PRESETS;
}

function getPreset(id) {
    return PRESETS.find(p => p.id === id);
}

function runScenario(params, presetId = null) {
    const baseIndex = 37; // Текущий глобальный индекс
    let indexImpact = 0;

    // Рассчёт влияния на индекс
    if (presetId) {
        const preset = getPreset(presetId);
        if (preset) {
            indexImpact = preset.parameters.globalIndexImpact || 0;
        }
    } else {
        // Ручной расчёт на основе параметров
        const weights = {
            militaryActivity: 0.3,
            economicImpact: 0.25,
            diplomaticTension: 0.25,
            humanitarianImpact: 0.2
        };
        for (const [key, weight] of Object.entries(weights)) {
            if (params[key] !== undefined) {
                indexImpact += (params[key] / 10) * weight * 40;
            }
        }
        indexImpact = Math.round(indexImpact);
    }

    const newIndex = Math.max(0, Math.min(100, baseIndex + indexImpact));

    // Определение уровня
    let level = 'normal';
    if (newIndex >= 70) level = 'critical';
    else if (newIndex >= 50) level = 'high';
    else if (newIndex >= 30) level = 'medium';

    // Создание результата
    const result = {
        id: `scenario-${Date.now()}`,
        timestamp: new Date().toISOString(),
        baseIndex: baseIndex,
        newIndex: newIndex,
        impact: indexImpact,
        level: level,
        params: params,
        presetId: presetId,
        summary: generateSummary(params, presetId, indexImpact)
    };

    // Сохраняем в историю
    history.unshift(result);
    if (history.length > 50) history = history.slice(0, 50);

    return result;
}

function generateSummary(params, presetId, impact) {
    let summary = '';
    if (presetId) {
        const preset = getPreset(presetId);
        if (preset) {
            summary = `Сценарий "${preset.name}": `;
        }
    }

    const direction = impact > 0 ? 'повышение' : 'снижение';
    const absImpact = Math.abs(impact);
    summary += `${direction} глобального индекса на ${absImpact} пунктов`;

    if (absImpact > 20) {
        summary += ' (значительное изменение)';
    } else if (absImpact > 10) {
        summary += ' (умеренное изменение)';
    } else {
        summary += ' (незначительное изменение)';
    }

    return summary;
}

function compareScenarios(scenarioIds) {
    const results = [];
    for (const id of scenarioIds) {
        const entry = history.find(h => h.id === id);
        if (entry) {
            results.push(entry);
        }
    }
    return results;
}

function getHistory(limit = 10) {
    return history.slice(0, limit);
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleScenariosAPI(req, res) {
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
        // --- GET /api/scenarios/presets ---
        if (path === '/api/scenarios/presets' && req.method === 'GET') {
            const presets = getPresets();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: presets.length,
                presets: presets,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/scenarios/run ---
        if (path === '/api/scenarios/run' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const presetId = data.presetId || null;
                    const params = data.params || {};

                    const result = runScenario(params, presetId);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        result: result,
                        timestamp: new Date().toISOString()
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- POST /api/scenarios/compare ---
        if (path === '/api/scenarios/compare' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const ids = data.ids || [];
                    const results = compareScenarios(ids);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        count: results.length,
                        results: results,
                        timestamp: new Date().toISOString()
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/scenarios/history ---
        if (path === '/api/scenarios/history' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const limit = parseInt(params.get('limit')) || 10;
            const historyData = getHistory(limit);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: historyData.length,
                history: historyData,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/scenarios/list ---
        if (path === '/api/scenarios/list' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                presets: getPresets(),
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
        console.error('[Scenarios API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleScenariosAPI };
