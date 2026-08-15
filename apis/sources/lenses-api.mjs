#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №20: ТЕМАТИЧЕСКИЕ ЛИНЗЫ (ПРОФИЛИ ИНТЕРФЕЙСА)
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'lenses');
const LENSES_FILE = join(DATA_DIR, 'lenses.json');

// ============================================================
// 1. ПРЕСЕТЫ ЛИНЗ
// ============================================================

const PRESET_LENSES = [
    {
        id: 'geopolitics',
        name: 'Геополитика',
        icon: '🌍',
        description: 'Фокус на геополитических событиях и аналитике',
        modules: ['geo-map', 'global-index', 'historical-analysis', 'thinktanks', 'silence', 'live'],
        color: '#5bc0f8'
    },
    {
        id: 'economy',
        name: 'Экономика',
        icon: '💰',
        description: 'Фокус на экономических индикаторах и финансах',
        modules: ['economy', 'shipping', 'scenarios', 'live', 'global-index'],
        color: '#4caf50'
    },
    {
        id: 'security',
        name: 'Безопасность',
        icon: '🛡️',
        description: 'Фокус на безопасности и киберугрозах',
        modules: ['cyber', 'aviation', 'infrastructure', 'satellite', 'silence'],
        color: '#f44336'
    },
    {
        id: 'technology',
        name: 'Технологии',
        icon: '💻',
        description: 'Фокус на технологических трендах и инновациях',
        modules: ['nlp', 'satellite', 'live', 'cyber', 'economy'],
        color: '#9c27b0'
    }
];

// ============================================================
// 2. РАБОТА С ДАННЫМИ
// ============================================================

async function ensureDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {}
}

async function loadLensesData() {
    await ensureDir();
    try {
        const data = await fs.readFile(LENSES_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return {
            current: 'geopolitics',
            custom: [],
            history: []
        };
    }
}

async function saveLensesData(data) {
    await ensureDir();
    await fs.writeFile(LENSES_FILE, JSON.stringify(data, null, 2));
}

function getAvailableLenses() {
    return PRESET_LENSES;
}

function getLens(id) {
    return PRESET_LENSES.find(l => l.id === id);
}

function getAllModules() {
    return [
        { id: 'geo-map', name: 'Геополитическая карта', icon: '🗺️' },
        { id: 'global-index', name: 'Глобальный индекс', icon: '📊' },
        { id: 'historical-analysis', name: 'Исторический анализ', icon: '📈' },
        { id: 'thinktanks', name: 'Аналитические центры', icon: '🏛️' },
        { id: 'silence', name: 'Детектор тишины', icon: '🔇' },
        { id: 'live', name: 'Лента новостей', icon: '📰' },
        { id: 'economy', name: 'Экономический дашборд', icon: '💰' },
        { id: 'shipping', name: 'Морской трекинг', icon: '🚢' },
        { id: 'scenarios', name: 'Симулятор сценариев', icon: '🎲' },
        { id: 'cyber', name: 'Киберинтеллект', icon: '🛡️' },
        { id: 'aviation', name: 'Военная авиация', icon: '🛩️' },
        { id: 'infrastructure', name: 'Критическая инфраструктура', icon: '🏗️' },
        { id: 'satellite', name: 'Спутниковый мониторинг', icon: '🛰️' },
        { id: 'nlp', name: 'Смысловой анализ', icon: '🌐' }
    ];
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleLensesAPI(req, res) {
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
        const data = await loadLensesData();

        // --- GET /api/lenses/list ---
        if (path === '/api/lenses/list' && req.method === 'GET') {
            const lenses = getAvailableLenses();
            const custom = data.custom || [];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                presets: lenses,
                custom: custom,
                all: [...lenses, ...custom],
                current: data.current || 'geopolitics',
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- GET /api/lenses/current ---
        if (path === '/api/lenses/current' && req.method === 'GET') {
            const currentId = data.current || 'geopolitics';
            const lens = getLens(currentId) || PRESET_LENSES[0];
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                lens: lens,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/lenses/switch ---
        if (path === '/api/lenses/switch' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const payload = JSON.parse(body);
                    const lensId = payload.lensId;
                    const lens = getLens(lensId);
                    if (!lens) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Линза не найдена' }));
                        return;
                    }
                    data.current = lensId;
                    data.history = data.history || [];
                    data.history.push({
                        lens: lensId,
                        timestamp: new Date().toISOString()
                    });
                    if (data.history.length > 50) data.history = data.history.slice(-50);
                    await saveLensesData(data);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        lens: lens,
                        message: `Переключено на ${lens.name}`,
                        timestamp: new Date().toISOString()
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/lenses/preview ---
        if (path === '/api/lenses/preview' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const lensId = params.get('lensId') || 'geopolitics';
            const lens = getLens(lensId);
            if (!lens) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Линза не найдена' }));
                return;
            }
            const allModules = getAllModules();
            const modules = allModules.filter(m => lens.modules.includes(m.id));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                lens: lens,
                modules: modules,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/lenses/custom ---
        if (path === '/api/lenses/custom' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const payload = JSON.parse(body);
                    const customLens = {
                        id: `custom-${Date.now()}`,
                        name: payload.name || 'Пользовательская',
                        icon: payload.icon || '🔍',
                        description: payload.description || 'Пользовательская линза',
                        modules: payload.modules || [],
                        color: payload.color || '#888',
                        custom: true
                    };
                    data.custom = data.custom || [];
                    data.custom.push(customLens);
                    await saveLensesData(data);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        lens: customLens,
                        message: 'Пользовательская линза создана'
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Неизвестный путь'
        }));

    } catch (error) {
        console.error('[Lenses API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleLensesAPI };
