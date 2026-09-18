/**
 * map-layer-economy.mjs
 * Доступ: /api/layers/map-layer-economy
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASKET_PATH = join(__dirname, '../../data/basket/economy.json');

function sendJSON(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
    try {
        let data = [];
        try {
            const content = await readFile(BASKET_PATH, 'utf-8');
            data = JSON.parse(content);
        } catch (_) {}
        const features = (Array.isArray(data) ? data : []).map(record => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [record.lng || 0, record.lat || 0]
            },
            properties: {
                value: record.gdp || record.inflation || 0,
                label: `Экономика: ${record.country || "Неизвестно"}`,
                region: record.region || 'GLOBAL',
                timestamp: record.timestamp || new Date().toISOString()
            }
        }));
        sendJSON(res, { type: 'FeatureCollection', features });
    } catch (err) {
        sendJSON(res, { error: err.message }, 500);
    }
}