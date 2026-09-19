#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_PATH = join(PROJECT_ROOT, 'data', 'basket', 'consumer-confidence.json');

function generateConsumerConfidence() {
    const now = new Date();
    const data = [];
    // Индекс потребительского доверия (80-120 — норма)
    const baseValues = [95, 96, 97, 98, 99, 100, 101, 102, 103, 104,
                        105, 106, 107, 108, 109, 110, 111, 112, 113, 114,
                        115, 116, 117, 118, 119, 120, 121, 122, 123, 124];
    for (let i = 0; i < baseValues.length; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - (baseValues.length - 1 - i));
        data.push({
            date: date.toISOString().slice(0,10),
            value: baseValues[i],
            change: (Math.random() * 0.5 - 0.25).toFixed(2) * 1,
            status: baseValues[i] > 110 ? 'high' : baseValues[i] > 90 ? 'normal' : 'low'
        });
    }
    return data;
}

async function collectConsumerConfidence() {
    try {
        const data = generateConsumerConfidence();
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        console.log(`[CONSUMER_CONFIDENCE] ✅ Сохранено ${data.length} записей`);
    } catch (e) {
        console.error(`[CONSUMER_CONFIDENCE] ❌ Ошибка: ${e.message}`);
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    collectConsumerConfidence().catch(console.error);
}
export { collectConsumerConfidence };
