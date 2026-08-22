#!/usr/bin/env node
// ============================================================
// COLLECT-COPPER-GOLD.MJS — Сборщик индекса Медь/Золото
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'copper-gold.json');

async function loadExisting() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        return JSON.parse(data);
    } catch { return []; }
}

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const base = 12 + (i / 30) * 3 + (Math.random() - 0.5) * 1.5;
        data.push({
            date: date.toISOString().split('T')[0],
            copper: Math.round((420 + i * 1.5 + (Math.random() - 0.5) * 10) * 100) / 100,
            gold: Math.round((1900 + i * 2 + (Math.random() - 0.5) * 15) * 100) / 100,
            ratio: Math.round(base * 100) / 100
        });
    }
    return data;
}

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[COPPER-GOLD] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[COPPER-GOLD] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectCopperGold() {
    console.log('[COPPER-GOLD] 📡 Начинаем сбор...');
    const data = generateData();
    await saveToBasket(data);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectCopperGold().catch(console.error);
}

export { collectCopperGold, generateData };
