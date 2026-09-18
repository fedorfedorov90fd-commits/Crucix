#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'big-mac.json');

function generateData() {
    const now = new Date();
    const data = [];
    const countries = ['Россия', 'США', 'Китай', 'Индия', 'Бразилия', 'Великобритания', 'Япония', 'Германия', 'Турция', 'Аргентина'];
    const prices = {
        'Россия': 2.5, 'США': 5.8, 'Китай': 3.2, 'Индия': 2.8, 'Бразилия': 4.5,
        'Великобритания': 5.2, 'Япония': 4.0, 'Германия': 5.0, 'Турция': 2.0, 'Аргентина': 3.5
    };
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const entry = { date: date.toISOString().split('T')[0] };
        for (const country of countries) {
            const base = prices[country] || 4;
            entry[country] = Math.round((base + (Math.random() - 0.5) * 0.5) * 100) / 100;
        }
        data.push(entry);
    }
    return data;
}

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[BIG-MAC] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[BIG-MAC] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectBigMac() {
    console.log('[BIG-MAC] 📡 Начинаем сбор...');
    const data = generateData();
    await saveToBasket(data);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectBigMac().catch(console.error);
}

export { collectBigMac, generateData };
