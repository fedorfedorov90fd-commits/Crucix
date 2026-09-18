#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'unemployment.json');

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const value = 3.5 + Math.random() * 3.0;
        data.push({ date: date.toISOString().slice(0,10), value: Math.round(value * 100) / 100 });
    }
    return data;
}

async function collectUnemployment() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[UNEMPLOYMENT] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectUnemployment().catch(console.error);
}

export { collectUnemployment };
