// ============================================================
// GOLD-OIL-RATIO-API.MJS — API для индекса Золото/Нефть
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', '..', 'data', 'indicators', 'gold-oil-ratio.json');

export async function handleGoldOilRatioAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        // Читаем файл
        const rawData = await fs.readFile(DATA_PATH, 'utf8');
        const data = JSON.parse(rawData);

        // Отвечаем
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: data,
            timestamp: new Date().toISOString()
        }));
    } catch (error) {
        console.error('[Gold/Oil] Ошибка:', error.message);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: error.message,
            data: null
        }));
    }
}

export default { handleGoldOilRatioAPI };
