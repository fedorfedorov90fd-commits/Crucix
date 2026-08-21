// ============================================================
// GPS-JAMMING-API.MJS — API для детектора GPS-глушения
// ============================================================
// Эндпоинты:
//   GET /api/gps-jamming/          — все зоны глушения
//   GET /api/gps-jamming/status    — статус модуля
//   GET /api/gps-jamming/regions   — по регионам
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'gps-jamming.json');

async function loadData() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function handleGPSJammingAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        const data = await loadData();

        if (pathname === '/api/gps-jamming/' || pathname === '/api/gps-jamming') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: data.length,
                data: data,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        if (pathname === '/api/gps-jamming/status') {
            const active = data.filter(d => new Date(d.end) > new Date());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                status: 'online',
                total: data.length,
                active: active.length,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        if (pathname === '/api/gps-jamming/regions') {
            const regions = {};
            for (const item of data) {
                if (!regions[item.region]) {
                    regions[item.region] = { region: item.region, count: 0, items: [] };
                }
                regions[item.region].count++;
                regions[item.region].items.push(item);
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                regions: Object.values(regions),
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

export default { handleGPSJammingAPI };
