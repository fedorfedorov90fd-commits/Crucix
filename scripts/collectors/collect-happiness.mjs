#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'happiness.json');

function generateData() {
    const countries = [
        { name: 'Финляндия', score: 7.8 },
        { name: 'Дания', score: 7.6 },
        { name: 'Исландия', score: 7.5 },
        { name: 'Швеция', score: 7.4 },
        { name: 'Израиль', score: 7.3 },
        { name: 'Нидерланды', score: 7.3 },
        { name: 'Норвегия', score: 7.2 },
        { name: 'Швейцария', score: 7.1 },
        { name: 'Люксембург', score: 7.0 },
        { name: 'Новая Зеландия', score: 6.9 },
        { name: 'Австрия', score: 6.8 },
        { name: 'Австралия', score: 6.7 },
        { name: 'Канада', score: 6.6 },
        { name: 'Ирландия', score: 6.5 },
        { name: 'США', score: 6.3 },
        { name: 'Германия', score: 6.2 },
        { name: 'Великобритания', score: 6.1 },
        { name: 'Франция', score: 6.0 },
        { name: 'Италия', score: 5.9 },
        { name: 'Испания', score: 5.8 },
        { name: 'Япония', score: 5.7 },
        { name: 'Южная Корея', score: 5.6 },
        { name: 'Россия', score: 5.3 },
        { name: 'Китай', score: 5.1 },
        { name: 'Индия', score: 4.8 },
        { name: 'Бразилия', score: 4.7 },
        { name: 'Мексика', score: 4.5 },
        { name: 'Турция', score: 4.3 },
        { name: 'Египет', score: 4.0 },
        { name: 'ЮАР', score: 3.8 }
    ];
    return countries.map((c, i) => ({
        id: i + 1,
        country: c.name,
        score: c.score,
        rank: i + 1,
        updated: new Date().toISOString()
    }));
}

async function collectHappiness() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[HAPPINESS] ✅ Сохранено ${data.length} стран`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectHappiness().catch(console.error);
}
export { collectHappiness };
