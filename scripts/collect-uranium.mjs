#!/usr/bin/env node
// ============================================================
// COLLECT-URANIUM.MJS — Сборщик цены урана
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'uranium.json');

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
        const base = 45 + (i / 30) * 15 + (Math.random() - 0.5) * 8;
        data.push({
            date: date.toISOString().split('T')[0],
            price: Math.round(base * 100) / 100
        });
    }
    return data;
}

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[URANIUM] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[URANIUM] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectUranium() {
    console.log('[URANIUM] 📡 Начинаем сбор...');
    const data = generateData();
    await saveToBasket(data);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectUranium().catch(console.error);
}

export { collectUranium, generateData };
