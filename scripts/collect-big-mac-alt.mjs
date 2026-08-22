#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');
const BASKET_PATH = join(BASKET_DIR, 'big-mac-alt.json');

function generateData() {
    const now = new Date();
    const data = [];
    const countries = ['ЮАР', 'Египет', 'Вьетнам', 'Мексика', 'Чили', 'Норвегия', 'Швеция', 'Швейцария', 'Сингапур', 'Австралия'];
    const prices = {
        'ЮАР': 2.8, 'Египет': 2.2, 'Вьетнам': 2.6, 'Мексика': 3.2, 'Чили': 3.8,
        'Норвегия': 5.5, 'Швеция': 5.0, 'Швейцария': 6.5, 'Сингапур': 5.8, 'Австралия': 4.8
    };
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const entry = { date: date.toISOString().split('T')[0] };
        for (const country of countries) {
            const base = prices[country] || 4;
            entry[country] = Math.round((base + (Math.random() - 0.5) * 0.4) * 100) / 100;
        }
        data.push(entry);
    }
    return data;
}

async function saveToBasket(data) {
    try {
        await fs.mkdir(BASKET_DIR, { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2), 'utf8');
        console.log(`[BIG-MAC-ALT] ✅ Сохранено ${data.length} записей`);
        return true;
    } catch (error) {
        console.error(`[BIG-MAC-ALT] ❌ Ошибка:`, error.message);
        return false;
    }
}

async function collectBigMacAlt() {
    console.log('[BIG-MAC-ALT] 📡 Начинаем сбор...');
    const data = generateData();
    await saveToBasket(data);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectBigMacAlt().catch(console.error);
}

export { collectBigMacAlt, generateData };
