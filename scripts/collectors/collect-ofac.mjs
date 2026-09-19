#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'ofac.json');

function generateData() {
    const now = new Date();
    const data = [];
    const countries = ['Россия', 'Иран', 'Северная Корея', 'Сирия', 'Венесуэла', 'Куба'];
    const types = ['Финансовые', 'Торговые', 'Персональные', 'Отраслевые'];
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            country: countries[Math.floor(Math.random() * countries.length)],
            type: types[Math.floor(Math.random() * types.length)],
            count: Math.floor(Math.random() * 20) + 1
        });
    }
    return data;
}

async function collectOFAC() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[OFAC] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectOFAC().catch(console.error);
}
export { collectOFAC };
