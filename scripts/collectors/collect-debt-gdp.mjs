#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'debt-gdp.json');

function generateData() {
    const now = new Date();
    const data = [];
    const countries = ['Россия', 'США', 'Китай', 'Япония', 'Германия', 'Франция', 'Великобритания', 'Индия', 'Бразилия', 'Италия'];
    const debt = { 'Россия': 25, 'США': 120, 'Китай': 60, 'Япония': 250, 'Германия': 70, 'Франция': 115, 'Великобритания': 100, 'Индия': 85, 'Бразилия': 90, 'Италия': 150 };
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const entry = { date: date.toISOString().split('T')[0] };
        for (const country of countries) {
            const base = debt[country] || 60;
            entry[country] = Math.round((base + (Math.random() - 0.5) * 5) * 100) / 100;
        }
        data.push(entry);
    }
    return data;
}

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[DEBT-GDP] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[DEBT-GDP] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectDebtGDP() {
    console.log('[DEBT-GDP] 📡 Начинаем сбор...');
    const data = generateData();
    await saveToBasket(data);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectDebtGDP().catch(console.error);
}

export { collectDebtGDP, generateData };
