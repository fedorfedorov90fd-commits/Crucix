#!/usr/bin/env node
// ============================================================
// COLLECT-OIL-GAS.MJS — Сборщик индекса Нефть/Газ
// ============================================================
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'oil-gas.json');

function generateData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const oil = 70 + Math.random() * 20;
        const gas = 3 + Math.random() * 2;
        data.push({
            date: date.toISOString().slice(0,10),
            oil: Math.round(oil * 100) / 100,
            gas: Math.round(gas * 100) / 100,
            ratio: Math.round((oil / gas) * 100) / 100
        });
    }
    return data;
}

async function collectOilGas() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[OIL-GAS] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectOilGas().catch(console.error);
}
export { collectOilGas };
