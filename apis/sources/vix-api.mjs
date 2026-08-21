// ============================================================
// VIX-API.MJS — API для индекса VIX
// ============================================================
// Эндпоинты:
//   GET /api/vix/          — все данные
//   GET /api/vix/status    — статус модуля
//   GET /api/vix/latest    — последнее значение
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'vix.json');

async function loadData() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function handleVIXAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        const data = await loadData();

        if (pathname === '/api/vix/' || pathname === '/api/vix') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: data.length,
                data: data,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        if (pathname === '/api/vix/status') {
            const last = data.length > 0 ? data[data.length - 1] : null;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                status: 'online',
                total: data.length,
                lastValue: last ? last.value : null,
                lastDate: last ? last.date : null,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        if (pathname === '/api/vix/latest') {
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

export default { handleVIXAPI };
