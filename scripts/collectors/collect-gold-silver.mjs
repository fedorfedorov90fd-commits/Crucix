#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'gold-silver.json');

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const gold = 1900 + Math.random() * 200;
        const silver = 22 + Math.random() * 8;
        data.push({
            date: date.toISOString().slice(0,10),
            gold: Math.round(gold * 100) / 100,
            silver: Math.round(silver * 100) / 100,
            ratio: Math.round((gold / silver) * 100) / 100
        });
    }
    return data;
}

async function collectGoldSilver() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[GOLD-SILVER] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectGoldSilver().catch(console.error);
}
export { collectGoldSilver };
