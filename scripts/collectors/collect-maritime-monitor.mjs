#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'maritime-monitor.json');

function generateData() {
    const now = new Date();
    const data = [];
    const regions = ['Mediterranean', 'South China Sea', 'Persian Gulf', 'Black Sea', 'Baltic Sea'];
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            region: regions[Math.floor(Math.random() * regions.length)],
            vessels: Math.floor(Math.random() * 100) + 20
        });
    }
    return data;
}

async function collectMaritimeMonitor() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[Maritime Monitor] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectMaritimeMonitor().catch(console.error);
}
export { collectMaritimeMonitor };
