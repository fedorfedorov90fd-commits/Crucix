#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'recession.json');

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const value = 10 + Math.random() * 60;
        data.push({ date: date.toISOString().slice(0,10), value: Math.round(value * 100) / 100 });
    }
    return data;
}

async function collectRecession() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[RECESSION] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectRecession().catch(console.error);
}

export { collectRecession };
