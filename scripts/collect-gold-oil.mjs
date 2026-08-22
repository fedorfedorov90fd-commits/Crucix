#!/usr/bin/env node
// ============================================================
// COLLECT-GOLD-OIL.MJS — Сборщик индекса Золото/Нефть
// ============================================================
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'gold-oil.json');

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        // Симуляция данных: золото ~1900-2100, нефть ~60-90
        const gold = 1900 + Math.random() * 200;
        const oil = 60 + Math.random() * 30;
        data.push({
            date: date.toISOString().slice(0, 10),
            gold: Math.round(gold * 100) / 100,
            oil: Math.round(oil * 100) / 100,
            ratio: Math.round((gold / oil) * 100) / 100
        });
    }
    return data;
}

async function collectGoldOil() {
    try {
        const data = generateData();
        await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        const last = data[data.length - 1];
        console.log(`[GOLD-OIL] ✅ Сохранено ${data.length} записей`);
        console.log(`[GOLD-OIL] 📊 Текущий ratio: ${last.ratio} (золото: $${last.gold}, нефть: $${last.oil})`);
        return data;
    } catch (error) {
        console.error('[GOLD-OIL] ❌ Ошибка:', error.message);
        return null;
    }
}

// Запуск
if (import.meta.url === `file://${process.argv[1]}`) {
    collectGoldOil().catch(console.error);
}

export { collectGoldOil, generateData };
