// ============================================================
// YIELD-CURVE-API.MJS — API для кривой доходности
// ============================================================
// Эндпоинты:
//   GET /api/yield-curve/          — все данные
//   GET /api/yield-curve/status    — статус модуля
//   GET /api/yield-curve/latest    — последнее значение
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'yield-curve.json');

async function loadData() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function handleYieldCurveAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        const data = await loadData();

        if (pathname === '/api/yield-curve/' || pathname === '/api/yield-curve') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: data.length,
                data: data,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        if (pathname === '/api/yield-curve/status') {
            const last = data.length > 0 ? data[data.length - 1] : null;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                status: 'online',
                total: data.length,
                lastSpread: last ? last.spread : null,
                lastDate: last ? last.date : null,
                inverted: last ? last.inverted : null,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        if (pathname === '/api/yield-curve/latest') {
            const last = data.length > 0 ? data[data.length - 1] : null;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                data: last,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Unknown endpoint' }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

export default { handleYieldCurveAPI };
