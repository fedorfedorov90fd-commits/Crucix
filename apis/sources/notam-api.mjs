// ============================================================
// NOTAM-API.MJS — API для NOTAM мониторинга
// ============================================================
// Эндпоинты:
//   GET /api/notam/          — получить все активные NOTAM
//   GET /api/notam/regions   — получить по регионам
//   GET /api/notam/status    — статус модуля
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'notam.json');

// ============================================================
// 1. ЗАГРУЗКА ДАННЫХ ИЗ КОРЗИНЫ
// ============================================================

async function loadNOTAM() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.warn('[NOTAM-API] ⚠️ Нет данных в корзине:', error.message);
        return [];
    }
}

// ============================================================
// 2. ОБРАБОТЧИКИ
// ============================================================

/**
 * GET /api/notam/ — все NOTAM
 */
async function handleGetAll(req, res) {
    try {
        const notams = await loadNOTAM();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            count: notams.length,
            data: notams,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message
        }));
    }
}

/**
 * GET /api/notam/regions — группировка по регионам
 */
async function handleGetRegions(req, res) {
    try {
        const notams = await loadNOTAM();
        const regions = {};

        for (const notam of notams) {
            const key = notam.region || 'Неизвестно';
            if (!regions[key]) {
                regions[key] = {
                    region: key,
                    count: 0,
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0,
                    items: []
                };
            }
            regions[key].count++;
            regions[key][notam.severity] = (regions[key][notam.severity] || 0) + 1;
            regions[key].items.push(notam);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            regions: Object.values(regions),
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message
        }));
    }
}

/**
 * GET /api/notam/status — статус модуля
 */
async function handleGetStatus(req, res) {
    try {
        const notams = await loadNOTAM();
        const active = notams.filter(n => new Date(n.end) > new Date());

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            status: 'online',
            total: notams.length,
            active: active.length,
            lastUpdate: notams.length > 0 ? notams[0].updated : null,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            status: 'error',
            error: error.message
        }));
    }
}

// ============================================================
// 3. ГЛАВНЫЙ ОБРАБОТЧИК
// ============================================================

export async function handleNOTAMAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log(`[NOTAM-API] Запрос: ${req.method} ${pathname}`);

    // Маршрутизация
    if (pathname === '/api/notam/' || pathname === '/api/notam') {
        await handleGetAll(req, res);
        return;
    }

    if (pathname === '/api/notam/regions' || pathname.startsWith('/api/notam/regions')) {
        await handleGetRegions(req, res);
        return;
    }

    if (pathname === '/api/notam/status') {
        await handleGetStatus(req, res);
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        success: false,
        error: `Unknown endpoint: ${pathname}`
    }));
}

// ============================================================
// 4. ЭКСПОРТ
// ============================================================

export default {
    handleNOTAMAPI,
    loadNOTAM
};
