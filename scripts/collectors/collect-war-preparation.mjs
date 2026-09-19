#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'war-preparation.json');

function generateWarPreparation() {
    const now = new Date();
    const data = [];
    // Индекс подготовки к войне (0-100)
    const baseValues = [65, 66, 67, 68, 69, 70, 71, 72, 73, 74,
                        75, 76, 77, 78, 79, 80, 81, 82, 83, 84,
                        85, 86, 87, 88, 89, 90, 91, 92, 93, 94];
    const regions = ['Восточная Европа', 'Ближний Восток', 'Южно-Китайское море', 'Корейский полуостров', 'Балканы'];
    for (let i = 0; i < baseValues.length; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (baseValues.length - 1 - i));
        data.push({
            date: date.toISOString().slice(0,10),
            value: baseValues[i],
            region: regions[i % regions.length],
            notam: Math.floor(Math.random() * 5) + 1,
            gps: Math.floor(Math.random() * 5) + 1,
            status: baseValues[i] > 70 ? 'high' : baseValues[i] > 50 ? 'medium' : 'low'
        });
    }
    return data;
}

async function collectWarPreparation() {
    try {
        const data = generateWarPreparation();
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[WAR_PREPARATION] ✅ Сохранено ${data.length} записей`);
    } catch (e) {
        console.error(`[WAR_PREPARATION] ❌ Ошибка: ${e.message}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectWarPreparation().catch(console.error);
}
export { collectWarPreparation };
