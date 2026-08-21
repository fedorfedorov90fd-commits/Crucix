// ============================================================
// GOOGLE-TRENDS-API.MJS — API для Google Trends
// ============================================================
// Эндпоинты:
//   GET /api/google-trends/          — все данные
//   GET /api/google-trends/status    — статус
//   GET /api/google-trends/regions   — по регионам
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'google-trends.json');

async function loadData() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

export async function handleGoogleTrendsAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        const data = await loadData();

        if (pathname === '/api/google-trends/' || pathname === '/api/google-trends') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: data.length,
                data: data,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        if (pathname === '/api/google-trends/status') {
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

        if (pathname === '/api/google-trends/regions') {
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

export default { handleGoogleTrendsAPI };
