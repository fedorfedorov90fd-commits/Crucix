#!/usr/bin/env node

// ============================================================
// LLM — AI-АНАЛИЗ НОВОСТЕЙ (ЧЕРЕЗ CURL)
// ============================================================
// Использует child_process для вызова curl
// ============================================================

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MODELS = {
    OLLAMA: 'deepseek-r1:1.5b',
    DEFAULT: 'deepseek-r1:1.5b'
};

const IMPORTANCE_LEVELS = {
    CRITICAL: { value: 9, label: '🔴 Критическая' },
    HIGH: { value: 7, label: '🟠 Высокая' },
    MEDIUM: { value: 5, label: '🟡 Средняя' },
    LOW: { value: 3, label: '🟢 Низкая' },
    MINIMAL: { value: 1, label: '⚪ Минимальная' }
};

// ============================================================
// 1. ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function analyzeText(options = {}) {
    const { text = '', title = '', model = MODELS.DEFAULT } = options;

    if (!text && !title) {
        return { success: false, error: 'Нет текста' };
    }

    try {
        console.log('[LLM] Анализ текста через curl... (ожидайте)');

        const prompt = `Оцени важность новости по шкале от 1 до 10. Ответь только числом. Новость: ${title} ${text.substring(0, 500)}`;

        const response = await queryOllamaViaCurl(prompt, model);

        // Ищем число в ответе
        const numbers = response.match(/(\d+)\/10/g) || response.match(/\b([1-9]|10)\b/g);
        let importance = 5;

        if (numbers) {
            const found = parseInt(numbers[0]);
            if (!isNaN(found) && found >= 1 && found <= 10) {
                importance = found;
            }
        }

        const level = getImportanceLevel(importance);

        console.log(`[LLM] Анализ завершён: ${level.label} (${importance}/10)`);

        return {
            success: true,
            importance: importance,
            importanceLabel: level.label,
            title: title,
            text: text.substring(0, 200),
            model: model,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[LLM] Ошибка:', error.message);
        return {
            success: false,
            error: error.message,
            fallback: getFallbackAnalysis(title, text)
        };
    }
}

// ============================================================
// 2. ЗАПРОС К OLLAMA ЧЕРЕЗ CURL
// ============================================================

async function queryOllamaViaCurl(prompt, model = MODELS.DEFAULT) {
    const jsonData = JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false,
        options: {
            temperature: 0.1,
            num_predict: 30
        }
    });

    const curlCommand = `curl -s -X POST http://localhost:11434/api/generate -H "Content-Type: application/json" -d '${jsonData}'`;

    try {
        const { stdout, stderr } = await execAsync(curlCommand, {
            timeout: 120000, // 2 минуты
            maxBuffer: 1024 * 1024
        });

        if (stderr) {
            console.warn('[LLM] curl stderr:', stderr);
        }

        const data = JSON.parse(stdout);

        if (!data.response) {
            throw new Error('Нет ответа от Ollama');
        }

        return data.response.trim();

    } catch (error) {
        if (error.killed) {
            throw new Error('Таймаут 2 минуты — curl не дождался ответа');
        }
        throw new Error(`curl ошибка: ${error.message}`);
    }
}

// ============================================================
// 3. ОПРЕДЕЛЕНИЕ УРОВНЯ ВАЖНОСТИ
// ============================================================

function getImportanceLevel(importance) {
    if (importance >= 9) return IMPORTANCE_LEVELS.CRITICAL;
    if (importance >= 7) return IMPORTANCE_LEVELS.HIGH;
    if (importance >= 5) return IMPORTANCE_LEVELS.MEDIUM;
    if (importance >= 3) return IMPORTANCE_LEVELS.LOW;
    return IMPORTANCE_LEVELS.MINIMAL;
}

// ============================================================
// 4. FALLBACK
// ============================================================

function getFallbackAnalysis(title, text) {
    const content = (text || title || '').toLowerCase();
    let importance = 3;

    const keywords = {
        critical: ['война', 'атака', 'ракета', 'удар', 'кризис', 'катастрофа', 'взрыв'],
        high: ['конфликт', 'санкции', 'протест', 'наступление', 'энергетика'],
        medium: ['переговоры', 'дипломатия', 'экономика', 'рынок']
    };

    for (const word of keywords.critical) {
        if (content.includes(word)) { importance = 9; break; }
    }
    if (importance < 9) {
        for (const word of keywords.high) {
            if (content.includes(word)) { importance = 7; break; }
        }
    }
    if (importance < 7) {
        for (const word of keywords.medium) {
            if (content.includes(word)) { importance = 5; break; }
        }
    }

    const level = getImportanceLevel(importance);

    return {
        importance: importance,
        importanceLabel: level.label,
        urgency: Math.min(10, Math.round((importance + 1) / 2)),
        credibility: 5,
        topics: ['other'],
        sentiment: 'neutral',
        summary: title || 'Анализ по правилам',
        confidence: 40,
        tags: [],
        fallback: true
    };
}

// ============================================================
// 5. API
// ============================================================

export async function handleLLMApi(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        if (path === '/api/llm/analyze' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { text, title, model } = data;

                    if (!text && !title) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Не указан текст' }));
                        return;
                    }

                    const result = await analyzeText({
                        text: text || title,
                        title: title || '',
                        model: model || MODELS.DEFAULT
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        if (path === '/api/llm/status' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                module: 'LLM Analyzer',
                status: 'active',
                method: 'curl',
                defaultModel: MODELS.DEFAULT,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[LLM API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default {
    analyzeText,
    handleLLMApi,
    MODELS
};
