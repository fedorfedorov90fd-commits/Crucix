/**
 * server/basket-reader.mjs — ЧТЕНИЕ КОРЗИНЫ (BASKET)
 *
 * Извлечено из server.mjs v12.0 (ULTIMATE EDITION)
 * Содержит: функции для чтения JSON-файлов из data/basket/
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..', '..');

export function readJSON(filePath) {
    try {
        const fullPath = join(__dirname, filePath);
        if (!existsSync(fullPath)) return null;
        const data = readFileSync(fullPath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
}

export function readBasket(filename) {
    return readJSON(`data/basket/${filename}`);
}

export function readDataGeo(filename) {
    return readJSON(`data/geo/${filename}`);
}

export default {
    readJSON,
    readBasket,
    readDataGeo
};
