#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'noaa.json');

function generateData() {
    const now = new Date();
    const data = [];
    const cities = ['New York', 'London', 'Tokyo', 'Sydney', 'Moscow', 'Dubai', 'Singapore'];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            value: Math.round((Math.random() * 20 + 10) * 100) / 100,
            city: cities[Math.floor(Math.random() * cities.length)],
            temp: Math.round((Math.random() * 30 + 5) * 100) / 100,
            condition: ['sunny', 'cloudy', 'rainy', 'stormy'][Math.floor(Math.random() * 4)]
        });
    }
    return data;
}
async function collectNOAA() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[NOAA] ✅ Сохранено ${data.length} записей`);
    return data;
}
if (import.meta.url === `file://${process.argv[1]}`) { collectNOAA().catch(console.error); }
export { collectNOAA };
