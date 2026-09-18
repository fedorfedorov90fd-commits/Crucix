#!/usr/bin/env node

// ============================================================
// collect-acled.mjs — Сборщик данных ACLED (с OAuth)
// ============================================================
// Источник: ACLED API (https://acleddata.com/api/acled/read)
// Аутентификация: OAuth (токен)
// Формат: JSON
// Сохраняет: data/basket/acled.json
// Логи: logs/collectors/collect-acled.log
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// КОНСТАНТЫ
// ============================================================

const PROJECT_ROOT = join(__dirname, '..', '..');
const DATA_FILE = join(PROJECT_ROOT, 'data', 'basket', 'acled.json');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE = join(LOGS_DIR, 'collect-acled.log');

// Учётные данные ACLED (вставлены пользователем)
const ACLED_EMAIL = 'fedor.fedorov.90.fd@gmail.com';
const ACLED_PASSWORD = 'IO4s2$yiEoeY6f4xw@hh%41x_cv8nt';

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
        await logMessage('Данные сохранены');
    } catch (e) {
        await logMessage(`Ошибка сохранения данных: ${e.message}`);
        throw e;
    }
}

async function getAccessToken() {
    const tokenUrl = 'https://acleddata.com/oauth/token';
    const params = new URLSearchParams({
        username: ACLED_EMAIL,
        password: ACLED_PASSWORD,
        grant_type: 'password',
        client_id: 'acled',
        scope: 'authenticated'
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
    });

    if (!response.ok) {
        throw new Error(`Ошибка получения токена: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
        throw new Error('Токен не получен');
    }

    return data.access_token;
}

// ============================================================
// ОСНОВНАЯ ЛОГИКА
// ============================================================

async function fetchACLED() {
    const startTime = Date.now();
    await logMessage('Запуск сборщика ACLED');

    try {
        // 1. Получаем токен
        await logMessage('Получение OAuth-токена...');
        const token = await getAccessToken();
        await logMessage('Токен получен');

        // 2. Формируем запрос к API
        const baseUrl = 'https://acleddata.com/api/acled/read';
        const params = new URLSearchParams({
            _format: 'json',
            country: 'Ukraine',
            year: '2026',
            fields: 'event_id_cnty,event_date,year,time_precision,disorder_type,event_type,sub_event_type,actor1,actor2,inter1,inter2,interaction,civilian_targeting,iso,region,country,admin1,admin2,admin3,location,latitude,longitude,geo_precision,source,source_scale,notes,fatalities,tags,timestamp',
            limit: '1000'
        });

        const url = `${baseUrl}?${params.toString()}`;
        await logMessage(`Запрос: ${url.replace(token, '***')}`);

        // 3. Выполняем запрос с токеном
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // 4. Проверяем структуру ответа
        if (data.status === 200 && data.data) {
            const events = data.data;
            await saveData(events);
            await logMessage(`Сборщик ACLED завершён за ${elapsed}с, записей: ${events.length}`);
        } else if (data.data && Array.isArray(data.data)) {
            await saveData(data.data);
            await logMessage(`Сборщик ACLED завершён за ${elapsed}с, записей: ${data.data.length}`);
        } else {
            await logMessage(`Неожиданный формат ответа, сохранён сырой ответ`);
            await saveData(data);
        }

    } catch (error) {
        await logMessage(`Ошибка ACLED: ${error.message}`);
        console.error('[ACLED] Ошибка:', error);
    }
}

// ============================================================
// ЗАПУСК
// ============================================================

fetchACLED();