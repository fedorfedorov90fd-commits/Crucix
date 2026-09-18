/**
 * apis/sources/uranium-api.mjs — API-МОДУЛЬ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/uranium.json.
 * Сборщик: collect-uranium.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?limit=, ?since=, ?until=.
 */
// ============================================================
// URANIUM-API.MJS — API для цены урана
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const route  = '/api/layers/uranium';
export const method = 'GET';

export const meta = {
  category: "finance",
  icon: "☢️",
  color: "#44ff44",
  vizType: "choropleth",
  source: "basket/uranium.json",
  collector: "collect-uranium.mjs",
  cache: 300,
  description: "Цена урана",
  unit: "records",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'uranium.json');

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
        const last = data.length > 0 ? data[data.length - 1] : null;

        if (pathname === '/api/uranium/' || pathname === '/api/uranium') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: data.length,
                data: data,
                last: last,
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
