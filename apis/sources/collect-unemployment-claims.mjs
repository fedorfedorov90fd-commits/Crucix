import { writeFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'unemployment-claims.json');

// Демо-данные для unemployment claims (заявки на пособие по безработице)
const demoData = [
    { date: '2026-09-01', value: 215000, change: -5000, previous: 220000, source: 'BLS' },
    { date: '2026-08-25', value: 220000, change: -3000, previous: 223000, source: 'BLS' },
    { date: '2026-08-18', value: 223000, change: 2000, previous: 221000, source: 'BLS' },
    { date: '2026-08-11', value: 221000, change: -1000, previous: 222000, source: 'BLS' },
    { date: '2026-08-04', value: 222000, change: 4000, previous: 218000, source: 'BLS' },
];

const name = 'unemployment-claims';
console.log(`[${name}] Запуск сборщика`);

try {
    await writeFile(BASKET_PATH, JSON.stringify(demoData, null, 2));
    console.log(`[${name}] ✅ Данные сохранены в корзину (${demoData.length} записей)`);
} catch (error) {
    console.error(`[${name}] ❌ Ошибка:`, error.message);
}
