#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'tips.json');

function generateTIPS() {
    const now = new Date();
    const data = [];
    // Реальные ставки (TIPS) — диапазон -1% до +3%
    const baseValues = [1.8, 1.9, 2.0, 2.1, 2.2, 2.1, 2.0, 1.9, 1.8, 1.7,
                        1.6, 1.5, 1.4, 1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7,
                        0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3];
    for (let i = 0; i < baseValues.length; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (baseValues.length - 1 - i));
        data.push({
            date: date.toISOString().slice(0,10),
            value: baseValues[i],
            change: (Math.random() * 0.1 - 0.05).toFixed(2) * 1,
            status: baseValues[i] > 2 ? 'high' : baseValues[i] > 0 ? 'normal' : 'low'
        });
    }
    return data;
}

async function collectTIPS() {
    try {
        const data = generateTIPS();
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[TIPS] ✅ Сохранено ${data.length} записей`);
    } catch (e) {
        console.error(`[TIPS] ❌ Ошибка: ${e.message}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectTIPS().catch(console.error);
}
export { collectTIPS };
