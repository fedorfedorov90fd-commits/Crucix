#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'ships.json');

function generateData() {
    const now = new Date();
    const data = [];
    const ports = ['Singapore', 'Rotterdam', 'Shanghai', 'Los Angeles', 'Dubai', 'Hamburg', 'Antwerp', 'Hong Kong'];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            ships: Math.round(80 + Math.random() * 220),
            port: ports[Math.floor(Math.random() * ports.length)],
            lat: 15 + Math.random() * 45,
            lng: -70 + Math.random() * 150,
            active: Math.random() > 0.3
        });
    }
    return data;
}

async function collectShips() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[SHIPS] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectShips().catch(console.error);
}
export { collectShips };
