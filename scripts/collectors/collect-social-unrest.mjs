#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'social-unrest.json');

function generateSocialUnrest() {
    const now = new Date();
    const data = [];
    // Индекс социальной напряжённости (0-100)
    const baseValues = [35.5, 36.0, 36.5, 37.0, 37.5, 38.0, 38.5, 39.0, 39.5, 40.0,
                        40.5, 41.0, 41.5, 42.0, 42.5, 43.0, 43.5, 44.0, 44.5, 45.0,
                        45.5, 46.0, 46.5, 47.0, 47.5, 48.0, 48.5, 49.0, 49.5, 50.0];
    const regions = ['Европа', 'Азия', 'Америка', 'Африка', 'Ближний Восток'];
    for (let i = 0; i < baseValues.length; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (baseValues.length - 1 - i));
        data.push({
            date: date.toISOString().slice(0,10),
            value: baseValues[i],
            region: regions[i % regions.length],
            status: baseValues[i] > 40 ? 'high' : baseValues[i] > 30 ? 'normal' : 'low'
        });
    }
    return data;
}

async function collectSocialUnrest() {
    try {
        const data = generateSocialUnrest();
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[SOCIAL_UNREST] ✅ Сохранено ${data.length} записей`);
    } catch (e) {
        console.error(`[SOCIAL_UNREST] ❌ Ошибка: ${e.message}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectSocialUnrest().catch(console.error);
}
export { collectSocialUnrest };
