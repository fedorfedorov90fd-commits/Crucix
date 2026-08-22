#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'sp500-vix.json');

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const sp500 = 4500 + i * 5 + (Math.random() - 0.5) * 50;
        const vix = 18 + (i / 30) * 15 + (Math.random() - 0.5) * 3;
        data.push({
            date: date.toISOString().split('T')[0],
            sp500: Math.round(sp500 * 100) / 100,
            vix: Math.round(vix * 100) / 100,
            ratio: Math.round((sp500 / vix) * 100) / 100
        });
    }
    return data;
}

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[SP500-VIX] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[SP500-VIX] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectSP500VIX() {
    console.log('[SP500-VIX] 📡 Начинаем сбор...');
    const data = generateData();
    await saveToBasket(data);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectSP500VIX().catch(console.error);
}

export { collectSP500VIX, generateData };
