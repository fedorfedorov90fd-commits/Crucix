#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'dark-ships.json');

function generateData() {
    const now = new Date();
    const data = [];
    const regions = ['Black Sea', 'Mediterranean', 'South China Sea', 'Persian Gulf', 'Baltic Sea'];
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            region: regions[Math.floor(Math.random() * regions.length)],
            ships: Math.floor(Math.random() * 10) + 1
        });
    }
    return data;
}

async function collectDarkShips() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[Dark Ships] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectDarkShips().catch(console.error);
}
export { collectDarkShips };
