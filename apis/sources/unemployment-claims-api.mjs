/**
 * apis/sources/unemployment-claims-api.mjs — API-МОДУЛЬ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/unemployment-claims.json (файл данных отсутствует — данные нужно собрать коллектором).
 * Сборщик: collect-unemployment-claims.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?limit=, ?since=, ?until=.
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

export const route  = '/api/layers/unemployment-claims';
export const method = 'GET';

export const meta = {
  category: "other",
  icon: "📊",
  color: "#64748b",
  vizType: "marker",
  source: null,
  collector: "collect-unemployment-claims.mjs",
  cache: 300,
  description: "Слой unemployment-claims",
  unit: "records",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'unemployment-claims.json');

export async function handler(req, res) {
    try {
        const data = await readFile(BASKET_PATH, 'utf-8');
        const json = JSON.parse(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data: json }));
    } catch (error) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'No data available' }));
    }
}
