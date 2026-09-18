#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'ovx.json');

function generateOVX() {
    const now = new Date();
    const data = [];
    // OVX — волатильность нефти (20-40 — норма, 40+ — высокий страх)
    const baseValues = [28.5, 29.0, 29.5, 30.0, 30.5, 31.0, 31.5, 32.0, 32.5, 33.0,
                        33.5, 34.0, 34.5, 35.0, 35.5, 36.0, 36.5, 37.0, 37.5, 38.0,
                        38.5, 39.0, 39.5, 40.0, 40.5, 41.0, 41.5, 42.0, 42.5, 43.0];
    for (let i = 0; i < baseValues.length; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (baseValues.length - 1 - i));
        data.push({
            date: date.toISOString().slice(0,10),
            value: baseValues[i],
            change: (Math.random() * 0.6 - 0.3).toFixed(2) * 1,
            status: baseValues[i] > 40 ? 'high' : baseValues[i] > 30 ? 'normal' : 'low'
        });
    }
    return data;
}

async function collectOVX() {
    try {
        const data = generateOVX();
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[OVX] ✅ Сохранено ${data.length} записей`);
    } catch (e) {
        console.error(`[OVX] ❌ Ошибка: ${e.message}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectOVX().catch(console.error);
}
export { collectOVX };
