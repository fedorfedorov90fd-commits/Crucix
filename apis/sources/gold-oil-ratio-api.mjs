// ============================================================
// GOLD-OIL-RATIO-API.MJS — API для индекса Золото/Нефть
// ============================================================
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'gold-oil.json');

async function loadData() {
    try {
        const content = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.warn('[GoldOil] ⚠️ Нет данных в корзине');
        return [];
    }
}

export async function handleGoldOilRatioAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log(`[GoldOil] Запрос: ${pathname}`);

    // Все данные
    if (pathname === '/api/gold-oil-ratio/' || pathname === '/api/gold-oil-ratio') {
        const data = await loadData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: data,
            count: data.length,
            lastUpdate: data.length > 0 ? data[data.length-1].date : null
        }));
        return;
    }

    // Статус
    if (pathname === '/api/gold-oil-ratio/status') {
        const data = await loadData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            status: data.length > 0 ? 'online' : 'no_data',
            count: data.length
        }));
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Unknown endpoint' }));
}
