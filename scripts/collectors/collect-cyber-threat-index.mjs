#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASKET_PATH = path.join(__dirname, '..', '..', 'data', 'basket', 'cyber-threat-index.json');
const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'collectors', 'collect-cyber-threat-index.log');

async function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, line);
    console.log(line.trim());
}

function generateDemoData() {
    const now = new Date();
    const data = [];
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString(),
            value: Math.round((Math.random() * 30 + 20) * 100) / 100,
            cisa: Math.round((Math.random() * 20 + 10) * 100) / 100,
            darkweb: Math.round((Math.random() * 20 + 10) * 100) / 100
        });
    }
    return {
        source: 'CISA + Darkweb',
        lastUpdated: now.toISOString(),
        data: data,
        meta: {
            description: 'Композитный индекс киберугроз',
            unit: 'индекс',
            isDemo: true,
            components: ['CISA', 'Darkweb']
        }
    };
}

async function collect() {
    await log('🚀 Запуск сборщика cyber-threat-index');
    const start = Date.now();
    try {
        const data = generateDemoData();
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        await log(`✅ Сохранено ${data.data.length} записей`);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        await log(`✅ Завершён за ${elapsed}с`);
    } catch (e) {
        await log(`❌ Ошибка: ${e.message}`);
        process.exit(1);
    }
}

collect();
