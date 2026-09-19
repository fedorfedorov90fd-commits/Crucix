#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'hy-spread.json');

function generateHYSpread() {
    const now = new Date();
    const data = [];
    // HY Spread — высокодоходные облигации (2-4% — норма, 4+ — стресс)
    const baseValues = [3.16, 3.20, 3.25, 3.30, 3.35, 3.40, 3.45, 3.50, 3.55, 3.60,
                        3.65, 3.70, 3.75, 3.80, 3.85, 3.90, 3.95, 4.00, 4.05, 4.10,
                        4.15, 4.20, 4.25, 4.30, 4.35, 4.40, 4.45, 4.50, 4.55, 4.60];
    for (let i = 0; i < baseValues.length; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (baseValues.length - 1 - i));
        data.push({
            date: date.toISOString().slice(0,10),
            value: baseValues[i],
            change: (Math.random() * 0.05 - 0.025).toFixed(2) * 1,
            status: baseValues[i] > 4 ? 'high' : baseValues[i] > 3 ? 'normal' : 'low'
        });
    }
    return data;
}

async function collectHYSpread() {
    try {
        const data = generateHYSpread();
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[HY_SPREAD] ✅ Сохранено ${data.length} записей`);
    } catch (e) {
        console.error(`[HY_SPREAD] ❌ Ошибка: ${e.message}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectHYSpread().catch(console.error);
}
export { collectHYSpread };
