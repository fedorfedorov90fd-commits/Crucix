#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASKET_PATH = path.join(__dirname, '..', '..', 'data', 'basket', 'dark-fleet.json');
const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'collectors', 'collect-dark-fleet.log');

async function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, line);
    console.log(line.trim());
}

function generateDemoData() {
    const now = new Date();
    const data = [];
    const destinations = ['Novorossiysk', 'Kaliningrad', 'Murmansk', 'Vladivostok', 'St. Petersburg'];
    const flags = ['Unknown', 'Camouflage', 'Fake Panama', 'Fake Liberia', 'No Flag'];

    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString(),
            count: Math.floor(Math.random() * 15 + 2),
            destination: destinations[Math.floor(Math.random() * destinations.length)],
            flag: flags[Math.floor(Math.random() * flags.length)],
            source: 'DEMO'
        });
    }
    return {
        source: 'Dark Ships + OFAC',
        lastUpdated: now.toISOString(),
        data: data,
        meta: {
            description: 'Тёмный флот — суда без AIS, идущие в Россию',
            unit: 'количество судов',
            isDemo: true,
            destinations: destinations
        }
    };
}

async function collect() {
    await log('🚀 Запуск сборщика dark-fleet');
    const start = Date.now();
    try {
        const data = generateDemoData();
        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        await log(`✅ Сохранено ${data.data.length} записей`);
        await log(`🚢 Текущее количество: ${data.data[data.data.length - 1].count} судов`);
        await log(`📍 Направление: ${data.data[data.data.length - 1].destination}`);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);
        await log(`✅ Завершён за ${elapsed}с`);
    } catch (e) {
        await log(`❌ Ошибка: ${e.message}`);
        process.exit(1);
    }
}

collect();
