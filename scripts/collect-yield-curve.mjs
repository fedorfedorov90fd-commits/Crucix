#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'yield-curve.json');

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const y10 = 3.5 + Math.random() * 1.5;
        const y2 = 3.0 + Math.random() * 2;
        const spread = Math.round((y10 - y2) * 100) / 100;
        data.push({
            date: date.toISOString().slice(0,10),
            y10: Math.round(y10 * 100) / 100,
            y2: Math.round(y2 * 100) / 100,
            spread: spread,
            inverted: spread < 0
        });
    }
    return data;
}

async function collectYieldCurve() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[YIELD-CURVE] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectYieldCurve().catch(console.error);
}
export { collectYieldCurve };
