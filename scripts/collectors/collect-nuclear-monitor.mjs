#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'nuclear-monitor.json');

function generateNuclearMonitor() {
    const now = new Date();
    const data = [];
    // Ядерный мониторинг (0-100)
    const baseValues = [33.9, 34.5, 35.0, 35.5, 36.0, 36.5, 37.0, 37.5, 38.0, 38.5,
                        39.0, 39.5, 40.0, 40.5, 41.0, 41.5, 42.0, 42.5, 43.0, 43.5,
                        44.0, 44.5, 45.0, 45.5, 46.0, 46.5, 47.0, 47.5, 48.0, 48.5];
    const sites = ['Фукусима', 'Чернобыль', 'Три-Майл-Айленд', 'Маяк', 'Селлафилд'];
    for (let i = 0; i < baseValues.length; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (baseValues.length - 1 - i));
        data.push({
            date: date.toISOString().slice(0,10),
            value: baseValues[i],
            site: sites[i % sites.length],
            status: baseValues[i] > 40 ? 'high' : baseValues[i] > 30 ? 'normal' : 'low'
        });
    }
    return data;
}

async function collectNuclearMonitor() {
    try {
        const data = generateNuclearMonitor();
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[NUCLEAR_MONITOR] ✅ Сохранено ${data.length} записей`);
    } catch (e) {
        console.error(`[NUCLEAR_MONITOR] ❌ Ошибка: ${e.message}`);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectNuclearMonitor().catch(console.error);
}
export { collectNuclearMonitor };
