#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'usgs.json');

function generateData() {
    const now = new Date();
    const data = [];
    const regions = ['Калифорния', 'Япония', 'Индонезия', 'Чили', 'Турция', 'Иран'];
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const magnitude = Math.round((Math.random() * 6 + 1) * 10) / 10;
        const depth = Math.round(Math.random() * 100 + 5);
        data.push({
            date: date.toISOString().slice(0,10),
            magnitude: magnitude,
            depth: depth,
            region: regions[Math.floor(Math.random() * regions.length)]
        });
    }
    return data;
}

async function collectUSGS() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[USGS] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectUSGS().catch(console.error);
}
export { collectUSGS };
