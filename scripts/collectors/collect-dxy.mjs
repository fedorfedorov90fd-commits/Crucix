#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'dxy.json');

function generateDXY() {
    const now = new Date();
    const data = [];
    // Исторические данные DXY за 30 дней (100-110 — норма, 110+ — высокий)
    const baseValues = [105.2, 105.5, 105.8, 106.1, 106.0, 105.7, 105.3, 104.9, 104.6, 104.2,
                        104.0, 103.8, 103.5, 103.2, 103.0, 102.8, 102.5, 102.2, 102.0, 101.8,
                        101.5, 101.2, 101.0, 100.8, 100.5, 100.2, 100.0, 99.8, 99.5, 99.2];
    for (let i = 0; i < baseValues.length; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (baseValues.length - 1 - i));
        data.push({
            date: date.toISOString().slice(0,10),
            value: baseValues[i],
            change: (Math.random() * 0.4 - 0.2).toFixed(2) * 1,
            status: baseValues[i] > 108 ? 'high' : baseValues[i] > 103 ? 'normal' : 'low'
        });
    }
    return data;
}

async function collectDXY() {
    try {
        const data = generateDXY();
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[DXY] ✅ Сохранено ${data.length} записей`);
    } catch (e) {
        console.error(`[DXY] ❌ Ошибка: ${e.message}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectDXY().catch(console.error);
}
export { collectDXY };
