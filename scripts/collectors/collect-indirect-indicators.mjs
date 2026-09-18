#!/usr/bin/env node

/**
 * Сборщик: Косвенные индикаторы (Indirect Indicators)
 * Источник: Google Maps / Yelp / Uber / Lyft
 * Сохраняет в: data/basket/indirect-indicators.json
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASKET_PATH = path.join(__dirname, '..', '..', 'data', 'basket', 'indirect-indicators.json');
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs', 'collectors');
const LOG_FILE = path.join(LOGS_DIR, 'collect-indirect-indicators.log');

const COLLECTOR_NAME = 'indirect-indicators';

/**
 * Логирование
 */
async function log(message) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${message}\n`;
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        await fs.appendFile(LOG_FILE, line);
    } catch (e) {
        console.error('Ошибка записи лога:', e.message);
    }
    console.log(line.trim());
}

/**
 * Генерация демо-данных
 */
function generateDemoData() {
    const now = new Date();
    const data = [];

    // Генерируем демо-данные для "Пицца Пентагона" и "Такси в Лэнгли"
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);

        data.push({
            date: date.toISOString(),
            pentagonPizza: Math.round((Math.random() * 15 + 5) * 100) / 100,
            langleyTaxis: Math.round((Math.random() * 12 + 3) * 100) / 100,
            source: 'DEMO'
        });
    }

    return {
        source: 'Google Maps / Yelp / Uber / Lyft',
        lastUpdated: now.toISOString(),
        data: data,
        meta: {
            description: 'Косвенные индикаторы: Пицца Пентагона и Такси в Лэнгли',
            isDemo: true,
            indicators: ['pentagon-pizza', 'langley-taxis']
        }
    };
}

/**
 * Основной сбор
 */
async function collect() {
    await log(`🚀 Запуск сборщика ${COLLECTOR_NAME}`);
    const startTime = Date.now();

    try {
        await log('📊 Генерация косвенных индикаторов...');

        const data = generateDemoData();

        await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
        await log(`✅ Данные сохранены в корзину: ${BASKET_PATH}`);
        await log(`📈 Записей: ${data.data.length}`);
        await log(`🍕 Пицца Пентагона: ${data.data[data.data.length - 1].pentagonPizza}`);
        await log(`🚕 Такси в Лэнгли: ${data.data[data.data.length - 1].langleyTaxis}`);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        await log(`✅ Сборщик ${COLLECTOR_NAME} завершён за ${elapsed}с`);

    } catch (error) {
        await log(`❌ Ошибка: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// Запуск
collect();
