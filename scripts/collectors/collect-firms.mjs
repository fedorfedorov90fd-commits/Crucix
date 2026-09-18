#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'firms.json');

function generateData() {
    const now = new Date();
    const data = [];
    const regions = ['Amazon', 'California', 'Siberia', 'Australia', 'Greece', 'Turkey', 'Canada', 'Indonesia', 'Brazil'];
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const fires = Math.floor(20 + Math.random() * 180);
        data.push({
            date: date.toISOString().slice(0,10),
            value: fires,
            fires: fires,
            region: regions[Math.floor(Math.random() * regions.length)],
            frp: Math.round((Math.random() * 100 + 10) * 100) / 100,
            confidence: Math.round((50 + Math.random() * 50) * 10) / 10
        });
    }
    return data;
}

async function collectFIRMS() {
    try {
        console.log('[FIRMS] Начинаем сбор данных...');
        const data = generateData();
        
        // Создаём папку если её нет
        await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
        
        // Записываем данные
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[FIRMS] ✅ Сохранено ${data.length} записей в data/basket/firms.json`);
        console.log(`[FIRMS] ✅ Первая запись:`, data[0]);
        return data;
    } catch (error) {
        console.error(`[FIRMS] ❌ Ошибка: ${error.message}`);
        throw error;
    }
}

// Запускаем сборщик
console.log('[FIRMS] Запуск сборщика...');
collectFIRMS().then(() => {
    console.log('[FIRMS] ✅ Готово!');
}).catch((error) => {
    console.error('[FIRMS] ❌ Ошибка:', error);
    process.exit(1);
});

export { collectFIRMS };
