#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'crypto-fear.json');

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const btc = 60000 + i * 100 + (Math.random() - 0.5) * 2000;
        const eth = 3000 + i * 20 + (Math.random() - 0.5) * 150;
        data.push({
            date: date.toISOString().split('T')[0],
            btc: Math.round(btc * 100) / 100,
            eth: Math.round(eth * 100) / 100,
            ratio: Math.round((btc / eth) * 100) / 100
        });
    }
    return data;
}

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[CRYPTO-FEAR] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[CRYPTO-FEAR] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectCryptoFear() {
    console.log('[CRYPTO-FEAR] 📡 Начинаем сбор...');
    const data = generateData();
    await saveToBasket(data);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectCryptoFear().catch(console.error);
}

export { collectCryptoFear, generateData };
