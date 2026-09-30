// ============================================================
// DAILY BRIEFING — Ежедневный AI-дайджест
// Интегрирован в Crucix как API-модуль
// ============================================================

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

const BASKET_PATH = '/home/ta8_/Рабочий стол/Crucix/data/basket/';
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'deepseek-r1:1.5b';

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getLatestData(limit = 30) {
    if (!existsSync(BASKET_PATH)) return [];
    const files = readdirSync(BASKET_PATH).filter(f => f.endsWith('.json'));
    const results = [];
    for (const file of files.slice(0, limit)) {
        try {
            const content = readFileSync(join(BASKET_PATH, file), 'utf-8');
            const data = JSON.parse(content);
            const records = Array.isArray(data) ? data.slice(0, 10) : [data];
            for (const record of records) {
                if (record && typeof record === 'object') {
                    results.push({
                        source: file.replace('.json', ''),
                        title: record.title || record.name || record.event || 'Событие',
                        description: record.description || record.content || record.summary || '',
                        country: record.country || record.location || '',
                        severity: record.severity || record.risk || 'normal',
                        date: record.date || record.timestamp || new Date().toISOString()
                    });
                }
            }
        } catch (e) {}
    }
    return results.slice(0, 50);
}

async function generateBrief(data) {
    const context = data.map(d =>
        `[${d.source}] ${d.title} — ${String(d.description).slice(0, 150)}`
    ).join('\n');

    const prompt = `Ты — AI-аналитик Crucix. Составь ежедневный брифинг по данным из открытых источников.

Данные за сегодня:
${context || 'Нет новых данных'}

На основе этих данных:
1. Выдели 3 самых важных события
2. Оцени общий уровень напряжённости (0-100)
3. Дай прогноз на ближайшие 24 часа
4. Напиши рекомендации

Ответ должен быть на русском языке, кратким и информативным.`;

    try {
        const response = await axios.post(OLLAMA_URL, {
            model: OLLAMA_MODEL,
            prompt: prompt,
            stream: false,
            options: {
                temperature: 0.3,
                num_predict: 800
            }
        });
        return response.data.response || 'Не удалось сгенерировать брифинг';
    } catch (error) {
        return `Ошибка генерации: ${error.message}`;
    }
}

// ============================================================
// 2. API-ОБРАБОТЧИК
// ============================================================

export async function handleDailyBriefing(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // GET /api/daily-briefing/status — статус модуля
    if (pathname === '/api/daily-briefing/status' || pathname === '/api/daily-briefing/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            module: 'daily-briefing',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            ollama: OLLAMA_MODEL,
            basket_path: BASKET_PATH
        }));
        return true;
    }

    // GET /api/daily-briefing/latest — последние данные
    if (pathname === '/api/daily-briefing/latest') {
        const data = getLatestData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            count: data.length,
            data: data
        }));
        return true;
    }

    // POST /api/daily-briefing/generate — генерация брифинга
    if (pathname === '/api/daily-briefing/generate' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const source = data.source || 'basket';
                const count = data.count || 30;

                let briefData = [];
                if (source === 'basket') {
                    briefData = getLatestData(count);
                }

                const brief = await generateBrief(briefData);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'ok',
                    source: source,
                    count: briefData.length,
                    brief: brief,
                    timestamp: new Date().toISOString()
                }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Неверный JSON' }));
            }
        });
        return true;
    }

    // GET /api/daily-briefing/generate — упрощённая генерация
    if (pathname === '/api/daily-briefing/generate' && req.method === 'GET') {
        const data = getLatestData();
        const brief = await generateBrief(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            count: data.length,
            brief: brief,
            timestamp: new Date().toISOString()
        }));
        return true;
    }

    return false;
}

export default { handleDailyBriefing };
