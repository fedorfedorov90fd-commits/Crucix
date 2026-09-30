import { writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SOURCES_DIR = join(__dirname, '../apis/sources');

const layers = [
    {
        id: 'map-layer-economy',
        basket: 'economy.json',
        value: 'record.gdp || record.inflation || 0',
        label: '`Экономика: ${record.country || "Неизвестно"}`'
    },
    {
        id: 'map-layer-energy',
        basket: 'eia.json',
        value: 'record.energy || record.oil || 0',
        label: '`Энергия: ${record.country || "Неизвестно"}`'
    },
    {
        id: 'map-layer-cyber',
        basket: 'cyber-attacks.json',
        value: 'record.severity || 1',
        label: '`Кибератака: ${record.name || "Неизвестно"}`'
    },
    {
        id: 'map-layer-social',
        basket: 'social-unrest.json',
        value: 'record.intensity || 0',
        label: '`Напряжённость: ${record.country || "Неизвестно"}`'
    },
    {
        id: 'map-layer-sanctions',
        basket: 'ofac.json',
        value: 'record.severity || 1',
        label: '`Санкции: ${record.country || "Неизвестно"}`'
    },
    {
        id: 'map-layer-military-zones',
        basket: 'conflict-zones.json',
        value: 'record.severity === "critical" ? 3 : record.severity === "high" ? 2 : 1',
        label: '`Конфликт: ${record.type || "Неизвестно"}`'
    }
];

for (const layer of layers) {
    const code = `/**
 * ${layer.id}.mjs
 * Доступ: /api/layers/${layer.id}
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASKET_PATH = join(__dirname, '../../data/basket/${layer.basket}');

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
                value: ${layer.value},
                label: ${layer.label},
                region: record.region || 'GLOBAL',
                timestamp: record.timestamp || new Date().toISOString()
            }
        }));
        sendJSON(res, { type: 'FeatureCollection', features });
    } catch (err) {
        sendJSON(res, { error: err.message }, 500);
    }
}`;

    const filePath = join(SOURCES_DIR, layer.id + '.mjs');
    await writeFile(filePath, code, 'utf-8');
    console.log(`✅ Исправлен: ${layer.id}.mjs`);
}

console.log('✅ Все 6 модулей исправлены!');
