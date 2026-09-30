#!/usr/bin/env node

// ============================================================
// collect-gdelt.mjs — Сборщик данных GDELT
// ============================================================
// Источник: https://api.gdeltproject.org/api/v2/doc/doc
// Формат: JSON
// Сохраняет: data/basket/gdelt.json
// Логи: logs/collectors/collect-gdelt.log
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
const DATA_FILE = join(PROJECT_ROOT, 'data', 'basket', 'gdelt.json');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE = join(LOGS_DIR, 'collect-gdelt.log');

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

async function fetchGDELT() {
    const startTime = Date.now();
    await logMessage('🚀 Запуск сборщика GDELT');

    try {
        // GDELT API — запрос последних событий
        const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=sourcecountry:UKR OR sourcecountry:RUS OR sourcecountry:USA&format=json&maxrecords=1000&sort=date&timelines=date';

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        if (data.articles && Array.isArray(data.articles)) {
            await saveData(data.articles);
            await logMessage(`✅ Сборщик GDELT завершён за ${elapsed}с, записей: ${data.articles.length}`);
        } else if (data.results && Array.isArray(data.results)) {
            await saveData(data.results);
            await logMessage(`✅ Сборщик GDELT завершён за ${elapsed}с, записей: ${data.results.length}`);
        } else {
            await logMessage(`⚠️ Неожиданный формат ответа, сохранён сырой ответ`);
            await saveData(data);
        }

    } catch (error) {
        await logMessage(`❌ Ошибка GDELT: ${error.message}`);
        console.error('[GDELT] Ошибка:', error);
    }
}

// ============================================================
// ЗАПУСК
// ============================================================

fetchGDELT();
