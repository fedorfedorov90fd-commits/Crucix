#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'aviation.json');

function generateData() {
    const now = new Date();
    const data = [];
    const aircraft = ['Boeing 737', 'Airbus A320', 'Boeing 747', 'Airbus A380', 'Cessna 172', 'Embraer E190'];
    const airlines = ['American', 'Delta', 'United', 'Emirates', 'British', 'Lufthansa'];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            flights: Math.round(300 + Math.random() * 1200),
            aircraft: aircraft[Math.floor(Math.random() * aircraft.length)],
            airline: airlines[Math.floor(Math.random() * airlines.length)],
            lat: 25 + Math.random() * 45,
            lng: -80 + Math.random() * 140,
            delayed: Math.random() > 0.7
        });
    }
    return data;
}

async function collectAviation() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[AVIATION] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectAviation().catch(console.error);
}
export { collectAviation };
