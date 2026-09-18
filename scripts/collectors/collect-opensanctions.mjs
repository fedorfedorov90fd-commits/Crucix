#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'opensanctions.json');

function generateData() {
    const now = new Date();
    const data = [];
    const countries = ['Россия', 'Китай', 'Иран', 'Северная Корея', 'Беларусь', 'Мьянма'];
    const types = ['Физическое лицо', 'Компания', 'Организация'];
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            country: countries[Math.floor(Math.random() * countries.length)],
            type: types[Math.floor(Math.random() * types.length)],
            count: Math.floor(Math.random() * 15) + 1
        });
    }
    return data;
}

async function collectOpenSanctions() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[OpenSanctions] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectOpenSanctions().catch(console.error);
}
export { collectOpenSanctions };
