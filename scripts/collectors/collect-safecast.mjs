#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'safecast.json');

function generateData() {
    const now = new Date();
    const data = [];
    const sites = ['Fukushima', 'Chernobyl', 'Three Mile Island', 'Fukushima Daiichi', 'Mayak'];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            value: Math.round((Math.random() * 50 + 10) * 100) / 100,
            site: sites[Math.floor(Math.random() * sites.length)],
            cpm: Math.round((Math.random() * 40 + 20) * 100) / 100
        });
    }
    return data;
}
async function collectSafecast() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[SAFECAST] ✅ Сохранено ${data.length} записей`);
    return data;
}
if (import.meta.url === `file://${process.argv[1]}`) { collectSafecast().catch(console.error); }
export { collectSafecast };
