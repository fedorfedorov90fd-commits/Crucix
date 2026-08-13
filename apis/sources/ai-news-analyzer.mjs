#!/usr/bin/env node
// apis/sources/ai-news-analyzer.mjs
// AI-анализ новостей из корзины через Ollama

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// URL для Ollama (локальный AI)
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'deepseek-r1:1.5b';

// Путь к корзине
const BASKET_DIR = join(ROOT, 'data', 'basket');

// ============================================================
// 1. ПОЛУЧЕНИЕ НОВОСТЕЙ ИЗ КОРЗИНЫ
// ============================================================

async function getBasketItems() {
    try {
        const files = await fs.readdir(BASKET_DIR);
        const items = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                const content = await fs.readFile(join(BASKET_DIR, file), 'utf-8');
                try {
                    const data = JSON.parse(content);
                    items.push(data);
                } catch (e) {
                    console.error(`[AI Analyzer] Ошибка парсинга ${file}:`, e.message);
                }
            }
        }
        return items;
    } catch (e) {
        console.error('[AI Analyzer] Ошибка загрузки корзины:', e.message);
        return [];
    }
}

async function saveBasketItem(item) {
    const filepath = join(BASKET_DIR, `${item.id}.json`);
    await fs.writeFile(filepath, JSON.stringify(item, null, 2));
}

// ============================================================
// 2. AI-ОЦЕНКА НОВОСТИ
// ============================================================

export async function analyzeNewsItem(item) {
    if (!item || !item.title) {
        return { error: 'Нет данных для анализа' };
    }

    // Формируем промпт для AI
    const prompt = `
Ты — аналитический AI. Оцени новость по шкале от 1 до 10 по следующим критериям:

НОВОСТЬ:
Заголовок: ${item.title}
Описание: ${item.description || 'Нет описания'}
Источник: ${item.source || 'Неизвестен'}

Оцени по критериям:
1. ГЕОПОЛИТИЧЕСКАЯ ВАЖНОСТЬ (1-10): насколько новость важна для глобальной политики
2. ЭКОНОМИЧЕСКОЕ ВЛИЯНИЕ (1-10): насколько новость влияет на экономику
3. СРОЧНОСТЬ (1-10): насколько новость требует немедленного внимания
4. ДОСТОВЕРНОСТЬ ИСТОЧНИКА (1-10): насколько заслуживает доверия источник

Ответь в формате JSON:
{
    "rating": число (среднее арифметическое всех оценок),
    "importance": число,
    "economic_impact": число,
    "urgency": число,
    "credibility": число,
    "summary": "краткий вывод на русском (1 предложение)",
    "tags": ["тег1", "тег2", "тег3"]
}
`;

    try {
        // Запрос к Ollama
        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                prompt: prompt,
                stream: false,
                temperature: 0.3,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama ошибка: ${response.status}`);
        }

        const data = await response.json();
        let result;

        try {
            // Парсим JSON из ответа AI
            const jsonMatch = data.response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                result = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('Не удалось извлечь JSON');
            }
        } catch (parseError) {
            console.error('[AI Analyzer] Ошибка парсинга ответа:', parseError.message);
            // Используем значения по умолчанию
            result = {
                rating: 5,
                importance: 5,
                economic_impact: 5,
                urgency: 5,
                credibility: 5,
                summary: 'Новость требует ручной оценки',
                tags: ['неопределено']
            };
        }

        // Обновляем элемент
        const analyzedItem = {
            ...item,
            analysis: {
                rating: result.rating || 5,
                importance: result.importance || 5,
                economic_impact: result.economic_impact || 5,
                urgency: result.urgency || 5,
                credibility: result.credibility || 5,
                summary: result.summary || 'Анализ не выполнен',
                tags: result.tags || ['general'],
                analyzedAt: new Date().toISOString(),
                model: OLLAMA_MODEL
            },
            analyzed: true
        };

        return analyzedItem;

    } catch (error) {
        console.error('[AI Analyzer] Ошибка анализа:', error.message);
        return {
            ...item,
            analysis: {
                rating: 0,
                importance: 0,
                economic_impact: 0,
                urgency: 0,
                credibility: 0,
                summary: `Ошибка: ${error.message}`,
                tags: ['error'],
                analyzedAt: new Date().toISOString(),
                model: 'error'
            },
            analyzed: true
        };
    }
}

// ============================================================
// 3. ПАКЕТНЫЙ АНАЛИЗ
// ============================================================

export async function analyzeAllUnanalyzed() {
    const items = await getBasketItems();
    const unanalyzed = items.filter(item => !item.analyzed);

    if (unanalyzed.length === 0) {
        return { message: 'Нет новостей для анализа', total: 0, analyzed: 0 };
    }

    console.log(`[AI Analyzer] Анализ ${unanalyzed.length} новостей...`);

    let analyzedCount = 0;
    const results = [];

    for (const item of unanalyzed) {
        try {
            console.log(`[AI Analyzer] Анализ: ${item.title?.substring(0, 50)}...`);
            const analyzed = await analyzeNewsItem(item);
            await saveBasketItem(analyzed);
            analyzedCount++;
            results.push({
                id: analyzed.id,
                title: analyzed.title,
                rating: analyzed.analysis?.rating || 0
            });
            // Задержка между запросами к Ollama
            await sleep(1000);
        } catch (e) {
            console.error('[AI Analyzer] Ошибка:', e.message);
        }
    }

    return {
        message: `Проанализировано ${analyzedCount} новостей`,
        total: unanalyzed.length,
        analyzed: analyzedCount,
        results
    };
}

// ============================================================
// 4. API-ОБРАБОТЧИК
// ============================================================

export async function handleAIAnalyzer(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const params = url.searchParams;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        const action = pathname.replace('/api/ai/analyze/', '');

        if (action === 'all' && req.method === 'POST') {
            // Анализ всех непроанализированных новостей
            const result = await analyzeAllUnanalyzed();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...result }));
            return;
        }

        if (action === 'status' && req.method === 'GET') {
            // Статус: сколько новостей проанализировано
            const items = await getBasketItems();
            const total = items.length;
            const analyzed = items.filter(item => item.analyzed).length;
            const unanalyzed = total - analyzed;

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                total,
                analyzed,
                unanalyzed,
                model: OLLAMA_MODEL
            }));
            return;
        }

        if (action === 'rate' && req.method === 'POST') {
            // Анализ конкретной новости (передаём ID)
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const id = data.id;
                    if (!id) {
                        throw new Error('ID не указан');
                    }

                    const items = await getBasketItems();
                    const item = items.find(i => i.id === id);
                    if (!item) {
                        throw new Error('Новость не найдена');
                    }

                    const analyzed = await analyzeNewsItem(item);
                    await saveBasketItem(analyzed);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        item: analyzed,
                        analysis: analyzed.analysis
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // GET /api/ai/analyze/items?limit=10
        if (action === 'items' && req.method === 'GET') {
            const limit = parseInt(params.get('limit')) || 10;
            const items = await getBasketItems();
            const analyzed = items
                .filter(item => item.analyzed)
                .sort((a, b) => (b.analysis?.rating || 0) - (a.analysis?.rating || 0))
                .slice(0, limit);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                items: analyzed,
                total: analyzed.length
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

    } catch (error) {
        console.error('[AI Analyzer] Ошибка:', error.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
    analyzeNewsItem,
    analyzeAllUnanalyzed,
    handleAIAnalyzer
};