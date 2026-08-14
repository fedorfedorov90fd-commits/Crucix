#!/usr/bin/env node

// ============================================================
// AI-АНАЛИЗАТОР НОВОСТЕЙ — Модуль для анализа новостей через Ollama
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// Путь к корзине
const BASKET_DIR = join(ROOT, 'data', 'basket');

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function ensureDir(dir) {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (e) {
        // Игнорируем
    }
}

async function loadBasket() {
    try {
        const files = await fs.readdir(BASKET_DIR);
        const allItems = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const data = await fs.readFile(join(BASKET_DIR, file), 'utf-8');
                const items = JSON.parse(data);
                if (Array.isArray(items)) {
                    allItems.push(...items);
                } else if (items.items) {
                    allItems.push(...items.items);
                }
            }
        }
        return allItems;
    } catch (e) {
        console.error('[AI Analyzer] Ошибка загрузки корзины:', e.message);
        return [];
    }
}

async function saveBasket(items) {
    await ensureDir(BASKET_DIR);
    const file = join(BASKET_DIR, `analyzed_${new Date().toISOString().slice(0,10)}.json`);
    await fs.writeFile(file, JSON.stringify({ items, analyzedAt: new Date().toISOString() }, null, 2));
    return file;
}

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ АНАЛИЗА
// ============================================================

async function analyzeNewsItems(items, model = 'deepseek-r1:1.5b') {
    const results = [];
    let analyzed = 0;

    for (const item of items) {
        // Пропускаем уже проанализированные
        if (item.analyzed) {
            results.push(item);
            continue;
        }

        try {
            const rating = await rateNewsItem(item, model);
            item.rating = rating;
            item.analyzed = true;
            item.analyzedAt = new Date().toISOString();
            item.model = model;
            results.push(item);
            analyzed++;
        } catch (e) {
            console.error(`[AI Analyzer] Ошибка анализа "${item.title?.slice(0,30)}":`, e.message);
            item.analyzed = false;
            item.error = e.message;
            results.push(item);
        }
    }

    return { results, analyzed, total: items.length };
}

async function rateNewsItem(item, model) {
    // Базовая оценка без Ollama (на случай, если Ollama не доступен)
    const defaultRating = {
        score: 5,
        importance: 5,
        economic_impact: 5,
        urgency: 5,
        credibility: 7,
        summary: 'Автоматическая оценка (AI недоступен)',
        tags: ['auto']
    };

    try {
        // Пытаемся использовать Ollama
        const title = item.title || '';
        const description = item.description || '';
        const text = `${title}\n${description}`.slice(0, 2000);

        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: `
Ты — AI-аналитик. Оцени новость по 4 критериям (0-10):

1. Важность (importance) — насколько новость важна для глобальной безопасности
2. Экономическое влияние (economic_impact) — влияние на экономику
3. Срочность (urgency) — требует ли немедленных действий
4. Достоверность (credibility) — насколько можно доверять источнику

Новость: "${text}"

Ответь ТОЛЬКО в формате JSON:
{
    "importance": число,
    "economic_impact": число,
    "urgency": число,
    "credibility": число,
    "summary": "краткий вывод (1 предложение)",
    "tags": ["тег1", "тег2"]
}
`,
                stream: false,
                temperature: 0.1
            })
        });

        if (!response.ok) {
            return defaultRating;
        }

        const data = await response.json();

        // Парсим JSON из ответа
        let parsed;
        try {
            // Ищем JSON в ответе
            const match = data.response.match(/\{[\s\S]*\}/);
            if (match) {
                parsed = JSON.parse(match[0]);
            } else {
                return defaultRating;
            }
        } catch (e) {
            console.error('[AI Analyzer] Ошибка парсинга JSON:', e.message);
            return defaultRating;
        }

        return {
            score: Math.round(((parsed.importance || 5) + (parsed.economic_impact || 5) + (parsed.urgency || 5) + (parsed.credibility || 5)) / 4 * 10) / 10,
            importance: parsed.importance || 5,
            economic_impact: parsed.economic_impact || 5,
            urgency: parsed.urgency || 5,
            credibility: parsed.credibility || 5,
            summary: parsed.summary || 'Анализ выполнен',
            tags: parsed.tags || ['auto']
        };

    } catch (e) {
        console.error('[AI Analyzer] Ошибка вызова Ollama:', e.message);
        return defaultRating;
    }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleAIAnalyzerAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        // --- POST /api/ai/analyze/all — анализ всех новостей в корзине ---
        if (path === '/api/ai/analyze/all' && req.method === 'POST') {
            const items = await loadBasket();
            const model = 'deepseek-r1:1.5b';

            const result = await analyzeNewsItems(items, model);

            // Сохраняем результаты
            await saveBasket(result.results);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                analyzed: result.analyzed,
                total: result.total,
                message: `Проанализировано ${result.analyzed} из ${result.total} новостей`
            }));
            return;
        }

        // --- GET /api/ai/analyze/status — статус ---
        if (path === '/api/ai/analyze/status' && req.method === 'GET') {
            const items = await loadBasket();
            const total = items.length;
            const analyzed = items.filter(i => i.analyzed).length;
            const pending = total - analyzed;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                total,
                analyzed,
                pending,
                model: 'deepseek-r1:1.5b'
            }));
            return;
        }

        // --- GET /api/ai/analyze/items — получить топ-10 по рейтингу ---
        if (path === '/api/ai/analyze/items' && req.method === 'GET') {
            const params = new URLSearchParams(url.search);
            const limit = parseInt(params.get('limit')) || 10;

            const items = await loadBasket();
            const analyzed = items
                .filter(i => i.analyzed && i.rating)
                .sort((a, b) => (b.rating?.score || 0) - (a.rating?.score || 0))
                .slice(0, limit);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                items: analyzed,
                total: analyzed.length
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[AI Analyzer] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

// ============================================================
// 4. ЭКСПОРТ
// ============================================================

export default {
    handleAIAnalyzerAPI,
    analyzeNewsItems,
    rateNewsItem,
    loadBasket
};
