#!/usr/bin/env node

// ============================================================
// collect-aviation.mjs — Сборщик данных авиации
// ============================================================
// Источник: OpenSky Network API
// Формат: JSON
// Сохраняет: data/basket/aviation.json
// Логи: logs/collectors/collect-aviation.log
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// КОНСТАНТЫ
// ============================================================

const PROJECT_ROOT = join(__dirname, '..');
const DATA_FILE = join(PROJECT_ROOT, 'data', 'basket', 'aviation.json');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE = join(LOGS_DIR, 'collect-aviation.log');

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function logMessage(message) {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] ${message}\n`;
    try {
        await fs.mkdir(LOGS_DIR, { recursive: true });
        await fs.appendFile(LOG_FILE, entry);
    } catch (e) {
        console.error('Ошибка записи лога:', e.message);
    }
}

async function saveData(data) {
    try {
        await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        await logMessage('✅ Данные сохранены');
    } catch (e) {
        await logMessage(`❌ Ошибка сохранения данных: ${e.message}`);
        throw e;
    }
}

// ============================================================
// ОСНОВНАЯ ЛОГИКА
// ============================================================

async function fetchAviation() {
    const startTime = Date.now();
    await logMessage('🚀 Запуск сборщика Aviation');

    try {
        // OpenSky Network API — все самолёты в реальном времени
        const url = 'https://opensky-network.org/api/states/all';

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (data.states && Array.isArray(data.states)) {
            await saveData(data.states);
            await logMessage(`✅ Сборщик Aviation завершён за ${elapsed}с, записей: ${data.states.length}`);
        } else {
            await logMessage(`⚠️ Неожиданный формат ответа, сохранён сырой ответ`);
            await saveData(data);
        }

    } catch (error) {
        await logMessage(`❌ Ошибка Aviation: ${error.message}`);
        console.error('[Aviation] Ошибка:', error);
    }
}

// ============================================================
// ЗАПУСК
// ============================================================

fetchAviation();
