/**
 * apis/sources/viirs-api.mjs — API-МОДУЛЬ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/viirs.json.
 * Сборщик: collect-viirs.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?limit=, ?since=, ?until=.
 */
// ============================================================
// VIIRS-API.MJS — API для ночных огней
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const route  = '/api/layers/viirs';
export const method = 'GET';

export const meta = {
  category: "ecological",
  icon: "🌃",
  color: "#ffff44",
  vizType: "marker",
  source: "basket/viirs.json",
  collector: "collect-viirs.mjs",
  cache: 300,
  description: "Ночные огни VIIRS",
  unit: "records",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'viirs.json');

async function loadData() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch { return []; }
}

export async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        const data = await loadData();

        if (pathname === '/api/viirs/' || pathname === '/api/viirs') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: data.length,
                data: data,
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
