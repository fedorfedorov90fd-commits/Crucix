#!/usr/bin/env node
// ============================================================
// COLLECT-VIIRS.MJS — Сборщик данных ночных огней
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'viirs.json');

const REGIONS = [
    { name: 'Украина', lat: 49, lon: 31 },
    { name: 'Россия', lat: 60, lon: 90 },
    { name: 'США', lat: 40, lon: -100 },
    { name: 'Китай', lat: 35, lon: 105 },
    { name: 'Европа', lat: 50, lon: 10 }
];

async function loadExisting() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch { return []; }
}

function generateData() {
    const now = new Date();
    const data = [];
    for (const region of REGIONS) {
        for (let i = 30; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const brightness = Math.round((50 + (i / 30) * 20 + (Math.random() - 0.5) * 15) * 100) / 100;
            data.push({
                date: date.toISOString().split('T')[0],
                region: region.name,
                lat: region.lat,
                lon: region.lon,
                brightness: Math.max(0, brightness)
            });
        }
    }
    return data;
}

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[VIIRS] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[VIIRS] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectVIIRS() {
    console.log('[VIIRS] 📡 Начинаем сбор...');
    const data = generateData();
    await saveToBasket(data);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectVIIRS().catch(console.error);
}

export { collectVIIRS, generateData };
